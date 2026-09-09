"""Transcribe downloaded video AUDIO locally. Captions are never requested or read."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache/huggingface"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
from audio_transcription import transcribe_audio, MAX_SECONDS, MAX_BYTES


def run(identifier, workdir=None):
    import yt_dlp

    url = "https://www.youtube.com/watch?v=" + identifier
    def check_size(progress):
        if progress.get("downloaded_bytes", 0) > MAX_BYTES:
            raise ValueError("This video's audio exceeds the 250 MB demo limit.")

    with tempfile.TemporaryDirectory(prefix="experis-video-audio-", dir=workdir) as folder:
        options = {
            "format": "bestaudio[ext=m4a]/bestaudio/best", "noplaylist": True,
            "outtmpl": str(Path(folder) / "source.%(ext)s"),
            "quiet": True, "no_warnings": True, "socket_timeout": 20,
            "retries": 2, "fragment_retries": 2, "max_filesize": MAX_BYTES,
            "writesubtitles": False, "writeautomaticsub": False,
            "progress_hooks": [check_size],
        }
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
            duration = info.get("duration") or 0
            if info.get("is_live") or duration <= 0 or duration > MAX_SECONDS:
                raise ValueError("Choose a completed public video up to two hours long.")
            ydl.process_info(info)
            source = Path(ydl.prepare_filename(info))
        if not source.is_file() or source.stat().st_size > MAX_BYTES:
            raise ValueError("The video audio could not be downloaded within the 250 MB demo limit.")
        result = transcribe_audio(source)
        return {"title": info.get("title") or "YouTube video", "url": url, **result}



if __name__ == "__main__":
    output = Path(sys.argv[2])
    try:
        output.write_text(json.dumps(run(sys.argv[1], output.parent)))
    except Exception as exc:
        message = str(exc) if isinstance(exc, ValueError) else "YouTube audio could not be retrieved or transcribed. Try another public video; sign-in and restricted videos are not supported."
        output.write_text(json.dumps({"error": message}))
        print(str(exc), file=sys.stderr)
        sys.exit(1)
