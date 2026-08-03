// ConjugatePro Spanish — client-side quiz logic.
// Ports the state/round logic from the old React App.tsx to vanilla JS.
// Verb data comes from /api/verbs; grading is done here; the tip and TTS
// features call the Flask backend (/api/tip, /api/speak).

const TENSES = ["Present", "Preterite"];
const CATEGORIES = ["Regular ar/er/ir", "Irregular"];

// --- State ---------------------------------------------------------------
let VERBS = [];
let SUBJECTS = [];

const state = {
  // Both are now multi-select: each is a list of the currently-enabled options.
  selectedTenses: ["Present"],
  selectedCategories: ["Regular ar/er/ir"],
  currentVerb: null,
  currentTense: null, // the tense drawn for the current round
  currentSubject: null,
  feedback: null, // { isCorrect, isAccentError, correctAnswer, userAnswer }
  showChart: false,
  isSpeaking: false,
  stats: { correct: 0, total: 0 },
  errors: [], // { infinitive, tense, subject, userAnswer, correctAnswer }
  showErrors: false,
  retestMode: false, // true while cycling only through current errors
  retestComplete: false, // true once every error has been cleared in retest mode
  lastVerbInfinitive: null,
  // Every verb+tense+subject combination already practiced this session.
  // Cleared only when stats are reset, so a combination never repeats until then.
  seen: new Set(),
  exhausted: false, // true once every available combination has been shown
};

// --- Helpers (ported from utils.ts) --------------------------------------
function normalizeString(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function checkAnswer(userAnswer, correctAnswer) {
  const normUser = normalizeString(userAnswer.trim());
  const normCorrect = normalizeString(correctAnswer.trim());
  if (normUser === normCorrect) {
    if (userAnswer.trim() === correctAnswer.trim()) {
      return { isCorrect: true, isAccentError: false };
    }
    return { isCorrect: false, isAccentError: true };
  }
  return { isCorrect: false, isAccentError: false };
}

// --- Backend calls -------------------------------------------------------
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
}

// --- Round logic ---------------------------------------------------------
function comboKey(infinitive, tense, subject) {
  return `${infinitive}|${tense}|${subject}`;
}

// --- Error tracking --------------------------------------------------------
// Errors are keyed by verb+tense+subject so a repeated miss on the same
// combination updates the existing entry instead of duplicating it.
function findErrorIndex(infinitive, tense, subject) {
  return state.errors.findIndex(
    (e) => e.infinitive === infinitive && e.tense === tense && e.subject === subject
  );
}

function addOrUpdateError(entry) {
  const idx = findErrorIndex(entry.infinitive, entry.tense, entry.subject);
  if (idx >= 0) state.errors[idx] = entry;
  else state.errors.push(entry);
}

function removeError(infinitive, tense, subject) {
  const idx = findErrorIndex(infinitive, tense, subject);
  if (idx >= 0) state.errors.splice(idx, 1);
}

// Build the pool of candidates for retest mode: one entry per current error,
// resolved back to its full verb object.
function buildRetestCandidates() {
  return state.errors
    .map((e) => ({ verb: VERBS.find((v) => v.infinitive === e.infinitive), tense: e.tense, subject: e.subject }))
    .filter((c) => c.verb);
}

function enterRetestMode() {
  if (state.errors.length === 0) return;
  state.retestMode = true;
  state.retestComplete = false;
  state.showErrors = false;
  state.lastVerbInfinitive = null;
  startNewRound();
}

function exitRetestMode() {
  state.retestMode = false;
  state.retestComplete = false;
  state.lastVerbInfinitive = null;
  startNewRound();
}

function startRetestRound() {
  let candidates = buildRetestCandidates();

  if (candidates.length === 0) {
    state.retestComplete = true;
    state.currentVerb = null;
    state.currentTense = null;
    state.currentSubject = null;
    state.feedback = null;
    state.showChart = false;
    render();
    return;
  }
  state.retestComplete = false;

  if (state.lastVerbInfinitive && candidates.length > 1) {
    const filtered = candidates.filter((c) => c.verb.infinitive !== state.lastVerbInfinitive);
    if (filtered.length > 0) candidates = filtered;
  }

  const pick = getRandomItem(candidates);
  state.lastVerbInfinitive = pick.verb.infinitive;
  state.currentVerb = pick.verb;
  state.currentTense = pick.tense;
  state.currentSubject = pick.subject;
  state.feedback = null;
  state.showChart = false;

  render();
  const input = document.getElementById("answer-input");
  if (input) setTimeout(() => input.focus(), 0);
}

// Build every not-yet-seen verb/tense/subject combination allowed by the
// current tense + verb-type selections.
function buildCandidates() {
  const candidates = [];
  for (const verb of VERBS) {
    if (!state.selectedCategories.includes(verb.category)) continue;
    for (const tense of state.selectedTenses) {
      for (const subject of SUBJECTS) {
        const key = comboKey(verb.infinitive, tense, subject);
        if (!state.seen.has(key)) candidates.push({ verb, tense, subject, key });
      }
    }
  }
  return candidates;
}

function startNewRound() {
  if (state.retestMode) {
    startRetestRound();
    return;
  }

  let candidates = buildCandidates();

  // Nothing left to ask under the current selection: every combination has
  // been practiced. Prompt the user to reset stats to start over.
  if (candidates.length === 0) {
    state.exhausted = true;
    state.currentVerb = null;
    state.currentTense = null;
    state.currentSubject = null;
    state.feedback = null;
    state.showChart = false;
    render();
    return;
  }
  state.exhausted = false;

  // Soft-avoid two rounds in a row on the same verb, but only if doing so
  // still leaves something to pick.
  if (state.lastVerbInfinitive && candidates.length > 1) {
    const filtered = candidates.filter(
      (c) => c.verb.infinitive !== state.lastVerbInfinitive
    );
    if (filtered.length > 0) candidates = filtered;
  }

  const pick = getRandomItem(candidates);
  state.seen.add(pick.key); // mark used so it never repeats until reset

  state.lastVerbInfinitive = pick.verb.infinitive;
  state.currentVerb = pick.verb;
  state.currentTense = pick.tense;
  state.currentSubject = pick.subject;
  state.feedback = null;
  state.showChart = false;

  render();
  const input = document.getElementById("answer-input");
  if (input) setTimeout(() => input.focus(), 0);
}

async function handleSubmit() {
  if (state.feedback || !state.currentVerb || !state.currentSubject) return;
  const input = document.getElementById("answer-input");
  const userInput = input ? input.value : "";

  const correctAnswer =
    state.currentVerb.conjugations[state.currentTense][state.currentSubject];
  const result = checkAnswer(userInput, correctAnswer);

  state.feedback = {
    isCorrect: result.isCorrect,
    isAccentError: result.isAccentError,
    correctAnswer,
    userAnswer: userInput,
  };
  if (result.isCorrect) {
    state.stats.correct += 1;
    state.stats.total += 1;
    removeError(state.currentVerb.infinitive, state.currentTense, state.currentSubject);
  } else {
    // A miss on a combo that's already in the error list (e.g. missed again
    // during retest) doesn't count as a new miss — it's the same error.
    const alreadyMissed =
      findErrorIndex(state.currentVerb.infinitive, state.currentTense, state.currentSubject) >= 0;
    if (!alreadyMissed) {
      state.stats.total += 1;
    }
    addOrUpdateError({
      infinitive: state.currentVerb.infinitive,
      tense: state.currentTense,
      subject: state.currentSubject,
      userAnswer: userInput,
      correctAnswer,
    });
  }

  render(); // show feedback immediately, with a loading tip

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
}

// --- Rendering -----------------------------------------------------------
// Clean up a Gemini/Claude tip for display: drop any stray markdown asterisks,
// escape HTML, and keep line breaks (rendered via the `whitespace-pre-line` class).
function formatTip(tip) {
  return tip
    .replace(/\*/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function speakerBtn(text, size = 20) {
  return `<button class="speak-btn p-1 text-slate-400 hover:text-blue-600 transition-colors align-middle"
            data-text="${text.replace(/"/g, "&quot;")}" title="Listen"
            style="font-size:${size}px">&#128266;</button>`;
}

function render() {
  renderSettings();
  renderPractice();
  renderStats();
  renderChart();
  renderErrors();
  renderErrorTileButtons();
}

// Toggle a value in one of the multi-select lists, keeping at least one
// option enabled, then start a fresh round against the new pool. The `seen`
// history is intentionally preserved (only Reset Stats clears it).
function toggleSelection(list, value) {
  const idx = list.indexOf(value);
  if (idx >= 0) {
    if (list.length === 1) return; // never let the last option be turned off
    list.splice(idx, 1);
  } else {
    list.push(value);
  }
  startNewRound();
}

function renderSettings() {
  const tenseBox = document.getElementById("tense-buttons");
  const catBox = document.getElementById("category-buttons");
  const btn = (label, active) =>
    `<button class="px-4 py-3 rounded-xl font-medium transition-all text-left flex items-center gap-2 ${
      active
        ? "bg-blue-600 text-white shadow-md shadow-blue-100"
        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
    }">
      <span class="text-xs ${active ? "opacity-100" : "opacity-30"}">${active ? "&#9745;" : "&#9744;"}</span>
      <span>${label}</span>
    </button>`;

  tenseBox.innerHTML = TENSES.map((t) =>
    btn(t, state.selectedTenses.includes(t))
  ).join("");
  catBox.innerHTML = CATEGORIES.map((c) =>
    btn(c, state.selectedCategories.includes(c))
  ).join("");

  [...tenseBox.children].forEach((el, i) => {
    el.onclick = () => toggleSelection(state.selectedTenses, TENSES[i]);
  });
  [...catBox.children].forEach((el, i) => {
    el.onclick = () => toggleSelection(state.selectedCategories, CATEGORIES[i]);
  });

  // The tense is shown under the answer field, so the badge is only used for
  // the retest-mode indicator and stays hidden during normal practice.
  const badge = document.getElementById("tense-badge");
  badge.textContent = state.retestMode
    ? `Retest Mode · ${state.errors.length} Missed`
    : "";
  badge.classList.toggle("hidden", !state.retestMode);

  const exitBtn = document.getElementById("exit-retest");
  exitBtn.classList.toggle("hidden", !state.retestMode);
  exitBtn.onclick = exitRetestMode;
}

function renderPractice() {
  const card = document.getElementById("practice-card");
  const { currentVerb, currentSubject, feedback } = state;

  if (state.retestMode && state.retestComplete) {
    card.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 gap-4 fade-in text-center">
        <div class="text-5xl">&#127881;</div>
        <p class="text-xl font-bold text-slate-700">All errors cleared!</p>
        <p class="text-slate-500 max-w-sm">You've corrected every verb in your error list.</p>
        <button id="retest-return" class="mt-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95">
          Return to Practice
        </button>
      </div>`;
    const returnBtn = document.getElementById("retest-return");
    if (returnBtn) returnBtn.onclick = exitRetestMode;
    return;
  }

  if (state.exhausted) {
    card.innerHTML = `
      <div class="flex flex-col items-center justify-center h-64 gap-4 fade-in text-center">
        <div class="text-5xl">&#127881;</div>
        <p class="text-xl font-bold text-slate-700">You've practiced every combination!</p>
        <p class="text-slate-500 max-w-sm">Every verb, tense, and subject in your current selection has come up.
        Reset Stats to start a fresh round, or enable more tenses / verb types.</p>
        <button id="exhausted-reset" class="mt-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95">
          Reset &amp; Start Over
        </button>
      </div>`;
    const resetBtn = document.getElementById("exhausted-reset");
    if (resetBtn) resetBtn.onclick = resetStats;
    return;
  }

  if (!currentVerb || !currentSubject) {
    card.innerHTML =
      '<div class="flex items-center justify-center h-64 text-slate-400">Loading practice set...</div>';
    return;
  }

  const meaningRow = feedback
    ? `<p class="text-slate-400 italic text-lg capitalize fade-in">${currentVerb.meaning}</p>`
    : `<p class="text-slate-200 italic text-lg capitalize">(Translation hidden)</p>`;

  let feedbackBlock = "";
  if (feedback) {
    const tipInner = !feedback.tipLoaded
      ? `<div class="flex items-center justify-center gap-2 italic text-slate-400">
           <span class="w-2 h-2 bg-slate-300 rounded-full bounce-dot"></span>
           <span class="w-2 h-2 bg-slate-300 rounded-full bounce-dot" style="animation-delay:0.15s"></span>
           <span class="w-2 h-2 bg-slate-300 rounded-full bounce-dot" style="animation-delay:0.3s"></span>
         </div>`
      : feedback.tip
      ? `<div class="italic text-center leading-relaxed text-slate-500 whitespace-pre-line">${formatTip(feedback.tip)}</div>`
      : "";

    const body = feedback.isCorrect
      ? `<div class="text-center">
           <p class="text-green-700 font-bold text-xl">&#10004; Correct!</p>
           <div class="mt-2 flex items-center justify-center gap-2">
             <span class="text-slate-600">Well done:</span>
             <span class="font-bold text-green-700 text-lg">${feedback.correctAnswer}</span>
             ${speakerBtn(feedback.correctAnswer, 18)}
           </div>
         </div>`
      : `<div class="text-center">
           <p class="text-red-700 font-bold text-xl">&#10008; ${
             feedback.isAccentError ? "Accent Error" : "Incorrect"
           }</p>
           ${
             feedback.isAccentError
               ? '<p class="text-amber-600 font-semibold mt-1 text-sm">Accurate accents are required!</p>'
               : ""
           }
           <div class="mt-2 flex items-center justify-center gap-2">
             <span class="text-slate-600">Correct spelling:</span>
             <span class="font-bold text-red-700 text-lg underline decoration-wavy decoration-red-300">${feedback.correctAnswer}</span>
             ${speakerBtn(feedback.correctAnswer, 18)}
           </div>
         </div>`;

    feedbackBlock = `
      <div class="w-full mt-4 flex flex-col items-center fade-in">
        <div class="p-6 rounded-2xl w-full max-w-md ${
          feedback.isCorrect ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"
        }">
          ${body}
          <div class="mt-6 pt-4 border-t border-slate-200 text-slate-600 text-sm">${tipInner}</div>
        </div>
        <button id="next-btn" class="mt-8 px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95">
          Next Verb &rarr;
        </button>
      </div>`;
  } else {
    feedbackBlock = `
      <button id="check-btn" class="mt-4 px-10 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all active:scale-95 shadow-lg shadow-slate-200">
        Check Answer
      </button>`;
  }

  const inputBorder = feedback
    ? feedback.isCorrect
      ? "border-green-500 text-green-600"
      : "border-red-500 text-red-600"
    : "border-slate-200 focus:border-blue-400 text-slate-500";

  card.innerHTML = `
    <div class="mb-4">
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
      </div>
      ${feedbackBlock}
    </div>`;

  // Wire events
  const input = document.getElementById("answer-input");
  if (input && !feedback) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    });
  }
  const checkBtn = document.getElementById("check-btn");
  if (checkBtn) checkBtn.onclick = handleSubmit;
  const nextBtn = document.getElementById("next-btn");
  if (nextBtn) nextBtn.onclick = startNewRound;
  const chartToggle = document.getElementById("chart-toggle");
  if (chartToggle)
    chartToggle.onclick = () => {
      state.showChart = !state.showChart;
      renderChart();
    };

  wireSpeakButtons(card);
}

function renderStats() {
  const { correct, total } = state.stats;
  document.getElementById("stat-correct").textContent = correct;
  // Mirrors the "Retest Mode · N Missed" count: currently-unresolved errors.
  document.getElementById("stat-incorrect").textContent = state.errors.length;
  document.getElementById("stat-accuracy").textContent =
    (total > 0 ? Math.round((correct / total) * 100) : 0) + "%";
}

function renderErrors() {
  const panel = document.getElementById("errors-panel");
  if (!state.showErrors) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");

  const body = document.getElementById("errors-body");
  body.innerHTML = state.errors.length
    ? state.errors
        .slice()
        .reverse()
        .map(
          (err) => `
      <div class="p-4 rounded-2xl border bg-red-50 border-red-100 flex items-center justify-between gap-4">
        <div>
          <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">${err.infinitive} &middot; ${err.tense} &middot; ${err.subject}</div>
          <div class="text-sm text-slate-500">You wrote: <span class="font-semibold text-red-600">${err.userAnswer || "(blank)"}</span></div>
        </div>
        <div class="text-right">
          <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">Correct</div>
          <div class="font-bold text-green-700">${err.correctAnswer}</div>
        </div>
      </div>`
        )
        .join("")
    : '<p class="text-slate-400 text-center py-8">No errors yet &mdash; keep it up!</p>';

  const retestBtn = document.getElementById("errors-retest");
  retestBtn.disabled = state.errors.length === 0;
  retestBtn.classList.toggle("opacity-40", state.errors.length === 0);
  retestBtn.classList.toggle("cursor-not-allowed", state.errors.length === 0);

  document.getElementById("errors-close").onclick = () => {
    state.showErrors = false;
    renderErrors();
  };
}

function renderChart() {
  const panel = document.getElementById("chart-panel");
  if (!state.showChart || !state.currentVerb) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  document.getElementById(
    "chart-title"
  ).innerHTML = `&#128214; ${state.currentVerb.infinitive} (${state.currentTense})`;

  const body = document.getElementById("chart-body");
  body.innerHTML = SUBJECTS.map((subj) => {
    const conj = state.currentVerb.conjugations[state.currentTense][subj];
    const active = subj === state.currentSubject;
    return `<div class="p-4 rounded-2xl border ${
      active ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-slate-50 border-slate-100"
    }">
      <div class="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-1">${subj}</div>
      <div class="flex items-center justify-between gap-2">
        <div class="text-xl font-bold ${active ? "text-blue-700" : "text-slate-700"}">${conj}</div>
        ${speakerBtn(conj, 14)}
      </div>
    </div>`;
  }).join("");

  document.getElementById("chart-close").onclick = () => {
    state.showChart = false;
    renderChart();
  };
  wireSpeakButtons(body);
}

function wireSpeakButtons(root) {
  root.querySelectorAll(".speak-btn").forEach((btn) => {
    btn.onclick = () => speakText(btn.dataset.text);
  });
}

// --- Init ----------------------------------------------------------------
// Reset clears the score *and* the seen-combination history, so every verb/
// tense/subject becomes available to be asked again.
function resetStats() {
  state.stats = { correct: 0, total: 0 };
  state.errors = [];
  state.showErrors = false;
  state.retestMode = false;
  state.retestComplete = false;
  state.seen = new Set();
  state.lastVerbInfinitive = null;
  state.exhausted = false;
  renderErrors();
  renderErrorTileButtons();
  startNewRound(); // repopulate the pool and show a new question
}

document.getElementById("reset-stats").onclick = resetStats;

document.getElementById("menu-view").onclick = () => {
  state.showErrors = true;
  renderErrors();
};
document.getElementById("menu-retest").onclick = () => {
  enterRetestMode();
};
document.getElementById("errors-retest").onclick = () => {
  state.showErrors = false;
  renderErrors();
  enterRetestMode();
};

function renderErrorTileButtons() {
  const retestBtn = document.getElementById("menu-retest");
  retestBtn.disabled = state.errors.length === 0;
  retestBtn.classList.toggle("opacity-40", state.errors.length === 0);
  retestBtn.classList.toggle("cursor-not-allowed", state.errors.length === 0);
}

async function init() {
  const res = await fetch("/api/verbs");
  const data = await res.json();
  VERBS = data.verbs;
  SUBJECTS = data.subjects;
  startNewRound();
}

init();
