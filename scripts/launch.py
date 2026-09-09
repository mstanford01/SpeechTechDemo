"""Run the built studio on loopback and open its webpage."""

from pathlib import Path
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8000/"
if not (ROOT / "dist/client/index.html").exists():
    sys.exit("The webpage has not been built. Run pnpm install and pnpm build first.")
try:
    with urllib.request.urlopen(URL + "api/health", timeout=1) as response:
        if response.status == 200:
            webbrowser.open(URL)
            print("The studio is already running. Opened its webpage.")
            sys.exit(0)
except (OSError, TimeoutError):
    pass
print(
    "Experis Speech Studio\nKeep this window open while using the studio. Press Control+C to stop.\n"
)
server = subprocess.Popen(
    [
        sys.executable,
        "-m",
        "uvicorn",
        "server.app:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ],
    cwd=ROOT,
)


def open_when_ready():
    for _ in range(60):
        try:
            urllib.request.urlopen(URL + "api/health", timeout=1).close()
            webbrowser.open(URL)
            return
        except OSError:
            if server.poll() is not None:
                return
            time.sleep(0.5)


threading.Thread(target=open_when_ready, daemon=True).start()
try:
    server.wait()
except KeyboardInterrupt:
    server.terminate()
    server.wait()
