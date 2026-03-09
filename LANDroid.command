#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
PORT=8421
URL="http://localhost:${PORT}/"
python3 -m http.server "$PORT" >/tmp/landroid-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
sleep 1
if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi
wait $SERVER_PID
