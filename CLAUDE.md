# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What's here

One quiz, two builds, one dataset:

1. **Flask/Python app** (`app.py`, `templates/`, `static/`, `data/verbs.json`) — the local desktop-style app. Uses Claude (Anthropic API) for tips and macOS `say` for pronunciation. **This is the primary way to run the app locally**, and it is what the `Verbos de Español` desktop launcher starts (via `launch.command`).
2. **Single-file web build** (`artifact/` → `docs/index.html`) — generated from the Flask app's own `static/app.js` and `data/verbs.json` by `artifact/build.py`. No backend, no network calls. Published both as a Claude Artifact and as the GitHub Pages site.

The original React/Vite/Gemini app that this repo started as (exported from Google AI Studio) was removed on 2026-08-03. `data/verbs.json` had already been generated from its `constants.ts`, so nothing depended on it; the git history still has it if it's ever needed.

There is no test suite.

---

## Flask app (primary, local)

```bash
pip install -r requirements.txt   # flask, anthropic, python-dotenv
python app.py                     # serves http://127.0.0.1:5000 (honors $PORT)
```

Put an Anthropic key in a gitignored `.env` (`ANTHROPIC_API_KEY=...`) for the example-sentence tips. Without it, the tip endpoint returns `null` and the quiz still works fully.

Architecture:
- **`app.py`** — Flask backend. Routes: `/` (serves `templates/index.html`), `/api/verbs` (serves the verb pool + subjects as JSON), `/api/tip` (POST → calls Claude `claude-haiku-4-5` for a short example sentence; returns `{"tip": ...|null}`, catches all errors. Note: Haiku 4.5 rejects the `effort` parameter, so don't add `output_config` here), `/api/speak` (POST → runs macOS `say` with an auto-detected Spanish voice, plays through the Mac's speakers server-side). The Anthropic client is created lazily so a missing key/SDK never crashes startup.
- **`static/app.js`** — all quiz state and round logic. Grading (`checkAnswer` with NFD accent-normalization) runs client-side. Fetches verbs on load, calls the two backend endpoints for tip/TTS. **This file is also the source the web build is generated from** — see `artifact/NOTES.md` before changing it.
- **`templates/index.html`** — the UI, styled with Tailwind via CDN (fine for a local app).
- **`data/verbs.json`** — the verb dataset.
- TTS is macOS-only (`say`); on other platforms `SPANISH_VOICE` is `None` and `/api/speak` no-ops gracefully.

---

## Web build and deployment

```bash
python3 artifact/build.py   # writes BOTH outputs
```

One build, two outputs, same page wrapped differently for two hosts:

- **`artifact/conjugatepro.html`** — a fragment with no `<!doctype>`/`<html>`/`<head>`/`<body>`. Claude Artifacts supplies those at publish time and rejects a file carrying its own.
- **`docs/index.html`** — a complete document, because GitHub Pages serves files verbatim. It must keep its own `<meta charset>` and `<meta name="viewport">`; without the viewport meta, mobile Safari uses a 980px layout viewport and renders the page at ~40% size on a phone. Its head also carries the favicon / apple-touch-icon / Open Graph tags.

Site icons (`docs/*.png`) are generated from the **macOS launcher icon** by `python3 assets/make_icons.py` (needs Pillow; `assets/appicon.icns` is the source of truth). They're committed, and `artifact/build.py` does not depend on Pillow — rerun the script only when the artwork changes, and keep the `theme-color` in `build.py` in step with the background it prints.

`artifact/build.py` holds every difference from the local app as a named patch, and **fails loudly** if `static/app.js` changed in a way a patch no longer matches, rather than emitting a half-converted file. The web build inlines the verb data, swaps macOS `say` for browser `speechSynthesis`, drops the Claude tips entirely, and is bilingual (English/Spanish). Full detail in [artifact/NOTES.md](artifact/NOTES.md).

Deployment is **GitHub Pages serving `/docs` on `main`** — no GitHub Actions workflow, no build step in CI. Pushing an updated `docs/index.html` is the deploy. The site is at https://bigmax8808.github.io/Spanish-Verbs/.

Both outputs are build artifacts. Don't hand-edit either — change `static/app.js` (or `artifact/shell.html` / `build.py`) and rebuild.
