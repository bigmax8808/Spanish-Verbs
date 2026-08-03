"""
ConjugatePro Spanish — local Flask app.

A Python rewrite of the original React/Vite app. The verb quiz runs entirely
locally; two optional enhancements call out to services:
  - /api/tip   -> Claude (Anthropic API) for a short example sentence
  - /api/speak -> macOS `say` command for Spanish pronunciation (local, no key)

Run:
    pip install -r requirements.txt
    python app.py
Then open http://127.0.0.1:5000
"""

import json
import os
import re
import subprocess
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

# Load ANTHROPIC_API_KEY (and anything else) from a local .env file.
load_dotenv()

BASE_DIR = Path(__file__).parent
app = Flask(__name__)

# --- Verb data -------------------------------------------------------------
# Loaded once at startup from the JSON we generated out of the old constants.ts.
with open(BASE_DIR / "data" / "verbs.json", encoding="utf-8") as f:
    VERB_DATA = json.load(f)


# --- Local text-to-speech (macOS `say`) ------------------------------------
def _find_spanish_voice():
    """Return the name of an installed Spanish voice for `say`, or None.

    `say -v '?'` prints lines like:
        Mónica              es_ES    # ¡Hola! Me llamo Mónica.
    We pick the first voice whose language code starts with `es`.
    """
    try:
        output = subprocess.run(
            ["say", "-v", "?"], capture_output=True, text=True, timeout=5
        ).stdout
    except (FileNotFoundError, subprocess.SubprocessError):
        return None

    for line in output.splitlines():
        # Split the name from the rest on two-or-more spaces.
        match = re.match(r"^(.*?)\s{2,}([a-z]{2}_[A-Z]{2})", line)
        if match and match.group(2).startswith("es"):
            return match.group(1).strip()
    return None


SPANISH_VOICE = _find_spanish_voice()


# --- Claude (Anthropic) client, created lazily -----------------------------
_anthropic_client = None


def _get_claude():
    """Return a cached Anthropic client, or None if the SDK/key is unavailable."""
    global _anthropic_client
    if _anthropic_client is None:
        try:
            from anthropic import Anthropic

            # Reads ANTHROPIC_API_KEY from the environment (.env).
            _anthropic_client = Anthropic()
        except Exception as exc:  # missing package or key
            print(f"[tip] Claude unavailable: {exc}")
            return None
    return _anthropic_client


# --- Routes ----------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/verbs")
def api_verbs():
    """Serve the full verb pool + subject list to the browser."""
    return jsonify(VERB_DATA)


def _contains_word(text, word):
    """True if `word` appears in `text` as a whole word.

    Case-insensitive, because the form may start the sentence, but
    accent-sensitive — the accents are exactly what's being practiced. Matching
    on word boundaries matters for short forms: a plain substring test would
    accept "di" inside "difícil". `\\w` is Unicode-aware here, so accented
    letters correctly count as word characters.
    """
    pattern = r"(?<!\w)" + re.escape(word) + r"(?!\w)"
    return re.search(pattern, text, re.IGNORECASE) is not None


@app.route("/api/tip", methods=["POST"])
def api_tip():
    """Ask Claude for a short example sentence. Returns {"tip": ... | null}."""
    data = request.get_json(silent=True) or {}
    verb = data.get("verb", "")
    tense = data.get("tense", "")
    subject = data.get("subject", "")
    # The exact conjugated form the quiz just tested. The sentence must contain
    # this word verbatim, otherwise the example can drift to a different form
    # (a different person, or the wrong tense) than the one being practiced.
    answer = data.get("answer", "")

    client = _get_claude()
    if client is None:
        return jsonify({"tip": None})

    prompt = (
        f'Write a very short (max 15 words) Spanish example sentence that uses '
        f'the exact word "{answer}" — the {tense}-tense conjugation of "{verb}" '
        f'for the subject "{subject}" — followed by its English translation.\n'
        f'Requirements:\n'
        f'- The Spanish sentence MUST contain "{answer}" spelled exactly that '
        f'way, including accents. Do not substitute any other form of "{verb}".\n'
        f'- Do not use any other conjugation of "{verb}" in the sentence.\n'
        f'- The subject of "{answer}" must be "{subject}" (the pronoun itself may '
        f'be omitted, as is normal in Spanish).\n'
        f'Reply with exactly two lines and nothing else — no markdown, no '
        f'asterisks, no bold, no labels:\n'
        f'<Spanish sentence>\n'
        f'<English translation>'
    )

    try:
        # Haiku is fast and inexpensive — plenty for a one-line example sentence.
        # (Note: Haiku 4.5 does not accept the `effort` parameter.)
        # Two attempts: if the sentence doesn't actually contain the conjugated
        # form we asked for, it's showing the user the wrong verb, so try once
        # more and otherwise drop the tip rather than display a mismatch.
        for _ in range(2):
            response = client.messages.create(
                model="claude-haiku-4-5",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            tip = next((b.text for b in response.content if b.type == "text"), None)
            if not tip:
                continue
            if not answer or _contains_word(tip, answer):
                return jsonify({"tip": tip})
            print(f'[tip] discarded: sentence did not contain "{answer}"')
        return jsonify({"tip": None})
    except Exception as exc:
        print(f"[tip] Claude error: {exc}")
        return jsonify({"tip": None})


@app.route("/api/speak", methods=["POST"])
def api_speak():
    """Speak the given text aloud through the Mac's speakers via `say`."""
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"ok": False, "error": "no text"}), 400

    cmd = ["say"]
    if SPANISH_VOICE:
        cmd += ["-v", SPANISH_VOICE]
    cmd.append(text)

    try:
        subprocess.run(cmd, timeout=15)
        return jsonify({"ok": True})
    except (FileNotFoundError, subprocess.SubprocessError) as exc:
        print(f"[speak] error: {exc}")
        return jsonify({"ok": False, "error": str(exc)}), 500


if __name__ == "__main__":
    print(f"Spanish voice for TTS: {SPANISH_VOICE or '(none found — TTS disabled)'}")
    # PORT is honored so tooling can assign a free port; defaults to 5000 locally.
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="127.0.0.1", port=port, debug=True)
