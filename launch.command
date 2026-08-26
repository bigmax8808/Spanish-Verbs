#!/bin/bash
# ConjugatePro Spanish — desktop launcher.
# Double-click to start the local server and open the app in your browser.
# Keep the Terminal window open while using the app; close it (or press
# Ctrl+C) to quit the server.

export PORT=5050
URL="http://127.0.0.1:${PORT}"
APP_DIR="/Users/Max/Python/Spanish-Verbs"
PY="/Users/Max/Python/.venv/bin/python"

cd "$APP_DIR" || { echo "Could not find app folder: $APP_DIR"; read -r; exit 1; }

# Once the server is answering, open it in the default browser.
(
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null "$URL"; then
      open "$URL"
      break
    fi
    sleep 0.5
  done
) &

echo "Starting ConjugatePro Spanish at $URL"
echo "Keep this window open while you use the app. Close it (or press Ctrl+C) to quit."
echo

exec "$PY" app.py
