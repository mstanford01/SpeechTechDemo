"""Bounded, process-local audio reuse. Access is protected by the studio lock."""
from collections import OrderedDict
from dataclasses import dataclass
import hashlib
import json


def audio_key(text, speaker, model, preset_digest, settings):
    # Bump this version when passage splitting, normalization, fades or pauses change.
    recipe = [1, text, speaker, model, preset_digest, settings]
    return hashlib.sha256(json.dumps(recipe, sort_keys=True).encode()).hexdigest()


@dataclass(frozen=True)
class TurnAudio:
    samples: object
    sample_rate: int


class PodcastAudioCache:
    def __init__(self, max_bytes=128 * 1024 * 1024, max_entries=128):
        self.max_bytes = max_bytes
        self.max_entries = max_entries
        self.entries = OrderedDict()
        self.size_bytes = 0

    def get(self, key):
        entry = self.entries.get(key)
        if entry is not None:
            self.entries.move_to_end(key)
        return entry

    def put(self, key, samples, sample_rate):
        previous = self.entries.pop(key, None)
        if previous is not None:
            self.size_bytes -= previous.samples.nbytes
        if samples.nbytes > self.max_bytes or self.max_entries < 1:
            return
        saved = samples.copy()
        saved.setflags(write=False)
        self.entries[key] = TurnAudio(saved, sample_rate)
        self.size_bytes += saved.nbytes
        while self.size_bytes > self.max_bytes or len(self.entries) > self.max_entries:
            _, entry = self.entries.popitem(last=False)
            self.size_bytes -= entry.samples.nbytes
