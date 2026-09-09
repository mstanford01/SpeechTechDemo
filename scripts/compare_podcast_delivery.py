"""Render the same short conversation with two installed Chatterbox models.

Run while the studio is idle. Outputs stay in the ignored local cache.
This is a listening comparison, not an automated naturalness score.
"""
from pathlib import Path
import json
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from server.app import record_podcast
from server.podcast import validate_discussion

if __name__ == "__main__":
    discussion = {
        "title": "Natural delivery comparison",
        "turns": [
            {"speaker": "A", "text": "Hey Joe, how's your day going? I've been thinking about that idea. It sounds useful, but what happens when the information is out of date?"},
            {"speaker": "B", "text": "Hey Sophie! That's the part we need to watch. Finding a document is only the first step. We still need to check that it's current."},
        ],
    }
    if len(sys.argv) > 1:
        discussion = validate_discussion(json.loads(Path(sys.argv[1]).read_text()))
    destination = ROOT / ".cache/voice-previews"
    destination.mkdir(parents=True, exist_ok=True)
    for name in ("turbo", "standard"):
        started = time.perf_counter()
        wav = record_podcast(discussion, model_name=name)
        path = destination / f"delivery-{name}.wav"
        path.write_bytes(wav)
        print(json.dumps({"model": name, "seconds": round(time.perf_counter() - started, 1), "path": str(path)}), flush=True)
