"""Validate public YouTube video links and run isolated local audio transcription."""
import json
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]


def video_id(url):
    if not isinstance(url, str) or len(url) > 2048:
        raise ValueError("Paste a YouTube video link.")
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"https", "http"} or parsed.username or parsed.password or parsed.port not in {None, 80, 443}:
        raise ValueError("Paste a public YouTube video link.")
    host = (parsed.hostname or "").lower()
    parts = parsed.path.strip("/").split("/")
    value = ""
    if host == "youtu.be" and len(parts) == 1:
        value = parts[0]
    elif host in {"youtube.com", "www.youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            value = parse_qs(parsed.query).get("v", [""])[0]
        elif len(parts) == 2 and parts[0] in {"shorts", "embed", "live"}:
            value = parts[1]
    if not re.fullmatch(r"[A-Za-z0-9_-]{11}", value):
        raise ValueError("Use a link to one YouTube video, not a channel or playlist.")
    return value


def transcribe_video(url):
    identifier = video_id(url)
    python = ROOT / ".venv-transcribe/bin/python"
    if not python.exists():
        raise ValueError("The local transcription model is not installed. Follow the studio setup instructions.")
    with tempfile.TemporaryDirectory(prefix="experis-video-") as folder:
        output = Path(folder) / "transcript.json"
        try:
            result = subprocess.run(
                [str(python), str(ROOT / "scripts/transcribe_youtube.py"), identifier, str(output)],
                cwd=ROOT, capture_output=True, text=True, timeout=3600,
            )
        except subprocess.TimeoutExpired as exc:
            raise ValueError("Transcription took too long. Try a shorter video.") from exc
        if output.exists():
            data = json.loads(output.read_text())
            if "error" in data:
                raise ValueError(data["error"])
            if result.returncode == 0:
                return data
        raise ValueError("Could not transcribe this video. It may be unavailable or YouTube may be blocking access. Try another public video.")


def run_local_script(script, arguments, payload=None, timeout=3600):
    runtime = ".venv-llm" if script == "summarize_transcript.py" else ".venv-transcribe"
    python = ROOT / runtime / "bin/python"
    if not python.exists():
        raise ValueError("The local processing model is not installed. Follow the studio setup instructions.")
    with tempfile.TemporaryDirectory(prefix="experis-transcript-") as folder:
        output = Path(folder) / "result.json"
        try:
            result = subprocess.run([str(python), str(ROOT / "scripts" / script), *arguments, str(output)],
                                    input=json.dumps(payload) if payload is not None else None,
                                    text=True, capture_output=True, cwd=ROOT, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise ValueError("This request took too long. Try a shorter recording or excerpt.") from exc
        if output.exists():
            data = json.loads(output.read_text())
            if "error" in data:
                raise ValueError(data["error"])
            if result.returncode == 0:
                return data
        raise ValueError("Local processing could not finish. Please try again.")


def summarize_transcript(text, level, paragraphs):
    if not isinstance(text, str) or not 80 <= len(text.strip()) <= 200000:
        raise ValueError("Use source text between 80 and 200,000 characters.")
    if level not in {"plain", "everyday", "technical"}:
        raise ValueError("Choose Plain language, Standard or Technical depth.")
    if type(paragraphs) is not int or paragraphs not in {1, 3, 5, 8}:
        raise ValueError("Choose 1, 3, 5 or 8 paragraphs.")
    return run_local_script("summarize_transcript.py", [],
                            {"text": text, "level": level, "paragraphs": paragraphs}, timeout=1800)
