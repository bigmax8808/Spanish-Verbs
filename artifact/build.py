"""
Build the standalone Artifact version of ConjugatePro Spanish.

Reads the *unmodified* Flask app sources one directory up and emits a single
self-contained HTML file. Nothing in the local app is touched or required at
runtime — the output has no server, no API key, and no external requests.

    python3 artifact/build.py

Why patches instead of a second copy of app.js: the quiz *logic* (round
selection, accent-aware grading, retest flow, error list, conjugation chart)
must stay byte-identical to the local app. Everything that differs is a named
patch below. If the local app changes so that a patch no longer matches, the
build fails loudly rather than silently emitting a half-converted file.

The differences:
  1. verb data      — fetched from /api/verbs   -> inlined as VERB_DATA
  2. pronunciation  — POST /api/speak (macOS `say`) -> browser speechSynthesis
  3. example tips   — POST /api/tip (Claude Haiku) -> removed entirely
  4. page shell     — Flask template + Tailwind CDN -> shell.html + inlined CSS
  5. layout         — phone-first practice card + Spanish prompt (see part 5)
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
APP = HERE.parent

APP_JS = APP / "static" / "app.js"
VERBS_JSON = APP / "data" / "verbs.json"
SHELL = HERE / "shell.html"
TAILWIND_CSS = HERE / "tailwind.css"
OUTPUT = HERE / "conjugatepro.html"
PAGES_OUTPUT = APP / "docs" / "index.html"

# The two outputs hold the same page but are wrapped differently, because their
# hosts differ:
#
#   conjugatepro.html — a *fragment*. Claude Artifacts supplies the surrounding
#     <!doctype>/<html>/<head>/<body> at publish time, and rejects a file that
#     brings its own. That skeleton is also where the viewport meta comes from.
#   docs/index.html   — a complete document, because GitHub Pages serves the
#     file verbatim with no wrapper. Without the viewport meta, mobile Safari
#     falls back to a 980px layout viewport and scales the whole page down to
#     roughly 40% on a phone.
#
# No CSS reset is needed here: Tailwind's preflight is already inlined.
# The fragment opens with <title> and one <style> block, then goes straight to
# markup, so the end of that block is where <head> closes.
#
# The icons are the desktop app's own launcher icon (see assets/make_icons.py),
# and are real files in docs/ rather than data: URIs — Pages serves them fine,
# and og:image has to be an absolute URL for link previews to resolve it at all.
# None of this goes in the fragment: Artifacts sets its own icon and would have
# no way to serve these files.
SITE_URL = "https://bigmax8808.github.io/Spanish-Verbs/"
DOCUMENT_HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="favicon-16.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-title" content="Verbos">
<meta name="theme-color" content="#5c0b17">
<meta property="og:type" content="website">
<meta property="og:title" content="Pr&aacute;ctica de Verbos">
<meta property="og:description" content="Spanish verb conjugation practice \
&mdash; present and preterite, regular and irregular.">
<meta property="og:url" content="{site_url}">
<meta property="og:image" content="{site_url}og-image.png">
<meta name="twitter:card" content="summary_large_image">
""".format(site_url=SITE_URL)
HEAD_SPLIT = "</style>"
DOCUMENT_MIDDLE = "</style>\n</head>\n<body>"
DOCUMENT_TAIL = "\n</body>\n</html>\n"


def as_document(fragment):
    """Wrap the Artifact fragment as a standalone document for GitHub Pages."""
    if fragment.count(HEAD_SPLIT) != 1:
        sys.exit(
            f"BUILD FAILED — expected exactly one {HEAD_SPLIT!r} in the shell, "
            f"found {fragment.count(HEAD_SPLIT)}. The head/body split point in "
            f"shell.html moved; update as_document() before rebuilding."
        )
    head, body = fragment.split(HEAD_SPLIT, 1)
    return DOCUMENT_HEAD + head + DOCUMENT_MIDDLE + body + DOCUMENT_TAIL


# --- Patches ---------------------------------------------------------------
# Each entry is (name, old, new). `old` must appear exactly once in app.js.

PATCHES = []

# 1. Header comment: describe the artifact build, not the Flask backend.
PATCHES.append((
    "header comment",
    """// Verb data comes from /api/verbs; grading is done here; the tip and TTS
// features call the Flask backend (/api/tip, /api/speak).""",
    """// Artifact build: verb data is inlined as VERB_DATA, grading is done here,
// pronunciation uses the browser's speechSynthesis. There is no backend, so the
// example-sentence tips from the local Flask app are not available here.""",
))

# 2. + 3. Both backend calls. getVerbTip disappears; speakText moves to the
# Web Speech API, which speaks through the viewer's own device.
PATCHES.append((
    "backend calls -> speechSynthesis",
    '''// --- Backend calls -------------------------------------------------------
// `answer` is the exact conjugated form being tested; the backend requires the
// example sentence to use it verbatim so the sentence can't drift to another form.
async function getVerbTip(verb, tense, subject, answer) {
  try {
    const res = await fetch("/api/tip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verb, tense, subject, answer }),
    });
    const data = await res.json();
    return data.tip;
  } catch (e) {
    console.error("tip error", e);
    return null;
  }
}

async function speakText(text) {
  if (state.isSpeaking) return;
  state.isSpeaking = true;
  try {
    await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error("speak error", e);
  } finally {
    state.isSpeaking = false;
  }
}''',
    '''// --- Pronunciation (browser speech synthesis) ----------------------------
// The Flask app shells out to macOS `say` with an auto-detected Spanish voice.
// Here the viewer's own browser speaks instead, so the available voices depend
// on their device.
//
// Picking simply the first Spanish voice is wrong on macOS: the novelty voices
// (Eddy, Flo, Grandma, Rocko...) sort ahead of Mónica, and they're the wrong
// thing to imitate when you're learning pronunciation. Those voices all carry a
// parenthesised language in their name — "Eddy (Spanish (Spain))" — where the
// standard voices are plain ("Mónica", "Paulina"), so a plain name wins first.
let SPANISH_VOICE = null;

function pickSpanishVoice() {
  if (!window.speechSynthesis) return null;
  const voices = speechSynthesis.getVoices() || [];
  const lang = (v) => (v.lang || "").replace("_", "-").toLowerCase();
  const spanish = voices.filter((v) => lang(v).startsWith("es"));
  const plain = (v) => !v.name.includes("(");
  return (
    spanish.find((v) => lang(v).startsWith("es-es") && plain(v)) ||
    spanish.find(plain) ||
    spanish.find((v) => lang(v).startsWith("es-es")) ||
    spanish[0] ||
    null
  );
}

if (window.speechSynthesis) {
  // Voices often aren't populated on first call; the event fills them in later.
  SPANISH_VOICE = pickSpanishVoice();
  speechSynthesis.addEventListener("voiceschanged", () => {
    SPANISH_VOICE = pickSpanishVoice();
  });
}

function speakText(text) {
  if (!window.speechSynthesis || !text) return;
  try {
    // Cancel anything still speaking so rapid clicks don't queue up.
    speechSynthesis.cancel();
    if (!SPANISH_VOICE) SPANISH_VOICE = pickSpanishVoice();
    const utterance = new SpeechSynthesisUtterance(text);
    if (SPANISH_VOICE) utterance.voice = SPANISH_VOICE;
    utterance.lang = (SPANISH_VOICE && SPANISH_VOICE.lang) || "es-ES";
    utterance.rate = 0.95; // a shade slower: these are single words being learned
    speechSynthesis.speak(utterance);
  } catch (e) {
    console.error("speak error", e);
  }
}''',
))

# `isSpeaking` existed only to stop overlapping fetches to /api/speak;
# speechSynthesis.cancel() handles that directly now.
PATCHES.append((
    "drop unused isSpeaking state",
    "  isSpeaking: false,\n",
    "",
))

# 3a. Submitting an answer no longer waits on a tip, so it needn't be async.
PATCHES.append((
    "handleSubmit is synchronous",
    "async function handleSubmit() {",
    "function handleSubmit() {",
))

# 3b. Drop the tip request that followed the first render.
PATCHES.append((
    "drop tip request",
    """  render(); // show feedback immediately, with a loading tip

  const tip = await getVerbTip(
    state.currentVerb.infinitive,
    state.currentTense,
    state.currentSubject,
    correctAnswer
  );
  if (state.feedback) {
    state.feedback.tip = tip;
    state.feedback.tipLoaded = true;
    render();
  }
}""",
    """  render();
}""",
))

# 3c. formatTip only ever cleaned up model output.
PATCHES.append((
    "drop formatTip",
    """// --- Rendering -----------------------------------------------------------
// Clean up a Gemini/Claude tip for display: drop any stray markdown asterisks,
// escape HTML, and keep line breaks (rendered via the `whitespace-pre-line` class).
function formatTip(tip) {
  return tip
    .replace(/\\*/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\\n");
}

""",
    """// --- Rendering -----------------------------------------------------------

""",
))

# 3d. The loading-dots / tip markup inside the feedback card.
PATCHES.append((
    "drop tip markup",
    """    const tipInner = !feedback.tipLoaded
      ? `<div class="flex items-center justify-center gap-2 italic text-slate-400">
           <span class="w-2 h-2 bg-slate-300 rounded-full bounce-dot"></span>
           <span class="w-2 h-2 bg-slate-300 rounded-full bounce-dot" style="animation-delay:0.15s"></span>
           <span class="w-2 h-2 bg-slate-300 rounded-full bounce-dot" style="animation-delay:0.3s"></span>
         </div>`
      : feedback.tip
      ? `<div class="italic text-center leading-relaxed text-slate-500 whitespace-pre-line">${formatTip(feedback.tip)}</div>`
      : "";

""",
    "",
))

# 3e. ...and the divider that separated the result from the tip. Without a tip
# the card ends after the result, so the trailing rule would sit on nothing.
PATCHES.append((
    "drop tip divider",
    """          ${body}
          <div class="mt-6 pt-4 border-t border-slate-200 text-slate-600 text-sm">${tipInner}</div>
        </div>""",
    """          ${body}
        </div>""",
))

# --- 5. Artifact-only UI ---------------------------------------------------
# Deliberate divergences from the local app's layout, made for the published
# version (phone-friendly, Spanish-facing). They apply after the patches above,
# so each `old` below is matched against the text those leave behind.

# The whole interface, in both languages. The local Flask app is English-only;
# the artifact ships bilingual with a switch at the foot of Settings.
PATCHES.append((
    "interface language table",
    '''const TENSES = ["Present", "Preterite"];
const CATEGORIES = ["Regular ar/er/ir", "Irregular"];''',
    '''const TENSES = ["Present", "Preterite"];
const CATEGORIES = ["Regular ar/er/ir", "Irregular"];

// --- Interface language ----------------------------------------------------
// Keys name what a string *is*, so neither language is the "source" and adding
// a third would mean adding one more table. English is the default on load.
//
// The tense and category strings above are the keys the verb data is indexed
// by and never change; only their labels here do. Verb meanings ("to speak")
// are also not translated — they're the answer key, not interface.
const LANGUAGES = [["en", "English"], ["es", "Español"]];

const UI = {
  en: {
    "settings.title": "Settings",
    "settings.language": "Interface Language",
    "settings.tense": "Tense",
    "settings.verbType": "Verb Type",
    "settings.chooseMulti": "Select one or more",
    "app.loading": "Loading practice set...",
    "retest.exit": "\\u2190 Exit Retest",
    "retest.badge": "Retest Mode",
    "retest.missed": "Missed",
    "stats.correct": "Correct",
    "stats.missed": "Missed",
    "stats.accuracy": "Accuracy",
    "stats.view": "View",
    "stats.retest": "Retest",
    "stats.reset": "Reset Stats",
    "errors.title": "Your Errors",
    "errors.retest": "Retest Errors",
    "errors.wrote": "You wrote:",
    "errors.blank": "(blank)",
    "errors.correct": "Correct",
    "errors.none": "No errors yet \\u2014 keep it up!",
    "aria.closeChart": "Close chart",
    "aria.closeErrors": "Close errors",
    "cleared.title": "All errors cleared!",
    "cleared.body": "You've corrected every verb in your error list.",
    "cleared.return": "Return to Practice",
    "done.title": "You've practiced every combination!",
    "done.body":
      "Every verb, tense and subject in your current selection has come up. " +
      "Reset the stats to start again, or turn on more tenses or verb types.",
    "done.reset": "Reset & Start Over",
    "answer.placeholder": "Conjugate...",
    "answer.check": "Check Answer",
    "answer.next": "Next Verb \\u2192",
    "result.correct": "Correct!",
    "result.wellDone": "Well done:",
    "result.accentError": "Accent Error",
    "result.incorrect": "Incorrect",
    "result.accentsRequired": "Accurate accents are required!",
    "result.spelling": "Correct spelling:",
    "chart.show": "Show Conjugation Chart",
    "chart.hide": "Hide Conjugation Chart",
    "speak.listen": "Listen",
    "tense.Present": "Present",
    "tense.Preterite": "Preterite",
    "cat.Regular ar/er/ir": "Regular ar/er/ir",
    "cat.Irregular": "Irregular",
  },
  es: {
    "settings.title": "Ajustes",
    "settings.language": "Idioma de la interfaz",
    "settings.tense": "Tiempo verbal",
    "settings.verbType": "Tipo de verbo",
    "settings.chooseMulti": "Elige uno o más",
    "app.loading": "Cargando la práctica...",
    "retest.exit": "\\u2190 Salir del repaso",
    "retest.badge": "Modo repaso",
    "retest.missed": "fallos",
    "stats.correct": "Aciertos",
    "stats.missed": "Fallos",
    "stats.accuracy": "Precisión",
    "stats.view": "Ver",
    "stats.retest": "Repasar",
    "stats.reset": "Reiniciar estadísticas",
    "errors.title": "Tus errores",
    "errors.retest": "Repasar errores",
    "errors.wrote": "Escribiste:",
    "errors.blank": "(en blanco)",
    "errors.correct": "Correcto",
    "errors.none": "Aún no hay errores. ¡Sigue así!",
    "aria.closeChart": "Cerrar la conjugación",
    "aria.closeErrors": "Cerrar los errores",
    "cleared.title": "¡Todos los errores corregidos!",
    "cleared.body": "Has corregido todos los verbos de tu lista.",
    "cleared.return": "Volver a practicar",
    "done.title": "¡Has practicado todas las combinaciones!",
    "done.body":
      "Ya han salido todos los verbos, tiempos y personas de tu selección. " +
      "Reinicia las estadísticas para empezar de nuevo, o añade más tiempos o tipos de verbo.",
    "done.reset": "Reiniciar y empezar de nuevo",
    "answer.placeholder": "Conjuga...",
    "answer.check": "Comprobar respuesta",
    "answer.next": "Siguiente verbo \\u2192",
    "result.correct": "¡Correcto!",
    "result.wellDone": "Muy bien:",
    "result.accentError": "Error de acento",
    "result.incorrect": "Incorrecto",
    "result.accentsRequired": "¡Los acentos deben ser exactos!",
    "result.spelling": "Escritura correcta:",
    "chart.show": "Ver la conjugación",
    "chart.hide": "Ocultar la conjugación",
    "speak.listen": "Escuchar",
    "tense.Present": "Presente",
    "tense.Preterite": "Pretérito",
    "cat.Regular ar/er/ir": "Regulares ar/er/ir",
    "cat.Irregular": "Irregulares",
  },
};

function t(key) {
  const table = UI[state.lang] || UI.en;
  if (table[key] !== undefined) return table[key];
  if (UI.en[key] !== undefined) return UI.en[key]; // untranslated key falls back
  return key;
}

function tenseLabel(tense) {
  return t("tense." + tense);
}

function categoryLabel(category) {
  return t("cat." + category);
}

// Fill in the page shell's static strings from the active language.
function applyStaticStrings() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
  });
}

// Switching language re-renders everything. A half-typed answer is carried
// across, so changing language mid-question doesn't cost the user their work,
// and the round itself is untouched — the same verb stays on screen.
function setLanguage(lang) {
  if (lang === state.lang) return;
  const field = document.getElementById("answer-input");
  const typed = field && !state.feedback ? field.value : null;
  state.lang = lang;
  applyStaticStrings();
  render();
  const refreshed = document.getElementById("answer-input");
  if (refreshed && typed !== null) refreshed.value = typed;
}''',
))

# English on load, along with the other first-open defaults (settings panel open
# is in shell.html; Present + Regular are already the app's own defaults).
PATCHES.append((
    "default interface language",
    """const state = {
  // Both are now multi-select: each is a list of the currently-enabled options.""",
    """const state = {
  lang: "en", // interface language; the switch at the foot of Settings changes it
  // Both are now multi-select: each is a list of the currently-enabled options.""",
))

# The conjugation panel can show any tense, not only the one being asked, so it
# needs a tense of its own. Set every time the panel opens (see the chart-toggle
# patch), which is what makes it always open on the question's own tense.
PATCHES.append((
    "chart tense state",
    "  currentTense: null, // the tense drawn for the current round\n",
    "  currentTense: null, // the tense drawn for the current round\n"
    "  chartTense: null, // tense shown in the conjugation panel; set when it opens\n",
))

# The language switch, plus translated labels on the option buttons. The map
# callbacks are renamed off `t`/`c` because `t` is now the lookup function.
PATCHES.append((
    "language switch and translated settings",
    '''  tenseBox.innerHTML = TENSES.map((t) =>
    btn(t, state.selectedTenses.includes(t))
  ).join("");
  catBox.innerHTML = CATEGORIES.map((c) =>
    btn(c, state.selectedCategories.includes(c))
  ).join("");''',
    '''  const langBox = document.getElementById("lang-buttons");
  langBox.innerHTML = LANGUAGES.map(
    ([code, label]) =>
      `<button class="flex-1 px-3 py-2 rounded-xl font-medium transition-all text-center ${
        state.lang === code
          ? "bg-blue-600 text-white shadow-md shadow-blue-100"
          : "bg-slate-50 text-slate-600 hover:bg-slate-100"
      }">${label}</button>`
  ).join("");
  [...langBox.children].forEach((el, i) => {
    el.onclick = () => setLanguage(LANGUAGES[i][0]);
  });

  tenseBox.innerHTML = TENSES.map((tense) =>
    btn(tenseLabel(tense), state.selectedTenses.includes(tense))
  ).join("");
  catBox.innerHTML = CATEGORIES.map((category) =>
    btn(categoryLabel(category), state.selectedCategories.includes(category))
  ).join("");''',
))

# The retest badge is assembled from two pieces so both languages read naturally.
PATCHES.append((
    "translated retest badge",
    """  badge.textContent = state.retestMode
    ? `Retest Mode · ${state.errors.length} Missed`
    : "";""",
    """  badge.textContent = state.retestMode
    ? `${t("retest.badge")} · ${state.errors.length} ${t("retest.missed")}`
    : "";""",
))

# The "(Translation hidden)" placeholder said nothing the empty row doesn't.
# The row keeps its fixed height so revealing the meaning doesn't shift the card.
PATCHES.append((
    "drop translation-hidden placeholder",
    '''    : `<p class="text-slate-200 italic text-lg capitalize">(Translation hidden)</p>`;''',
    '''    : "";''',
))

# The chart button moves out of the header to under "Siguiente verbo", and only
# appears once the answer has been checked — before that it's the answer.
PATCHES.append((
    "chart button under the next-verb button",
    """          Next Verb &rarr;
        </button>
      </div>`;""",
    """          ${t("answer.next")}
        </button>
        <button id="chart-toggle" class="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          &#128214; ${t(state.showChart ? "chart.hide" : "chart.show")}
        </button>
      </div>`;""",
))

PATCHES.append((
    "check answer button",
    '''    feedbackBlock = `
      <button id="check-btn" class="mt-4 px-10 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200">
        Check Answer
      </button>`;''',
    '''    feedbackBlock = `
      <button id="check-btn" class="px-10 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200">
        ${t("answer.check")}
      </button>`;''',
))

# The local app puts the subject, an arrow and the field on one line, with the
# tense underneath. At phone width that row can't fit and the field gets clipped,
# so here the prompt becomes a single line above a full-width field.
PATCHES.append((
    "stacked prompt and answer field",
    '''    <div class="mb-4">
      <div class="flex items-center justify-center gap-3 mb-2">
        <h3 class="text-5xl font-bold text-slate-800 accent-font">${currentVerb.infinitive}</h3>
        ${speakerBtn(currentVerb.infinitive, 24)}
      </div>
      <div class="h-8 mb-4">${meaningRow}</div>
      <button id="chart-toggle" class="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
        &#128214; ${state.showChart ? "Hide" : "Show"} Conjugation Chart
      </button>
    </div>

    <div class="w-full flex flex-col items-center gap-6 mt-8">
      <div class="flex items-start justify-center gap-6 text-2xl font-semibold text-slate-600 w-full">
        <div class="h-16 flex items-center justify-center bg-slate-50 px-6 rounded-2xl border border-slate-100 min-w-[140px] shadow-sm">
          ${currentSubject}
        </div>
        <span class="h-16 flex items-center text-slate-300">&rarr;</span>
        <div class="flex-1 max-w-xs">
          <input id="answer-input" type="text" ${feedback ? "disabled" : ""}
            placeholder="Conjugate..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            value="${feedback ? feedback.userAnswer.replace(/"/g, "&quot;") : ""}"
            class="w-full h-16 px-4 border-b-4 focus:outline-none transition-all text-center font-bold bg-transparent rounded-t-lg ${inputBorder}" />
          <!-- Tense being tested this round; shown in both normal and retest mode. -->
          <p class="mt-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
            ${state.currentTense} tense
          </p>
        </div>
      </div>''',
    '''    <div class="mb-2">
      <div class="flex items-center justify-center gap-3 mb-2">
        <h3 class="text-5xl font-bold text-slate-800 accent-font">${currentVerb.infinitive}</h3>
        ${speakerBtn(currentVerb.infinitive, 24)}
      </div>
      <!-- The meaning is blank until the answer is checked, but its row keeps
           its height so revealing it doesn't shift the card. -->
      <div class="h-8">${meaningRow}</div>
    </div>

    <div class="w-full flex flex-col items-center gap-6 mt-2">
      <div class="w-full flex flex-col items-center gap-4">
        <!-- Subject and tense for this round, stacked above the field so a narrow
             screen never has to squeeze the two side by side. -->
        <div class="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm text-2xl font-semibold text-slate-600 text-center">
          ${currentSubject} &mdash; ${tenseLabel(state.currentTense)}
        </div>
        <input id="answer-input" type="text" ${feedback ? "disabled" : ""}
          placeholder="${t("answer.placeholder")}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          value="${feedback ? feedback.userAnswer.replace(/"/g, "&quot;") : ""}"
          class="w-full max-w-xs h-16 px-4 border-b-4 focus:outline-none transition-all text-center font-bold bg-transparent rounded-t-lg ${inputBorder}" />
      </div>''',
))

# The button now lives in the practice card, which is *not* re-rendered when the
# chart opens or closes (re-rendering would wipe a half-typed answer), so its
# Show/Hide label has to be updated in place.
PATCHES.append((
    "keep chart button label in sync",
    """function renderChart() {
  const panel = document.getElementById("chart-panel");""",
    """function syncChartToggleLabel() {
  const btn = document.getElementById("chart-toggle");
  if (btn)
    btn.innerHTML = `&#128214; ${t(state.showChart ? "chart.hide" : "chart.show")}`;
}

function renderChart() {
  syncChartToggleLabel();
  const panel = document.getElementById("chart-panel");""",
))

# Focusing the field scrolls it into view, which is why changing a setting used
# to throw the page down: toggling a tense starts a new round, and the round
# focuses the input. Nobody adjusting two settings in a row wants that, so the
# focus no longer scrolls and the only deliberate scroll is the one below.
PATCHES.append((
    "focus without scrolling (retest round)",
    """  render();
  const input = document.getElementById("answer-input");
  if (input) setTimeout(() => input.focus(), 0);
}

// Build every not-yet-seen verb/tense/subject combination allowed by the""",
    """  render();
  const input = document.getElementById("answer-input");
  if (input) setTimeout(() => input.focus({ preventScroll: true }), 0);
}

// Build every not-yet-seen verb/tense/subject combination allowed by the""",
))

PATCHES.append((
    "focus without scrolling (normal round)",
    """  render();
  const input = document.getElementById("answer-input");
  if (input) setTimeout(() => input.focus(), 0);
}

function handleSubmit() {""",
    """  render();
  const input = document.getElementById("answer-input");
  if (input) setTimeout(() => input.focus({ preventScroll: true }), 0);
}

// "Siguiente verbo" is the one place a scroll is wanted: the new verb should be
// the first thing on screen rather than wherever the last result left the page.
// Published inside the host frame the page may not scroll itself, in which case
// this is a harmless no-op.
function handleNext() {
  startNewRound();
  const panel = document.getElementById("practice-panel");
  // Instant, not smooth: the verb should already be there when the user looks
  // up, and a smooth scroll on iOS competes with the keyboard dismissing.
  if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: "start" });
}

function handleSubmit() {""",
))

PATCHES.append((
    "next button scrolls to the verb",
    """  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.onclick = startNewRound;""",
    """  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.onclick = handleNext;""",
))

PATCHES.append((
    "translated tense in chart title",
    """  ).innerHTML = `&#128214; ${state.currentVerb.infinitive} (${state.currentTense})`;""",
    """  ).innerHTML = `&#128214; ${state.currentVerb.infinitive} (${tenseLabel(
    state.currentTense
  )})`;""",
))

# Opening the panel always resets it to the tense being tested, so it answers
# the question in front of the user first and only then becomes a reference.
PATCHES.append((
    "chart opens on the current tense",
    """    chartToggle.onclick = () => {
      state.showChart = !state.showChart;
      renderChart();
    };""",
    """    chartToggle.onclick = () => {
      state.showChart = !state.showChart;
      if (state.showChart) state.chartTense = state.currentTense;
      renderChart();
    };""",
))

# The panel gains a tense switcher. It reads from `state.chartTense` rather than
# the round's tense, and changing it re-renders only the panel — the question,
# the answer field and the seen-history are all untouched.
# Matched against the text the two chart patches above leave behind.
PATCHES.append((
    "tense switcher in the conjugation panel",
    """  panel.classList.remove("hidden");
  document.getElementById(
    "chart-title"
  ).innerHTML = `&#128214; ${state.currentVerb.infinitive} (${tenseLabel(
    state.currentTense
  )})`;

  const body = document.getElementById("chart-body");
  body.innerHTML = SUBJECTS.map((subj) => {
    const conj = state.currentVerb.conjugations[state.currentTense][subj];
    const active = subj === state.currentSubject;""",
    """  panel.classList.remove("hidden");

  // Falls back to the round's tense so the panel is never blank if it is
  // rendered before a toggle has set one.
  const shown = state.chartTense || state.currentTense;
  document.getElementById(
    "chart-title"
  ).innerHTML = `&#128214; ${state.currentVerb.infinitive} (${tenseLabel(
    shown
  )})`;

  // Only the tenses the verb data actually holds — a missing one would render
  // a row of undefineds rather than fail.
  const chartTenses = TENSES.filter((tense) => state.currentVerb.conjugations[tense]);
  const tenseBox = document.getElementById("chart-tenses");
  tenseBox.innerHTML = chartTenses
    .map(
      (tense) =>
        `<button class="px-4 py-2 rounded-xl font-medium transition-all ${
          tense === shown
            ? "bg-blue-600 text-white shadow-md shadow-blue-100"
            : "bg-slate-50 text-slate-600 hover:bg-slate-100"
        }">${tenseLabel(tense)}</button>`
    )
    .join("");
  [...tenseBox.children].forEach((el, i) => {
    el.onclick = () => {
      state.chartTense = chartTenses[i];
      renderChart();
    };
  });

  const body = document.getElementById("chart-body");
  body.innerHTML = SUBJECTS.map((subj) => {
    const conj = state.currentVerb.conjugations[shown][subj];
    // The highlight marks the form being asked, so it belongs to the round's
    // own tense and goes away when another tense is being browsed.
    const active = subj === state.currentSubject && shown === state.currentTense;""",
))



# 1. Verb data is already on the page.
PATCHES.append((
    "inline verb data",
    """async function init() {
  const res = await fetch("/api/verbs");
  const data = await res.json();
  VERBS = data.verbs;
  SUBJECTS = data.subjects;
  startNewRound();
}""",
    """function init() {
  VERBS = VERB_DATA.verbs;
  SUBJECTS = VERB_DATA.subjects;
  // Fill the shell's static strings before the first round is drawn.
  applyStaticStrings();
  startNewRound();
}""",
))


# --- Remaining UI strings -> language lookups -------------------------------
# Every user-visible string the patches above didn't already convert, swapped
# for a `t()` call against the UI table. Applied after PATCHES, under the same
# exactly-once rule: reword a string in the local app and the build fails rather
# than quietly leaving a hardcoded English literal in the bilingual artifact.
#
# Verb meanings ("to speak") are deliberately left alone: they're the answer key
# telling the learner what the verb means, not interface text.

TRANSLATIONS = [
    # Retest / round-complete screens
    (">All errors cleared!<", '>${t("cleared.title")}<'),
    (">You've corrected every verb in your error list.<", '>${t("cleared.body")}<'),
    ("          Return to Practice", '          ${t("cleared.return")}'),
    (">You've practiced every combination!<", '>${t("done.title")}<'),
    ("""Every verb, tense, and subject in your current selection has come up.
        Reset Stats to start a fresh round, or enable more tenses / verb types.""",
     '${t("done.body")}'),
    ("          Reset &amp; Start Over", '          ${t("done.reset")}'),

    # Two plain-quoted strings have to become template literals to interpolate.
    ('''      '<div class="flex items-center justify-center h-64 text-slate-400">Loading practice set...</div>';''',
     '''      `<div class="flex items-center justify-center h-64 text-slate-400">${t("app.loading")}</div>`;'''),
    ("""               ? '<p class="text-amber-600 font-semibold mt-1 text-sm">Accurate accents are required!</p>'""",
     """               ? `<p class="text-amber-600 font-semibold mt-1 text-sm">${t("result.accentsRequired")}</p>`"""),
    ("""    : '<p class="text-slate-400 text-center py-8">No errors yet &mdash; keep it up!</p>';""",
     """    : `<p class="text-slate-400 text-center py-8">${t("errors.none")}</p>`;"""),

    # Result card
    ("&#10004; Correct!", '&#10004; ${t("result.correct")}'),
    (">Well done:<", '>${t("result.wellDone")}<'),
    ('feedback.isAccentError ? "Accent Error" : "Incorrect"',
     'feedback.isAccentError ? t("result.accentError") : t("result.incorrect")'),
    (">Correct spelling:<", '>${t("result.spelling")}<'),

    # Speaker buttons
    ('title="Listen"', 'title="${t("speak.listen")}"'),

    # Error list
    ("${err.infinitive} &middot; ${err.tense} &middot; ${err.subject}",
     "${err.infinitive} &middot; ${tenseLabel(err.tense)} &middot; ${err.subject}"),
    ('>You wrote: <span class="font-semibold text-red-600">${err.userAnswer || "(blank)"}</span>',
     '>${t("errors.wrote")} <span class="font-semibold text-red-600">${err.userAnswer || t("errors.blank")}</span>'),
    ('tracking-tighter mb-1">Correct</div>', 'tracking-tighter mb-1">${t("errors.correct")}</div>'),
]


def apply_patches(source):
    """Apply every patch, insisting each matches exactly once."""
    for name, old, new in PATCHES:
        count = source.count(old)
        if count != 1:
            sys.exit(
                f"BUILD FAILED — patch '{name}' matched {count} times, expected 1.\n"
                f"static/app.js has changed in a way this build doesn't understand.\n"
                f"Re-check the patch against the current source before rebuilding."
            )
        source = source.replace(old, new)
    return source


def apply_translations(source):
    """Translate the remaining UI strings, insisting each matches exactly once."""
    for old, new in TRANSLATIONS:
        count = source.count(old)
        if count != 1:
            sys.exit(
                f"BUILD FAILED — translation for {old[:60]!r} matched {count} times, "
                f"expected 1.\nThe string moved or changed wording in static/app.js; "
                f"update TRANSLATIONS before rebuilding."
            )
        source = source.replace(old, new)
    return source


def main():
    app_js = apply_translations(apply_patches(APP_JS.read_text(encoding="utf-8")))

    # Sanity check: nothing may reach for the network at runtime.
    for forbidden in ("fetch(", "/api/", "XMLHttpRequest"):
        if forbidden in app_js:
            sys.exit(f"BUILD FAILED — '{forbidden}' still present in the output JS.")

    verbs = json.loads(VERBS_JSON.read_text(encoding="utf-8"))
    # `</script` inside a script block would end it early; JSON has no such text
    # today, but escaping the slash keeps that true if a verb ever contains it.
    verb_literal = "const VERB_DATA = " + json.dumps(
        verbs, ensure_ascii=False, separators=(",", ":")
    ).replace("</", "<\\/") + ";"

    html = SHELL.read_text(encoding="utf-8")
    for marker, replacement in (
        ("/*__TAILWIND_CSS__*/", TAILWIND_CSS.read_text(encoding="utf-8")),
        ("/*__VERB_DATA__*/", verb_literal),
        ("/*__APP_JS__*/", app_js),
    ):
        if marker not in html:
            sys.exit(f"BUILD FAILED — marker {marker} missing from shell.html.")
        html = html.replace(marker, replacement)

    OUTPUT.write_text(html, encoding="utf-8")
    print(f"Wrote {OUTPUT} ({len(html.encode('utf-8')) / 1024:.0f} KB)  [Artifact fragment]")

    document = as_document(html)
    PAGES_OUTPUT.write_text(document, encoding="utf-8")
    print(f"Wrote {PAGES_OUTPUT} ({len(document.encode('utf-8')) / 1024:.0f} KB)  [Pages document]")

    print(f"  verbs: {len(verbs['verbs'])}   subjects: {len(verbs['subjects'])}")


if __name__ == "__main__":
    main()
