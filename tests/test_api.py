import io
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from server.app import app, split_text


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)

    def test_reject_foreign_origin(self):
        self.assertEqual(
            self.client.post(
                "/api/generate",
                headers={"Origin": "https://example.com"},
                data={"text": "Hello"},
            ).status_code,
            403,
        )

    def test_invalid_request_does_not_load_model(self):
        with patch("server.app.synthesize") as synth:
            for data in [
                {"text": " "},
                {"text": "x" * 5001},
                {"text": "hi", "model": "custom"},
                {"text": "hi", "exaggeration": "9"},
            ]:
                self.assertEqual(
                    self.client.post("/api/generate", data=data).status_code, 400
                )
            synth.assert_not_called()

    def test_custom_voice_is_rejected(self):
        with patch("server.app.synthesize") as synth:
            result = self.client.post(
                "/api/generate",
                data={"text": "Hello"},
                files={"reference": ("voice.wav", b"sample", "audio/wav")},
            )
            self.assertEqual(result.status_code, 400)
            synth.assert_not_called()

    def test_preset_generation_returns_audio(self):
        with patch("server.app.synthesize", return_value=b"RIFFtest"):
            result = self.client.post(
                "/api/generate", data={"text": "Hello", "model": "turbo"}
            )
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.headers["content-type"], "audio/wav")

    def test_document_import(self):
        result = self.client.post(
            "/api/import", files={"file": ("script.txt", b"Hello world", "text/plain")}
        )
        self.assertEqual(result.json(), {"text": "Hello world"})
        self.assertEqual(
            self.client.post(
                "/api/import", files={"file": ("bad.exe", b"bad")}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/api/import", files={"file": ("long.txt", b"x" * 5001)}
            ).status_code,
            400,
        )

    def test_chunking_retains_words(self):
        text = "First sentence. " + ("Long passage with words. " * 80) + "End."
        chunks = split_text(text)
        self.assertTrue(all(len(c) <= 250 for c in chunks))
        self.assertEqual(" ".join(chunks).split(), text.split())


if __name__ == "__main__":
    unittest.main()
