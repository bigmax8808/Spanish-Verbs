# Práctica de Verbos — Spanish verb conjugation practice

A Spanish verb conjugation quiz, in two forms that share one dataset:

- **Local Flask app** (`app.py`) — the desktop version, with Claude-generated
  example sentences and macOS `say` pronunciation.
- **Single-file web build** (`docs/index.html`) — a self-contained, bilingual
  (English/Spanish) build with no backend, published at
  **https://bigmax8808.github.io/Spanish-Verbs/**

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Serves http://127.0.0.1:5000 (honors `$PORT`). On the Mac, the
`Verbos de Español` desktop launcher runs `launch.command`, which starts the
same server on port 5050 and opens a browser.

Put an Anthropic key in a gitignored `.env` (`ANTHROPIC_API_KEY=...`) for the
example-sentence tips. Without it the quiz still works fully — the tip endpoint
just returns nothing.

## Publish the web version

```bash
python3 artifact/build.py
cp artifact/conjugatepro.html docs/index.html
```

Then commit and push. GitHub Pages serves `/docs` on `main`; there is no build
step in CI. See [artifact/NOTES.md](artifact/NOTES.md) for how the single-file
build differs from the Flask app.
