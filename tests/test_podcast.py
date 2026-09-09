import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from server.app import app
from server.podcast import validate_discussion, validate_url


class PodcastTests(unittest.TestCase):
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
