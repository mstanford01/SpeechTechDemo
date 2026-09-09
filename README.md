# Experis Voice Studio

A local customer demo with three modules:

- **Text to speech:** type a script, choose a preset voice, generate and download audio.
- **Document to audio:** import DOCX, PDF, TXT or Markdown, review the extracted text, then generate speech.
- **Article to podcast:** paste text, upload an article, or import a public URL. A local language model writes a two-person discussion. Review or edit the script, then record it with fixed female and male voices.

## Open on the prepared Mac

Double-click **Launch Experis Studio.command**. The studio opens at **http://127.0.0.1:8000/**. Keep the terminal window open; Control+C stops it. Model weights are cached on this Mac. The first generation after a restart loads the speech model; later requests reuse it.

The UI uses the official Experis logo and blue palette. Microsoft sign-in is intentionally not configured for this local demo. See [Microsoft sign-in setup](docs/microsoft-sign-in.md) for future integration.

## Customer demo flow

### Text to speech

Start with a short script. Choose Chatterbox Turbo for faster generation or Chatterbox Original for expression and pacing guidance. Choose the model's default voice, Female, or Male. A real, pre-generated Turbo example is available to play immediately.

### Document to audio

Import a written document up to 10 MB. Review the text before generating. Speech scripts are limited to 5,000 characters and are synthesized in passages. Scanned PDFs need OCR first. Text beyond the limit is rejected rather than silently truncated.

### Article to podcast

1. Import a document or public article URL, or paste an article of 150 to 24,000 characters.
2. Choose **Standard** (default), **Plain language**, or **Technical depth**.
3. Choose an approximate one- or two-minute length.
4. Create the discussion. The source is paraphrased and explained, not read verbatim.
5. Review the facts and edit the speaker turns if needed.
6. Record the podcast, then play and download the WAV and transcript.

Podcasts feature Sophie and Joe, a fixed American English voice pair. Scripts include a brief greeting, connected discussion and a friendly close. Both hosts use natural speaking pace without audio time stretching. Normal turns stay together to preserve sentence context, and questions have quicker handoffs than explanations. The server balances volume and retains the fixed American voice pair. Generation can take several minutes on this Mac. Targets for duration are approximate. Listen before a presentation because model outputs can contain pronunciation mistakes or unsupported claims despite the source-grounded prompt.

## Preset voices only

V1 does not accept uploaded voices. The speech API rejects file uploads and unknown voice IDs. The male and female presets come from the openly licensed VCTK corpus and are installed with attribution. Chatterbox uses them as fixed conditioning presets. No model training or fine-tuning occurs. See [credits and licenses](THIRD_PARTY_NOTICES.md).

## Setup on another Apple Silicon Mac

Use Python **3.11**, Node **22.13+**, and pnpm. With [uv](https://docs.astral.sh/uv/):

```sh
uv venv --python 3.11 .venv-tts
uv pip install --python .venv-tts/bin/python -r server/requirements-lock.txt
uv venv --python 3.11 .venv-llm
uv pip install --python .venv-llm/bin/python -r server/requirements-llm-lock.txt
pnpm install
pnpm build
.venv-tts/bin/python scripts/download_presets.py
.venv-tts/bin/python scripts/download_models.py
.venv-llm/bin/python scripts/download_language_model.py
.venv-tts/bin/python scripts/launch.py
```

Models are cached in `.cache/huggingface` and excluded from Git. Python 3.12 is incompatible with the NumPy version pinned by Chatterbox 0.1.6. The language model runs in a separate environment because its NumPy requirements differ. The project pins setuptools for compatibility with Perth audio watermarking, which remains enabled.

The target Mac is an Apple M1 Max with 32 GB unified memory. Speech uses MPS when available; the discussion writer uses MLX. To troubleshoot speech on CPU, set `CHATTERBOX_DEVICE=cpu` before launching.

## Development and checks

```sh
.venv-tts/bin/python -m uvicorn server.app:app --host 127.0.0.1 --port 8000
pnpm dev
```

Development requests to `/api` are proxied to Python. The desktop launcher serves the built webpage and API together, so no Node server is needed after building.

```sh
pnpm exec tsc --noEmit
pnpm build
.venv-tts/bin/python -m unittest discover -s tests -v
```

Automated tests cover input validation, file import, preset-only enforcement, local/private URL rejection, transcript structure, long-script splitting, and cross-origin rejection. Real inference is checked separately on the target Mac. A short warm Turbo request using its default voice took about 8.4 seconds during development; this is one observation, not a performance benchmark.

## Local data handling

No scripts, documents or audio are sent to an inference provider. Importing a URL contacts that website. Documents and generated audio are handled in memory or temporary files that are removed after processing. Users can explicitly download their outputs. Dependencies and weights require internet during initial setup. The speech engine serializes inference to limit memory use; the local writing process exits after each script.

This is a loopback-only demonstration, not a publicly hosted service. Public deployment would require real authentication, authorization, abuse controls and an appropriately sized inference server. Chatterbox is the speech model; Qwen3-4B-Instruct-2507 (4-bit MLX) writes the discussion.

## Credits

- Resemble AI Chatterbox, MIT: https://github.com/resemble-ai/chatterbox
- Qwen3-4B-Instruct-2507, Apache 2.0, converted by mlx-community.
- VCTK p329/p311 recordings, CC BY 4.0, used as fixed presets.
- Experis branding: https://www.experis.com/en

Full attribution is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and available from the app's credits link.

### Faster repeat recordings

The server keeps preset voice conditioning in memory alongside the active speech model. Repeated speech requests and podcasts reuse it; switching models or restarting clears it. A local M1 Max measurement took 13.0 seconds to prepare both podcast presets initially and under 1 ms to retrieve them again. This removes preparation overhead, not the time spent synthesizing speech.

Podcast recording streams completed turns to a **First listen** panel. You can play each turn before the entire episode is ready. The finished WAV and transcript remain available after recording. Audio is held in memory only. Disconnecting stops generation between passages.

For a short listening comparison of the revised Turbo delivery and the original Chatterbox model's expression controls, run `.venv-tts/bin/python scripts/compare_podcast_delivery.py` while the studio is idle. An optional path to a validated discussion JSON uses the same text for both versions. Samples are written to `.cache/voice-previews/`. Naturalness is a listening judgment, not an automated score. The live podcast stays on Turbo; the original model is only a comparison candidate.
