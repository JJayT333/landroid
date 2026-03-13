#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
DEFAULT_PORT=8421
PORT="${PORT:-$DEFAULT_PORT}"

URL="http://localhost:${PORT}/"
SERVER_PID=""
trap '[[ -n "${SERVER_PID}" ]] && kill "$SERVER_PID" 2>/dev/null || true' EXIT

for candidate in "$PORT" $(seq "$DEFAULT_PORT" "$((DEFAULT_PORT + 20))"); do
  URL="http://localhost:${candidate}/"
  python3 -m http.server "$candidate" >/tmp/landroid-server.log 2>&1 &
  SERVER_PID=$!
  sleep 0.2
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    PORT="$candidate"
    break
  fi
  kill "$SERVER_PID" 2>/dev/null || true
  SERVER_PID=""
done

if [[ -z "${SERVER_PID}" ]]; then
  echo "Failed to start server on ports ${DEFAULT_PORT}-${DEFAULT_PORT}+20. See /tmp/landroid-server.log"
  exit 1
fi

sleep 0.8
echo "LANDroid running at: $URL"
if command -v open >/dev/null 2>&1; then
  open "$URL" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 || true
fi
wait $SERVER_PID
