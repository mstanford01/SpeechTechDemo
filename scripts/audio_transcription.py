"""Shared local Whisper transcription for uploaded and downloaded audio."""
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache/huggingface"))
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
MODEL = "mlx-community/whisper-large-v3-turbo"
MAX_SECONDS = 7200
MAX_BYTES = 250 * 1024 * 1024


def transcribe_audio(source):
    import imageio_ffmpeg
    import numpy as np
    import mlx_whisper
    decoded = subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-i", str(source),
         "-t", str(MAX_SECONDS + 1), "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"],
        capture_output=True, check=True, timeout=240,
    )
    audio = np.frombuffer(decoded.stdout, np.int16).astype(np.float32) / 32768.0
    if not len(audio) or len(audio) > MAX_SECONDS * 16000:
        raise ValueError("Choose a recording with audible speech, up to two hours long.")
    result = mlx_whisper.transcribe(audio, path_or_hf_repo=MODEL, verbose=None,
                                    condition_on_previous_text=False)
    segments = [{"start": round(float(s["start"]), 2), "end": round(float(s["end"]), 2),
                 "text": s["text"].strip()} for s in result["segments"] if s["text"].strip()]
    text = "\n\n".join(s["text"] for s in segments)
    if not text:
        raise ValueError("No speech was detected in this recording.")
    if len(text) > 200000:
        raise ValueError("This transcript exceeds the demo limit. Use a shorter recording.")
    return {"text": text, "segments": segments, "language": result.get("language", ""),
            "duration": round(len(audio) / 16000, 1), "method": "local_audio", "captions_used": False}
