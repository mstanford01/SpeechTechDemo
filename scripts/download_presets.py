"""Install the fixed CC BY 4.0 VCTK presets, verifying their content hashes."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
ROOT = Path(__file__).resolve().parents[1]
PRESETS = {
    'female': ('p329_023.wav', '3c313baf9d5abfa08101e4a3148589d0b5bcc95f0716f217d1218a5b12e5624d'),
    'male': ('p311_023.wav', 'ad2bbe69f979535c2e09aaddcd1b83a21f90a50ac7502f596162fe0831f052bb'),
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
