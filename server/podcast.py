from __future__ import annotations
import ipaddress
import io
import json
import socket
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse, urljoin
import requests
import trafilatura
from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[1]
MAX_ARTICLE = 24000


def validate_url(url):
    parts = urlparse(url)
    if (
        parts.scheme not in {"http", "https"}
        or not parts.hostname
        or parts.username
        or parts.password
        or parts.port not in {None, 80, 443}
    ):
        raise ValueError("Use a public http or https article URL.")
    try:
        addresses = socket.getaddrinfo(
            parts.hostname, parts.port or 443, type=socket.SOCK_STREAM
        )
    except OSError as exc:
        raise ValueError("That website could not be found.") from exc
    if not addresses or any(
        not ipaddress.ip_address(a[4][0]).is_global for a in addresses
    ):
        raise ValueError(
            "Use a public article URL, not a local or private network address."
        )
    return url


def extract_url(url):
    with requests.Session() as session:
        session.trust_env = False
        for _ in range(5):
            validate_url(url)
            with session.get(
                url,
                timeout=(10, 25),
                allow_redirects=False,
                stream=True,
                headers={"User-Agent": "ExperisLocalDemo/1.0 article-reader"},
            ) as response:
                if response.is_redirect:
                    url = urljoin(url, response.headers.get("Location", ""))
                    continue
                response.raise_for_status()
                if not any(
                    t in response.headers.get("Content-Type", "")
                    for t in ["text/html", "application/xhtml", "text/plain"]
                ):
                    raise ValueError(
                        "This link is not an article page. Upload a document instead."
                    )
                data = bytearray()
                for chunk in response.iter_content(65536):
                    data.extend(chunk)
                    if len(data) > 2 * 1024 * 1024:
                        raise ValueError(
                            "This page is too large to import. Paste the article text instead."
                        )
                html = bytes(data).decode(
                    response.encoding or "utf-8", errors="replace"
                )
                result = trafilatura.bare_extraction(
                    html,
                    include_comments=False,
                    include_tables=False,
                    favor_precision=True,
                )
                text = (result.text if result else "") or ""
                if len(text) < 150:
                    raise ValueError(
                        "Could not extract enough article text. The page may require sign-in; paste the article or upload a document."
                    )
                if len(text) > MAX_ARTICLE:
                    raise ValueError(
                        "The article exceeds 24,000 characters. Paste a shorter excerpt to keep the discussion focused."
                    )
                return {
                    "text": text,
                    "title": result.title or "Imported article",
                    "url": url,
                }
    raise ValueError("Too many redirects. Paste the article text instead.")


def validate_discussion(d):
    if (
        not isinstance(d, dict)
        or not isinstance(d.get("title"), str)
        or not isinstance(d.get("turns"), list)
    ):
        raise ValueError("The discussion format was not valid. Try creating it again.")
    if not 2 <= len(d["turns"]) <= 20 or len(d["title"]) > 200:
        raise ValueError("Use 2–20 speaker turns and a short title.")
    total = 0
    for i, turn in enumerate(d["turns"]):
        if (
            not isinstance(turn, dict)
            or turn.get("speaker") != ("A" if i % 2 == 0 else "B")
            or not isinstance(turn.get("text"), str)
            or not turn["text"].strip()
            or len(turn["text"]) > 700
        ):
            raise ValueError(
                "Each turn must alternate between the two hosts and contain 1–700 characters."
            )
        total += len(turn["text"])
    if total > 6500:
        raise ValueError("The discussion is too long. Shorten it before recording.")
    return d


def write_discussion(article, minutes, level="everyday"):
    if not 150 <= len(article.strip()) <= MAX_ARTICLE:
        raise ValueError("Provide an article between 150 and 24,000 characters.")
    if level not in {"plain", "everyday", "technical"}:
        raise ValueError("Choose a supported explanation level.")
    if type(minutes) is not int or minutes not in {1, 2, 3}:
        raise ValueError("Choose a one-, two- or three-minute discussion.")
    python = ROOT / ".venv-llm/bin/python"
    if not python.exists():
        raise ValueError(
            "The local discussion model is not installed. Follow the setup instructions."
        )
    with tempfile.TemporaryDirectory(prefix="experis-script-") as folder:
        path = Path(folder) / "discussion.json"
        result = subprocess.run(
            [str(python), str(ROOT / "scripts/write_podcast.py"), str(path)],
            input=json.dumps({"article": article, "minutes": minutes, "level": level}),
            text=True,
            capture_output=True,
            timeout=360,
            cwd=ROOT,
        )
        if result.returncode != 0:
            print(result.stderr[-3000:], flush=True)
            raise ValueError(
                "The local model could not write this discussion. Try a shorter article or try again."
            )
        return validate_discussion(json.loads(path.read_text()))
