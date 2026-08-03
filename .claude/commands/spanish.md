---
description: Launch the ConjugatePro Spanish quiz app in the Claude browser preview
---

Launch the local Flask Spanish-verbs quiz app in the Claude browser preview pane.

Steps:
1. Start (or reuse) the dev server using the `flask-spanish-verbs` config from
   `.claude/launch.json` via the `preview_start` tool with `{ "name": "flask-spanish-verbs" }`.
   The server serves the app and honors an auto-assigned port.
2. Once it's running, take a screenshot of the opened tab so I can confirm the
   app loaded (the settings panel + a verb prompt should be visible).
3. Reply with the preview URL and a one-line confirmation that it's ready.

Notes:
- If a preview server for this app is already running, reuse it rather than starting a second one.
- Do not modify any project files — this command only launches and displays the app.
- This is the in-session Claude-browser preview only; the Desktop "Verbos de Español" .app
  is the separate launcher for the user's normal browser.
