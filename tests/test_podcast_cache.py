import io
import threading
import unittest
from unittest.mock import patch

import numpy as np
import soundfile as sf

from server.app import lock, record_podcast
from server.podcast_cache import PodcastAudioCache, audio_key


class Wave:
    def __init__(self, samples):
        self.samples = samples

    def detach(self):
        return self

    def cpu(self):
        return self

    def numpy(self):
        return self.samples


class Model:
    sr = 24000

    def __init__(self):
        self.conds = "default"
        self.calls = []

    def prepare_conditionals(self, path):
        self.conds = path

    def generate(self, text, **settings):
        self.calls.append((text, self.conds, settings))
        # Different takes remain distinguishable after loudness normalization.
        samples = (0.1 * np.sin(2 * np.pi * (220 + len(self.calls) * 30) * np.arange(19200) / self.sr)).astype("float32")
        return Wave(samples)


class PodcastReuseTests(unittest.TestCase):
    def setUp(self):
        self.cache = PodcastAudioCache()
        self.model = Model()
        self.cache_patch = patch("server.app.podcast_audio_cache", self.cache)
        self.load_patch = patch("server.app.load_model", return_value=self.model)
        self.cache_patch.start()
        self.loader = self.load_patch.start()
        self.addCleanup(self.cache_patch.stop)
        self.addCleanup(self.load_patch.stop)
        self.discussion = {"title": "Topic", "turns": [
            {"speaker": "A", "text": "Hey Joe, what stood out to you?"},
            {"speaker": "B", "text": "The practical examples made it easier to understand."},
        ]}

    def test_identical_audio_skips_model_loading_and_title_changes(self):
        initial = record_podcast(self.discussion)
        self.assertEqual(len(self.model.calls), 2)
        self.loader.reset_mock()
        stats = {}
        repeated = record_podcast({**self.discussion, "title": "New title"}, stats=stats)
        self.assertEqual(initial, repeated)
        self.loader.assert_not_called()
        self.assertEqual((stats["reused_turns"], stats["generated_turns"]), (2, 0))
        self.assertEqual(self.model.conds, "default")

    def test_editing_sophie_preserves_joes_exact_audio(self):
        before, after = [], []
        record_podcast(self.discussion, lambda i, wav: before.append(wav))
        edited = {**self.discussion, "turns": [
            {"speaker": "A", "text": "Hey Joe, which example caught your attention?"},
            self.discussion["turns"][1],
        ]}
        stats = {}
        wav = record_podcast(edited, lambda i, clip: after.append(clip), stats=stats)
        self.assertEqual(len(self.model.calls), 3)
        self.assertNotEqual(before[0], after[0])
        self.assertEqual(before[1], after[1])
        self.assertEqual((stats["reused_turns"], stats["generated_turns"]), (1, 1))
        self.assertEqual(sf.info(io.BytesIO(wav)).samplerate, self.model.sr)

    def test_fresh_recording_replaces_both_takes_for_next_reuse(self):
        initial = record_podcast(self.discussion)
        fresh = record_podcast({**self.discussion, "reuse_audio": False})
        self.assertNotEqual(initial, fresh)
        self.assertEqual(len(self.model.calls), 4)
        self.assertEqual(record_podcast(self.discussion), fresh)
        self.assertEqual(len(self.model.calls), 4)

    def test_failed_turn_is_not_saved_but_completed_turn_can_be_retried(self):
        generate = self.model.generate
        def fail_second(text, **settings):
            if text == self.discussion["turns"][1]["text"]:
                raise RuntimeError("Interrupted generation")
            return generate(text, **settings)
        with patch.object(self.model, "generate", side_effect=fail_second), self.assertRaises(RuntimeError):
            record_podcast(self.discussion)
        self.assertEqual(len(self.cache.entries), 1)
        self.assertFalse(lock.locked())
        self.assertEqual(self.model.conds, "default")
        stats = {}
        record_podcast(self.discussion, stats=stats)
        self.assertEqual((stats["reused_turns"], stats["generated_turns"]), (1, 1))

    def test_cancelled_turn_is_not_saved(self):
        cancelled = threading.Event()
        generate = self.model.generate
        def cancel(text, **settings):
            wav = generate(text, **settings)
            cancelled.set()
            return wav
        with patch.object(self.model, "generate", side_effect=cancel):
            self.assertEqual(record_podcast(self.discussion, cancelled=cancelled), b"")
        self.assertEqual(len(self.cache.entries), 0)
        self.assertFalse(lock.locked())

    def test_keys_separate_voice_model_text_and_delivery_settings(self):
        base = ["Hello", "A", "standard", "preset-hash", {"temperature": 0.8}]
        key = audio_key(*base)
        for index, value in enumerate(["Hello!", "B", "turbo", "changed-preset", {"temperature": 0.9}]):
            changed = base.copy()
            changed[index] = value
            self.assertNotEqual(key, audio_key(*changed))

    def test_cache_is_bounded_and_saved_samples_cannot_be_changed(self):
        cache = PodcastAudioCache(max_bytes=32, max_entries=2)
        samples = np.zeros(4, dtype="float32")
        cache.put("a", samples, 24000)
        samples[0] = 1
        self.assertEqual(cache.get("a").samples[0], 0)
        with self.assertRaises(ValueError):
            cache.get("a").samples[0] = 2
        cache.put("b", samples, 24000)
        cache.get("a")
        cache.put("c", samples, 24000)
        self.assertIsNone(cache.get("b"))
        self.assertLessEqual(cache.size_bytes, 32)
        cache.put("oversized", np.zeros(20), 24000)
        self.assertIsNone(cache.get("oversized"))

