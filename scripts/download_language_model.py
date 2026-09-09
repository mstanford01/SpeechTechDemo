from pathlib import Path
import os

os.environ.setdefault(
    "HF_HOME", str(Path(__file__).resolve().parents[1] / ".cache" / "huggingface")
)
from huggingface_hub import snapshot_download

print(
    snapshot_download(
        "mlx-community/Qwen3-4B-Instruct-2507-4bit",
        allow_patterns=["*.json", "*.safetensors", "*.jinja", "*.txt", "*.model"],
        token=False,
    )
)
