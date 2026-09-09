"""Install the fixed CC BY 4.0 VCTK presets, verifying their content hashes."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
ROOT = Path(__file__).resolve().parents[1]
PRESETS = {
    'female': ('p225_023.wav', '4f15f804be0f437912697ffaa56b03759e10b5e1db82fcdac20412fe95bedec9'),
    'male': ('p226_023.wav', '80b7c8d8eb9129af901750897727647291e13418dab919e3922ba58b482cf9a9'),
}
for name, (filename, expected) in PRESETS.items():
    destination = ROOT / 'server' / 'presets' / f'{name}.wav'
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() == expected:
        print(f'{name.capitalize()} preset is ready.')
        continue
    with urlopen(f'https://huggingface.co/kyutai/tts-voices/resolve/main/vctk/{filename}', timeout=60) as response:
        data = response.read(3 * 1024 * 1024)
    if hashlib.sha256(data).hexdigest() != expected:
        raise RuntimeError(f'The {name} preset checksum did not match. Nothing was installed.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    print(f'{name.capitalize()} preset installed.')
