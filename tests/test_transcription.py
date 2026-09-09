import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from server.app import app, lock
from server.youtube import video_id, summarize_transcript
from scripts.summarize_transcript import chunks


class TranscriptionTests(unittest.TestCase):
    def test_video_links_are_normalized_without_arbitrary_hosts(self):
        for url in ['https://youtu.be/mdX3vls-ltg', 'https://www.youtube.com/watch?v=mdX3vls-ltg&list=ignored', 'https://youtube.com/shorts/mdX3vls-ltg']:
            self.assertEqual(video_id(url), 'mdX3vls-ltg')
        for url in ['http://127.0.0.1/watch?v=mdX3vls-ltg', 'https://youtube.com.attacker.test/watch?v=mdX3vls-ltg', 'https://youtube.com/playlist?list=abc', 'file:///tmp/a', 'https://user:pass@youtube.com/watch?v=mdX3vls-ltg', None]:
            with self.assertRaises(ValueError): video_id(url)

    def test_youtube_endpoint_uses_audio_worker(self):
        expected = {'text': 'Test transcript', 'captions_used': False, 'method': 'local_audio'}
        with patch('server.youtube.transcribe_video', return_value=expected) as worker:
            response = TestClient(app).post('/api/youtube', json={'url': 'https://youtu.be/mdX3vls-ltg'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), expected)
        worker.assert_called_once()
        self.assertFalse(lock.locked())

    def test_audio_upload_is_transcription_only(self):
        with patch('server.youtube.run_local_script', return_value={'text': 'Speech', 'captions_used': False}) as worker:
            response = TestClient(app).post('/api/transcribe/upload', files={'file': ('recording.wav', b'RIFFtest', 'audio/wav')})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(worker.call_args.args[0], 'transcribe_upload.py')
        self.assertFalse(lock.locked())
        self.assertEqual(TestClient(app).post('/api/transcribe/upload', files={'file': ('bad.exe', b'bad')}).status_code, 400)

    def test_summary_validation_and_source_coverage(self):
        for args in [('short', 'everyday', 5), ('source ' * 40, 'unknown', 5), ('source ' * 40, 'plain', 2)]:
            with self.assertRaises(ValueError): summarize_transcript(*args)
        text = 'A sentence about a useful idea.\n' * 2400
        parts = list(chunks(text))
        self.assertEqual(' '.join(parts).split(), text.split())
        self.assertTrue(all(len(part) <= 10000 for part in parts))

    def test_summary_defaults_are_standard_and_five_paragraphs(self):
        with patch('server.youtube.summarize_transcript', return_value={'text': 'Summary'}) as worker:
            r = TestClient(app).post('/api/transcribe/summary', json={'text': 'source ' * 40})
            self.assertEqual(r.status_code, 200)
            self.assertEqual(worker.call_args.args[1:], ('everyday', 5))
        self.assertFalse(lock.locked())
