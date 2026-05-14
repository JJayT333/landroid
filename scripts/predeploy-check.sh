#!/usr/bin/env bash
# Local pre-deploy checks for the hosted LANDroid POC.
#
# This does not call AWS. It verifies the repo-side artifacts that commonly
# break first deploys: frontend config files, Lambda bundle contents, package
# scripts, and placeholder rewrite state.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZIP="$ROOT/backend/ai-proxy/lambda.zip"
FAIL=0

cd "$ROOT"

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=1; }
info() { printf "  \033[36m·\033[0m %s\n" "$1"; }

has_file() {
  if [[ -f "$ROOT/$1" ]]; then
    pass "$1 exists"
  else
    fail "$1 is missing"
  fi
}

zip_has() {
  local path="$1"
  if unzip -l "$ZIP" "$path" >/dev/null 2>&1; then
    pass "lambda.zip contains $path"
  else
    fail "lambda.zip missing $path"
  fi
}

printf "\n== LANDroid hosted predeploy check ==\n\n"

printf "[1/6] Required repo files\n"
has_file "amplify.yml"
has_file "amplify-rewrites.json"
has_file "customHttp.yml"
has_file "backend/ai-proxy/package.json"
has_file "backend/ai-proxy/src/handler.ts"

printf "\n[2/6] Frontend build guard\n"
if grep -q "VITE_COGNITO_DOMAIN" "$ROOT/amplify.yml" \
  && grep -q "VITE_COGNITO_CLIENT_ID" "$ROOT/amplify.yml" \
  && grep -q "VITE_COGNITO_REDIRECT_URI" "$ROOT/amplify.yml"; then
  pass "amplify.yml requires Cognito build env vars"
else
  fail "amplify.yml does not guard required Cognito env vars"
fi

printf "\n[3/6] Lambda package script\n"
if node -e "const p=require('./backend/ai-proxy/package.json'); process.exit(p.scripts?.package === 'npm run bundle' ? 0 : 1)" \
  >/dev/null 2>&1; then
  pass "backend npm run package delegates to npm run bundle"
else
  fail "backend npm run package must delegate to npm run bundle"
fi

if node -e "const p=require('./backend/ai-proxy/package.json'); process.exit(p.dependencies?.['@aws-sdk/client-dynamodb'] ? 0 : 1)" \
  >/dev/null 2>&1; then
  pass "@aws-sdk/client-dynamodb dependency declared"
else
  fail "@aws-sdk/client-dynamodb dependency missing"
fi

printf "\n[4/6] Lambda zip contents\n"
if [[ -f "$ZIP" ]]; then
  pass "backend/ai-proxy/lambda.zip exists"
  info "$(ls -lh "$ZIP" | awk '{print "lambda.zip size: " $5}')"
  zip_has "handler.js"
  zip_has "usage-store.js"
  zip_has "request-policy.js"
  zip_has "package.json"
  zip_has "node_modules/@aws-sdk/client-dynamodb/package.json"
else
  fail "backend/ai-proxy/lambda.zip missing; run cd backend/ai-proxy && npm run bundle"
fi

printf "\n[5/6] Hosted usage-store policy\n"
if grep -q "USAGE_TABLE_NAME" "$ROOT/backend/ai-proxy/src/handler.ts" \
  && grep -q "ALLOW_IN_MEMORY_USAGE_STORE" "$ROOT/backend/ai-proxy/src/handler.ts"; then
  pass "handler requires durable usage table unless local fallback is explicit"
else
  fail "handler usage-store guard missing or incomplete"
fi

printf "\n[6/6] Amplify rewrite placeholder\n"
if grep -q "REPLACE_WITH_FUNCTION_URL_HOST" "$ROOT/amplify-rewrites.json"; then
  warn "repo template still has REPLACE_WITH_FUNCTION_URL_HOST, as expected"
  info "Render a paste-ready file with: bash scripts/render-amplify-rewrites.sh <lambda-url-host>"
else
  pass "amplify-rewrites.json has a concrete Function URL host"
fi

printf "\n"
if [[ $FAIL -eq 0 ]]; then
  printf "\033[32mPredeploy repo checks passed.\033[0m AWS console setup is still required.\n\n"
  exit 0
fi

printf "\033[31mPredeploy repo checks failed.\033[0m Fix the failed items before uploading/deploying.\n\n"
exit 1
