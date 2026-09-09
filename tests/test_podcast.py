import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from server.app import app
from server.podcast import validate_discussion, validate_url


class PodcastTests(unittest.TestCase):
    def test_preset_cache_is_per_model_and_restores_default(self):
        from server.app import preset_conditions
        class Model:
            def __init__(self):
                self.conds = "default"
                self.calls = 0
            def prepare_conditionals(self, path):
                self.calls += 1
                self.conds = object()
        first, second = Model(), Model()
        female = preset_conditions(first, "female")
        self.assertIs(preset_conditions(first, "female"), female)
        self.assertIsNot(preset_conditions(first, "male"), female)
        self.assertIsNot(preset_conditions(second, "female"), female)
        self.assertEqual(first.calls, 2)
        self.assertEqual(first.conds, "default")

    def test_stream_emits_preview_then_completed_audio(self):
        import json
        def record(discussion, on_turn, cancelled):
            on_turn(0, b"preview")
            return b"episode"
        discussion = {"title": "Topic", "turns": [
            {"speaker": "A", "text": "Question."},
            {"speaker": "B", "text": "Answer."},
        ]}
        with patch("server.app.record_podcast", side_effect=record), patch("server.app.encode_mp3", return_value=b"mp3episode") as encode:
            response = TestClient(app).post("/api/podcast/stream", json=discussion)
        events = [json.loads(line) for line in response.text.splitlines()]
        self.assertEqual([event["type"] for event in events], ["turn", "complete"])
        self.assertEqual(events[0]["audio"], "cHJldmlldw==")
        self.assertEqual(events[1]["media_type"], "audio/mpeg")
        encode.assert_called_once_with(b"episode")

    def test_stream_reports_failure_without_fake_completion(self):
        import json
        from fastapi import HTTPException
        discussion = {"title": "Topic", "turns": [
            {"speaker": "A", "text": "Question."},
            {"speaker": "B", "text": "Answer."},
        ]}
        with patch("server.app.record_podcast", side_effect=HTTPException(409, "Busy")):
            response = TestClient(app).post("/api/podcast/stream", json=discussion)
        self.assertEqual(json.loads(response.text), {"type": "error", "detail": "Busy"})

    def test_private_url_rejected(self):
        for url in [
            "file:///etc/passwd",
            "http://127.0.0.1/",
            "http://localhost/",
            "https://user:pass@example.com/",
            "http://example.com:8000/",
        ]:
            with self.assertRaises(ValueError):
                validate_url(url)

    def test_alternation_and_limits(self):
        good = {
            "title": "A topic",
            "turns": [
                {"speaker": "A", "text": "A question."},
                {"speaker": "B", "text": "An answer."},
            ],
        }
        self.assertEqual(validate_discussion(good), good)
        for bad in [
            {},
            {"title": "x", "turns": []},
            {
                "title": "x",
                "turns": [{"speaker": "B", "text": "x"}, {"speaker": "A", "text": "x"}],
            },
        ]:
            with self.assertRaises(ValueError):
                validate_discussion(bad)

    def test_article_import_allows_longer_sources(self):
        client = TestClient(app)
        r = client.post(
            "/api/import",
            data={"purpose": "podcast"},
            files={"file": ("article.txt", b"A paragraph. " * 500)},
        )
        self.assertEqual(r.status_code, 200)

    def test_no_unauthorized_voice_parameter(self):
        client = TestClient(app)
        with patch("server.app.synthesize") as synth:
            self.assertEqual(
                client.post(
                    "/api/generate", data={"text": "hello", "voice": "../../custom"}
                ).status_code,
                400,
            )
            synth.assert_not_called()

    def test_invalid_transcript_not_recorded(self):
        with patch("server.app.record_podcast") as record:
            self.assertEqual(
                TestClient(app)
                .post("/api/podcast/audio", json={"title": "bad", "turns": []})
                .status_code,
                400,
            )
            record.assert_not_called()


if __name__ == "__main__":
    unittest.main()
