"""Local-only Chatterbox studio. No scripts, voice samples, or outputs are persisted."""

from __future__ import annotations
import asyncio
import gc
import io
import logging
import os
from pathlib import Path
import re
import tempfile
import threading
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("DO_NOT_TRACK", "1")
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Experis Speech Studio", docs_url=None, redoc_url=None)
logger = logging.getLogger("studio")
MAX_UPLOAD = 10 * 1024 * 1024
lock = threading.Lock()
state = {"model": None, "name": None, "phase": "Ready", "device": None}


@app.middleware("http")
async def local_only(request: Request, call_next):
    # Reject foreign origins to prevent websites from invoking the local GPU server.
    from urllib.parse import urlparse

    origin = request.headers.get("origin")
    if origin and urlparse(origin).hostname not in {
        "localhost",
        "127.0.0.1",
        "[::1]",
        "::1",
    }:
        return Response("Local access only", status_code=403)
    response = await call_next(request)
    response.headers["Cache-Control"] = (
        "no-store" if request.url.path.startswith("/api") else "no-cache"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.get("/api/health")
def health():
    return {
        "loaded": state["model"] is not None,
        "model": state["name"],
        "phase": state["phase"],
        "device": state["device"],
        "busy": lock.locked(),
    }


async def read_upload(file: UploadFile):
    data = await file.read(MAX_UPLOAD + 1)
    await file.close()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "Please choose a file smaller than 10 MB.")
    if not data:
        raise HTTPException(400, "The uploaded file is empty.")
    return data


@app.post("/api/import")
async def import_document(file: UploadFile = File(...), purpose: str = Form("speech")):
    name = file.filename or ""
    data = await read_upload(file)

    def extract():
        suffix = Path(name).suffix.lower()
        if suffix in {".txt", ".md"}:
            return data.decode("utf-8-sig")
        if suffix == ".pdf":
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            if len(reader.pages) > 100:
                raise ValueError("Choose a PDF with fewer than 100 pages.")
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        if suffix == ".docx":
            from docx import Document

            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if sum(f.file_size for f in archive.infolist()) > 30 * 1024 * 1024:
                    raise ValueError("This document expands beyond the 30 MB limit.")
            return "\n".join(p.text for p in Document(io.BytesIO(data)).paragraphs)
        raise ValueError("Use a TXT, Markdown, PDF, or DOCX document.")

    try:
        text = (await asyncio.to_thread(extract)).strip()
    except Exception as exc:
        raise HTTPException(
            400,
            str(exc)
            if isinstance(exc, ValueError)
            else "This document could not be read. Try exporting it as plain text.",
        ) from exc
    if not text:
        raise HTTPException(
            400, "No readable text was found. Scanned PDFs need OCR before import."
        )
    limit = 24000 if purpose == "podcast" else 5000
    if len(text) > limit:
        raise HTTPException(
            400,
            f"This document exceeds {limit:,} characters. Import a shorter excerpt.",
        )
    return {"text": text}


def split_text(text: str, limit: int = 250):
    chunks = []
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text.strip()):
        while len(sentence) > limit:
            cut = sentence.rfind(" ", 0, limit + 1)
            if cut < 1:
                cut = limit
            chunks.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if sentence:
            if chunks and len(chunks[-1]) + len(sentence) + 1 <= limit:
                chunks[-1] += " " + sentence
            else:
                chunks.append(sentence)
    return chunks


def load_model(name):
    import torch

    if state["name"] == name and state["model"] is not None:
        return state["model"]
    state["phase"] = "Loading speech model"
    state["model"] = None
    gc.collect()
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
    device = os.getenv(
        "CHATTERBOX_DEVICE", "mps" if torch.backends.mps.is_available() else "cpu"
    )
    torch.set_num_threads(8)
    if name == "standard":
        from chatterbox.tts import ChatterboxTTS

        model = ChatterboxTTS.from_pretrained(device=device)
    else:
        from chatterbox.tts_turbo import ChatterboxTurboTTS
        from huggingface_hub import snapshot_download

        checkpoint = snapshot_download(
            repo_id="ResembleAI/chatterbox-turbo",
            token=False,
            allow_patterns=["*.safetensors", "*.json", "*.txt", "*.pt", "*.model"],
        )
        model = ChatterboxTurboTTS.from_local(checkpoint, device=device)
    state.update(model=model, name=name, device=device, phase="Ready")
    return model


def synthesize(text, name, exaggeration, cfg_weight, voice="default"):
    import numpy as np
    import soundfile as sf
    import torch

    if not lock.acquire(blocking=False):
        raise HTTPException(
            409,
            "The speech engine is working on another request. Please wait and try again.",
        )
    try:
        with tempfile.TemporaryDirectory(prefix="speechtech-") as temp:
            model = load_model(name)
            # Keep the supplied default conditionals pristine after using a reference voice.
            original_conditions = model.conds
            chunks = split_text(text)
            clips = []
            try:
                if voice != "default":
                    model.prepare_conditionals(
                        str(ROOT / "server/presets" / f"{voice}.wav")
                    )
                with torch.inference_mode():
                    for index, chunk in enumerate(chunks):
                        state["phase"] = (
                            f"Generating speech · passage {index + 1} of {len(chunks)}"
                        )
                        kwargs = (
                            {"exaggeration": exaggeration, "cfg_weight": cfg_weight}
                            if name == "standard"
                            else {}
                        )
                        wav = model.generate(chunk, **kwargs)
                        clips.append(wav.detach().cpu().numpy().reshape(-1))
                        if index < len(chunks) - 1:
                            clips.append(np.zeros(int(model.sr * 0.2), dtype="float32"))
                output = io.BytesIO()
                sf.write(
                    output,
                    np.concatenate(clips),
                    model.sr,
                    format="WAV",
                    subtype="PCM_16",
                )
                return output.getvalue()
            finally:
                model.conds = original_conditions
    finally:
        state["phase"] = "Ready"
        lock.release()


@app.post("/api/generate")
async def generate(
    text: str = Form(...),
    model: str = Form("standard"),
    exaggeration: float = Form(0.5),
    cfg_weight: float = Form(0.5),
    voice: str = Form("default"),
    request: Request = None,
):
    text = text.strip()
    if not text or len(text) > 5000:
        raise HTTPException(400, "Enter between 1 and 5,000 characters.")
    if model not in {"standard", "turbo"}:
        raise HTTPException(400, "Choose a supported Chatterbox model.")
    if not 0.25 <= exaggeration <= 1.5 or not 0 <= cfg_weight <= 1:
        raise HTTPException(400, "Speech settings are outside the allowed range.")
    if voice not in {"default", "male", "female"}:
        raise HTTPException(400, "Choose a supplied preset voice.")
    if any(hasattr(value, "filename") for value in (await request.form()).values()):
        raise HTTPException(400, "This demo supports preset voices only.")
    try:
        wav = await asyncio.to_thread(
            synthesize, text, model, exaggeration, cfg_weight, voice
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Speech generation failed")
        raise HTTPException(
            503,
            "The speech engine could not complete this request. Check the studio terminal for details, then try a shorter script.",
        ) from exc
    return Response(
        wav,
        media_type="audio/wav",
        headers={"Content-Disposition": 'attachment; filename="experis-speech.wav"'},
    )


@app.post("/api/article")
async def article_url(request: Request):
    from .podcast import extract_url

    try:
        payload = await request.json()
        url = payload.get("url", "")
        if not isinstance(url, str) or len(url) > 2048:
            raise ValueError("Enter a valid article URL.")
        return await asyncio.to_thread(extract_url, url)
    except Exception as exc:
        raise HTTPException(
            400,
            str(exc)
            if isinstance(exc, ValueError)
            else "The article could not be retrieved. Upload a document or paste the text instead.",
        ) from exc


@app.post("/api/podcast/script")
async def podcast_script(request: Request):
    from .podcast import write_discussion

    payload = await request.json()
    article = payload.get("article", "")
    if not isinstance(article, str):
        raise HTTPException(400, "Enter article text.")
    if not lock.acquire(blocking=False):
        raise HTTPException(
            409, "The studio is busy. Please wait for the current generation."
        )
    try:
        state["phase"] = "Writing the discussion locally"
        return await asyncio.to_thread(
            write_discussion,
            article,
            payload.get("minutes", 1),
            payload.get("level", "everyday"),
        )
    except Exception as exc:
        raise HTTPException(
            400,
            str(exc)
            if isinstance(exc, ValueError)
            else "The discussion could not be created. Try a shorter article.",
        ) from exc
    finally:
        state["phase"] = "Ready"
        lock.release()


def record_podcast(discussion):
    import numpy as np
    import soundfile as sf
    import torch
    import librosa
    import pyloudnorm as pyln

    if not lock.acquire(blocking=False):
        raise HTTPException(409, "The studio is busy. Try again shortly.")
    try:
        model = load_model("turbo")
        original = model.conds
        conditions = {}
        clips = []
        try:
            for speaker, voice in [("A", "female"), ("B", "male")]:
                model.prepare_conditionals(
                    str(ROOT / "server/presets" / f"{voice}.wav")
                )
                conditions[speaker] = model.conds
            with torch.inference_mode():
                for index, turn in enumerate(discussion["turns"]):
                    state["phase"] = (
                        f"Recording turn {index + 1} of {len(discussion['turns'])}"
                    )
                    model.conds = conditions[turn["speaker"]]
                    pieces = []
                    for chunk in split_text(turn["text"]):
                        wav = model.generate(chunk, temperature=0.65)
                        pieces.append(wav.detach().cpu().numpy().reshape(-1))
                    samples = np.concatenate(pieces)
                    samples = librosa.effects.time_stretch(samples, rate=0.96)
                    loudness = pyln.Meter(model.sr).integrated_loudness(samples)
                    if np.isfinite(loudness):
                        samples = pyln.normalize.loudness(samples, loudness, -20)
                    peak = np.max(np.abs(samples))
                    if peak > 0.92:
                        samples = samples * (0.92 / peak)
                    # Short fades prevent clicks; a modest pause gives each idea room.
                    fade = min(180, len(samples) // 2)
                    samples[:fade] *= np.linspace(0, 1, fade)
                    samples[-fade:] *= np.linspace(1, 0, fade)
                    clips.append(samples)
                    clips.append(np.zeros(int(model.sr * 0.42), dtype="float32"))
            stream = io.BytesIO()
            sf.write(
                stream, np.concatenate(clips), model.sr, format="WAV", subtype="PCM_16"
            )
            return stream.getvalue()
        finally:
            model.conds = original
    finally:
        lock.release()
        state["phase"] = "Ready"


@app.post("/api/podcast/audio")
async def podcast_audio(request: Request):
    from .podcast import validate_discussion

    try:
        discussion = validate_discussion(await request.json())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    try:
        audio = await asyncio.to_thread(record_podcast, discussion)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Podcast generation failed")
        raise HTTPException(
            503,
            "Could not record the podcast. Your script is still available; try again.",
        ) from exc
    return Response(
        audio,
        media_type="audio/wav",
        headers={"Content-Disposition": 'attachment; filename="experis-podcast.wav"'},
    )


static_dir = ROOT / "dist" / "client"
if static_dir.exists():

    @app.get("/{module}")
    @app.get("/{module}/")
    def module_page(module: str):
        if module not in {"speak", "documents", "podcast"}:
            path = static_dir / module
            if path.is_file() and path.parent == static_dir:
                return FileResponse(path)
            raise HTTPException(404, "Not found")
        return FileResponse(static_dir / f"{module}.html")

    app.mount("/", StaticFiles(directory=static_dir, html=True), name="studio")
