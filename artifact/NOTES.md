# Artifact build — Práctica de Verbos

A standalone, single-file version of the quiz, published two ways: as a Claude
Artifact, and as the GitHub Pages site at
https://bigmax8808.github.io/Spanish-Verbs/.
**The local Flask app is not modified and is not involved at runtime.** This
directory only reads from it.

## Rebuilding

```bash
python3 artifact/build.py
```

Writes **two** files, same page, ~98 KB each:

- `artifact/conjugatepro.html` — a *fragment*, no `<!doctype>`/`<html>`/`<head>`/
  `<body>`. Claude Artifacts supplies those at publish time and rejects a file
  that brings its own. Republish this same path so the Artifact keeps its URL.
- `docs/index.html` — the same content as a complete document. GitHub Pages
  serves files verbatim with no wrapper, so this one carries its own `<head>`,
  including `<meta charset>` and the viewport meta. **Without the viewport meta
  mobile Safari falls back to a 980px layout viewport and renders the whole
  page at roughly 40% size** — that was a real bug, not a hypothetical.

Both are build output. Don't hand-edit either; change `static/app.js`,
`shell.html`, or `build.py` and rebuild. The document wrapper lives in
`as_document()`, which splits the fragment at its single `</style>` and fails
loudly if that split point ever moves.

The document head also carries the site's icons and link-preview tags, which the
fragment doesn't get — Artifacts sets its own icon and couldn't serve the image
files anyway. The artwork is the **macOS launcher icon**, so the site looks like
the same product on a home screen or in a shared link; regenerate the PNGs in
`docs/` with `python3 assets/make_icons.py` if it ever changes.

If `static/app.js` has changed in a way the build doesn't recognise, the build
**fails with the name of the patch that no longer matches** rather than emitting
a half-converted file. Fix that patch in `build.py` and rerun.

## Files

| File | What it is |
|---|---|
| `build.py` | Assembles the output. Holds every difference from the local app, as named patches. |
| `shell.html` | Page markup, from `templates/index.html` minus the Flask/CDN bits. Has `/*__MARKER__*/` slots the build fills. |
| `tailwind.css` | Generated stylesheet (see below). Checked in so a rebuild needs no npm. |
| `tailwind.config.js` | The config used to generate it. |
| `conjugatepro.html` | **Build output — the file that gets published.** Don't hand-edit. |

## The differences from the local app

All the quiz *logic* — round selection, accent-aware grading, retest mode, error
list, conjugation chart — is byte-identical to `static/app.js`. What differs:

1. **Verb data.** `fetch("/api/verbs")` → `data/verbs.json` inlined as `VERB_DATA`.
2. **Pronunciation.** `POST /api/speak` (macOS `say`) → browser `speechSynthesis`.
3. **Example sentences.** `POST /api/tip` (Claude Haiku) → **removed.** Artifacts
   can't reach an API. The tip text, its loading dots, and the divider above it
   are all gone; the feedback card ends after the result.
4. **Page shell.** Flask template + Tailwind CDN → `shell.html` + inlined CSS.
5. **Language.** The artifact is **bilingual** (English/Spanish, switchable from
   **Interface Language** at the foot of Settings — last because it's about the
   app's chrome, not about what gets practiced); the local app is English-only.
   Both languages live in
   the `UI` table injected by the "interface language table" patch, keyed by what
   each string *is* rather than by its English text, so neither language is the
   source and a third would just be one more table. `t(key)` looks a string up,
   falling back to English for any key a language is missing.
   - Static shell strings carry `data-i18n` (or `data-i18n-aria`) attributes and
     are filled in by `applyStaticStrings()`, called from `init()` and on switch.
   - Dynamic strings go through `t()` directly; the `TRANSLATIONS` table in
     `build.py` is what rewrites the local app's English literals into those
     calls, under the same exactly-once rule.
   - `setLanguage()` re-renders without touching the round, and carries a
     half-typed answer across so switching mid-question costs nothing.
   - Not translated, deliberately: verb **meanings** ("to speak"), which are the
     answer key rather than interface, and the tense/category **keys**, which
     index the verb data — only their labels change, via `tenseLabel()` /
     `categoryLabel()`.
   - The app's own name in the header and footer stays "Práctica de Verbos" in
     both languages, as a product name rather than a translated string.

### First-open defaults

English, settings panel open, Present tense, Regular verbs. Language and the
open panel are artifact-specific (`state.lang`, and no `is-collapsed` class in
`shell.html`); the tense and verb-type defaults are the local app's own. Nothing
is persisted between visits — every open starts from these.
6. **Layout** (part 5 of `build.py`, and `shell.html`) — the published version is
   phone-first where the local app isn't:
   - Titled **Práctica de Verbos**, no tagline.
   - The settings panel collapses behind its own heading below `lg`; from `lg` up
     a media query keeps it open regardless (the JS only toggles a class, so it
     never has to know the breakpoint). Its disclosure control states what the
     tap will do — **×** closes the open panel, **+** opens the collapsed one —
     in a filled blue circle. It replaced a thin grey chevron that read as
     decoration rather than as a control.
   - **The conjugation panel has a tense switcher.** It opens on the tense the
     question is asking (`state.chartTense` is set every time the panel opens, so
     browsing another tense never carries into the next verb), and any tense the
     verb data holds can be shown from there. Switching re-renders only the panel
     — the round, a typed answer and the seen-history are all untouched. The
     highlighted row marks the form being asked, so it shows only while the
     round's own tense is the one on screen.
   - That extra row costs height the shortest phones didn't have to spare, and a
     panel taller than the screen loses its own header and close button off the
     top, so the panel is capped at the viewport and the conjugations scroll
     inside it. Checked at 375×667, the tightest case.
   - The prompt is one line — `Ellos/Ellas/Ustedes — Pretérito` — stacked *above*
     a full-width field, instead of the local app's subject → field row with the
     tense underneath. That row can't fit a phone and clipped the field.
   - **Ver la conjugación** appears only *after* the answer is checked, under
     Siguiente verbo — before that it would just give the answer away. Because
     the practice card isn't re-rendered when the chart opens (that would wipe a
     half-typed answer), `syncChartToggleLabel()` updates its label in place.
   - No "(Translation hidden)" placeholder; the row keeps its height so revealing
     the meaning still doesn't shift the card.
   - **Reiniciar estadísticas** sits under the stat tiles, not in the settings.

### Scrolling

Two deliberate, opposite behaviours:

- **Changing a setting must not move the page.** It used to jump, because
  toggling a tense starts a new round and a new round focuses the answer field,
  and focusing scrolls. The focus calls now pass `preventScroll: true`. Anyone
  changing two settings in a row would otherwise be thrown down the page between
  each one.
- **Siguiente verbo scrolls the card to the top** so the new verb is the first
  thing on screen — `#practice-panel` (the id exists only for this) with
  `scrollIntoView({block:"start"})`. Instant rather than smooth: the verb should
  already be there when the user looks up. Verified against a scrollable window;
  note that smooth scrolling never completes under headless virtual time, which
  looks exactly like a broken scroll.

## Tailwind

The local app loads Tailwind from `cdn.tailwindcss.com`, which generates classes
in the browser at runtime. Artifacts block external requests, so the stylesheet
has to be generated ahead of time and inlined.

```bash
npx --yes tailwindcss@3.4.17 -c artifact/tailwind.config.js -i input.css -o artifact/tailwind.css
```

(where `input.css` is just the three `@tailwind base/components/utilities` lines.)

The config scans both `templates/index.html` and `static/app.js`, which matters —
most classes live in template literals inside the JS. Verified that the scan
catches them, including the arbitrary value `min-w-[140px]`.

**Regenerate the stylesheet whenever a new Tailwind class is added to either
file**, or that class will silently have no styling in the artifact.

⚠️ The config scans the *local app's* files only — not `shell.html` and not the
patch strings in `build.py`. A Tailwind class that exists solely in this
directory is never generated and will silently do nothing. So markup added here
may only use classes the local app already uses; anything else (the settings
collapse, the responsive prompt sizing) goes in the plain-CSS block at the top of
`shell.html`, which is inlined verbatim.

## Voice selection

Picking the first Spanish voice is wrong on macOS: novelty voices (Eddy, Flo,
Grandma, Grandpa, Reed, Rocko, Sandy, Shelley) sort ahead of Mónica. They all
carry a parenthesised language in their name — `Eddy (Spanish (Spain))` — where
the standard voices are plain (`Mónica`, `Paulina`), so `pickSpanishVoice()`
prefers a plain-named `es-ES` voice first. Verified it selects Mónica.

Note the local app's `_find_spanish_voice()` in `app.py` takes the first `es_*`
line from `say -v '?'` and may well hit a novelty voice for the same reason.
Not changed here — this directory doesn't touch the local app.

## Verified

Rendered from `file://` and exercised: correct/incorrect feedback, error list,
conjugation chart, settings toggles, mobile layout at 375px, no console errors,
speech synthesis speaking through Mónica.

Re-verified after the layout change at a true 375px, with the worst-case prompt
(`Ellos/Ellas/Ustedes — Pretérito`) forced: no horizontal overflow in the normal,
feedback, or chart-open states; settings collapse and reopen; the chart label
flips Show/Hide; at 1280px the settings panel is open and the disclosure icon
hidden.

Re-verified again after the tense switcher: the panel opens on the round's tense
after a Preterite-only round, switching to Present swaps the forms and the title
and drops the subject highlight, switching back restores it, the typed answer and
the Show/Hide label survive a switch, and closing and reopening returns to the
round's tense even after browsing another one. Both languages label the pills
(Present/Preterite, Presente/Pretérito). At 375×667 the panel header stays on
screen and the grid scrolls; at 1200px the settings icon is hidden and the panel
ignores the collapsed class. No console errors.

Checking a phone width needs a workaround: headless Chrome won't go below a
500px window, and the preview pane lays out at 981px whatever it's resized to.
Both were reporting a 375px screenshot that was really a wider layout cropped.
Nesting the page in a 375px-wide `<iframe>` inside a larger window gives a
genuine 375px layout viewport.

Not covered: iOS Safari, which gates `speechSynthesis` on a user gesture. The
speaker buttons are click-driven, so it should be fine, but it's untested.
