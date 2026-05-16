#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

SERVER_PID=""
PORT="${PORT:-5173}"
URL="http://localhost:${PORT}/"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}

finish() {
  local status=$?
  cleanup

  if [[ "$status" -ne 0 ]]; then
    echo
    echo "LANDroid could not start (exit code $status)."
    echo "If this is a fresh GitHub ZIP, make sure Node.js/npm is installed, then run LANDroid.command again."
    read -r -p "Press Return to close this window..." _ || true
  fi

  exit "$status"
}

trap finish EXIT

if ! command -v npm >/dev/null 2>&1; then
  echo "LANDroid requires Node.js/npm before it can start."
  echo "Install the current Node.js LTS from https://nodejs.org/, then run LANDroid.command again."
  exit 1
fi

if [[ ! -x "node_modules/.bin/vite" ]]; then
  echo "Installing LANDroid dependencies. This can take a few minutes on the first run from a GitHub ZIP."
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
fi

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

wait_for_server() {
  if ! command -v curl >/dev/null 2>&1; then
    sleep 2
    return
  fi

  for _ in $(seq 1 60); do
    if curl -fsS "$URL" >/dev/null 2>&1; then
      return
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      wait "$SERVER_PID"
      return $?
    fi
    sleep 0.5
  done

  echo "Timed out waiting for LANDroid at $URL."
  return 1
}

wait_for_server

if command -v open >/dev/null 2>&1; then
  open "$URL" || true
fi

wait "$SERVER_PID"
