"""Download official weights ahead of a presentation (no account required)."""

from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
from huggingface_hub import snapshot_download

for repository, patterns in [
    (
        "ResembleAI/chatterbox",
        [
            "ve.safetensors",
            "t3_cfg.safetensors",
            "s3gen.safetensors",
            "tokenizer.json",
            "conds.pt",
        ],
    ),
    (
        "ResembleAI/chatterbox-turbo",
        ["*.safetensors", "*.json", "*.txt", "*.pt", "*.model"],
    ),
]:
    print(f"Downloading {repository}", flush=True)
    print(
        snapshot_download(repo_id=repository, allow_patterns=patterns, token=False),
        flush=True,
    )
print("Both models are cached for this Mac.")
