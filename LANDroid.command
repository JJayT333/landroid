#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-5173}"
URL="http://localhost:${PORT}/"

# Stop any existing dev server on the target port so we always open the latest run.
if command -v lsof >/dev/null 2>&1; then
  EXISTING_PIDS="$(lsof -ti :"$PORT" || true)"
  if [[ -n "$EXISTING_PIDS" ]]; then
    echo "Stopping existing process(es) on port $PORT: $EXISTING_PIDS"
    kill $EXISTING_PIDS 2>/dev/null || true
    sleep 0.5
  fi
fi

echo "Starting LANDroid dev server on $URL"
npm run dev -- --host 127.0.0.1 &
SERVER_PID=$!

cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

# Give Vite a moment to start before opening the browser.
sleep 2

if command -v open >/dev/null 2>&1; then
  open -a "Google Chrome" "$URL" || open "$URL" || true
fi

wait "$SERVER_PID"
