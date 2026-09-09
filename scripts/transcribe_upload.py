"""Transcribe an uploaded audio file in the isolated speech recognition runtime."""
import json
from pathlib import Path
import sys
from audio_transcription import transcribe_audio

if __name__ == "__main__":
    output = Path(sys.argv[2])
    try:
        output.write_text(json.dumps(transcribe_audio(Path(sys.argv[1]))))
    except Exception as exc:
        output.write_text(json.dumps({"error": str(exc) if isinstance(exc, ValueError) else "This audio file could not be read or transcribed. Try MP3, WAV or M4A."}))
        print(str(exc), file=sys.stderr)
        sys.exit(1)
