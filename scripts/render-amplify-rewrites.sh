#!/usr/bin/env bash
# Render Amplify rewrite JSON with real Lambda Function URL hosts.
#
# Usage:
#   bash scripts/render-amplify-rewrites.sh <ai-lambda-host-or-url> <spine-lambda-host-or-url>
#   bash scripts/render-amplify-rewrites.sh https://abc123.lambda-url.us-east-1.on.aws/ https://def456.lambda-url.us-east-1.on.aws/

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: bash scripts/render-amplify-rewrites.sh <ai-lambda-host-or-url> <spine-lambda-host-or-url>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

normalize_host() {
  local label="$1"
  local host="$2"
  host="${host#https://}"
  host="${host#http://}"
  host="${host%%/*}"

  if [[ -z "$host" || "$host" == *"REPLACE_WITH_"* ]]; then
    echo "ERROR: provide the concrete $label Lambda Function URL host, not the placeholder." >&2
    exit 1
  fi

  case "$host" in
    *.lambda-url.*.on.aws) ;;
    *)
      echo "WARNING: $label host '$host' does not look like a Lambda Function URL host." >&2
      ;;
  esac

  printf '%s' "$host"
}

AI_HOST="$(normalize_host "AI proxy" "$1")"
SPINE_HOST="$(normalize_host "backend spine" "$2")"

sed \
  -e "s/REPLACE_WITH_AI_FUNCTION_URL_HOST/$AI_HOST/g" \
  -e "s/REPLACE_WITH_SPINE_FUNCTION_URL_HOST/$SPINE_HOST/g" \
  "$ROOT/amplify-rewrites.json"
