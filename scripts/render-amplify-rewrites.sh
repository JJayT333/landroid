#!/usr/bin/env bash
# Render Amplify rewrite JSON with a real Lambda Function URL host.
#
# Usage:
#   bash scripts/render-amplify-rewrites.sh abc123.lambda-url.us-east-1.on.aws
#   bash scripts/render-amplify-rewrites.sh https://abc123.lambda-url.us-east-1.on.aws/

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/render-amplify-rewrites.sh <lambda-function-url-host-or-url>" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="$1"
HOST="${HOST#https://}"
HOST="${HOST#http://}"
HOST="${HOST%%/*}"

if [[ -z "$HOST" || "$HOST" == *"REPLACE_WITH_FUNCTION_URL_HOST"* ]]; then
  echo "ERROR: provide the concrete Lambda Function URL host, not the placeholder." >&2
  exit 1
fi

case "$HOST" in
  *.lambda-url.*.on.aws) ;;
  *)
    echo "WARNING: '$HOST' does not look like a Lambda Function URL host." >&2
    ;;
esac

sed "s/REPLACE_WITH_FUNCTION_URL_HOST/$HOST/g" "$ROOT/amplify-rewrites.json"
