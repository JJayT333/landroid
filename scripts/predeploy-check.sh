#!/usr/bin/env bash
# Local pre-deploy checks for the hosted LANDroid POC.
#
# This does not call AWS. It verifies the repo-side artifacts that commonly
# break first deploys: frontend config files, Lambda bundle contents, package
# scripts, and placeholder rewrite state.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AI_ZIP="$ROOT/backend/ai-proxy/lambda.zip"
SPINE_ZIP="$ROOT/backend/spine/lambda.zip"
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
  local zip="$1"
  local path="$2"
  if unzip -l "$zip" "$path" >/dev/null 2>&1; then
    pass "$(basename "$(dirname "$zip")")/lambda.zip contains $path"
  else
    fail "$(basename "$(dirname "$zip")")/lambda.zip missing $path"
  fi
}

printf "\n== LANDroid hosted predeploy check ==\n\n"

printf "[1/7] Required repo files\n"
has_file "amplify.yml"
has_file "amplify-rewrites.json"
has_file "customHttp.yml"
has_file "backend/ai-proxy/package.json"
has_file "backend/ai-proxy/src/handler.ts"
has_file "backend/spine/package.json"
has_file "backend/spine/src/lambda.ts"
has_file "backend/spine/src/handler.ts"

printf "\n[2/7] Frontend build guard\n"
if grep -q "VITE_COGNITO_DOMAIN" "$ROOT/amplify.yml" \
  && grep -q "VITE_COGNITO_CLIENT_ID" "$ROOT/amplify.yml" \
  && grep -q "VITE_COGNITO_REDIRECT_URI" "$ROOT/amplify.yml" \
  && grep -q "VITE_COGNITO_USER_POOL_ID" "$ROOT/amplify.yml"; then
  pass "amplify.yml requires Cognito build env vars"
else
  fail "amplify.yml does not guard required Cognito env vars"
fi

printf "\n[3/7] Lambda package scripts\n"
if node -e "const p=require('./backend/ai-proxy/package.json'); process.exit(p.scripts?.package === 'npm run bundle' ? 0 : 1)" \
  >/dev/null 2>&1; then
  pass "AI proxy npm run package delegates to npm run bundle"
else
  fail "AI proxy npm run package must delegate to npm run bundle"
fi

if node -e "const p=require('./backend/ai-proxy/package.json'); process.exit(p.dependencies?.['@aws-sdk/client-dynamodb'] ? 0 : 1)" \
  >/dev/null 2>&1; then
  pass "AI proxy @aws-sdk/client-dynamodb dependency declared"
else
  fail "AI proxy @aws-sdk/client-dynamodb dependency missing"
fi

if node -e "const p=require('./backend/spine/package.json'); process.exit(p.scripts?.package === 'npm run bundle' ? 0 : 1)" \
  >/dev/null 2>&1; then
  pass "backend spine npm run package delegates to npm run bundle"
else
  fail "backend spine npm run package must delegate to npm run bundle"
fi

if node -e "const p=require('./backend/spine/package.json'); process.exit(p.dependencies?.['aws-jwt-verify'] && p.dependencies?.zod ? 0 : 1)" \
  >/dev/null 2>&1; then
  pass "backend spine Cognito/schema dependencies declared"
else
  fail "backend spine missing aws-jwt-verify or zod dependency"
fi

printf "\n[4/7] AI proxy Lambda zip contents\n"
if [[ -f "$AI_ZIP" ]]; then
  pass "backend/ai-proxy/lambda.zip exists"
  info "$(ls -lh "$AI_ZIP" | awk '{print "AI proxy lambda.zip size: " $5}')"
  zip_has "$AI_ZIP" "handler.js"
  zip_has "$AI_ZIP" "usage-store.js"
  zip_has "$AI_ZIP" "request-policy.js"
  zip_has "$AI_ZIP" "package.json"
  zip_has "$AI_ZIP" "node_modules/@aws-sdk/client-dynamodb/package.json"
else
  fail "backend/ai-proxy/lambda.zip missing; run cd backend/ai-proxy && npm run bundle"
fi

printf "\n[5/7] Backend spine Lambda zip contents\n"
if [[ -f "$SPINE_ZIP" ]]; then
  pass "backend/spine/lambda.zip exists"
  info "$(ls -lh "$SPINE_ZIP" | awk '{print "backend spine lambda.zip size: " $5}')"
  zip_has "$SPINE_ZIP" "backend/spine/src/lambda.js"
  zip_has "$SPINE_ZIP" "backend/spine/src/handler.js"
  zip_has "$SPINE_ZIP" "src/backend-spine/contracts.js"
  zip_has "$SPINE_ZIP" "package.json"
  zip_has "$SPINE_ZIP" "node_modules/aws-jwt-verify/package.json"
  zip_has "$SPINE_ZIP" "node_modules/zod/package.json"
else
  fail "backend/spine/lambda.zip missing; run cd backend/spine && npm ci && npm run bundle"
fi

printf "\n[6/7] Hosted usage-store policy\n"
if grep -q "USAGE_TABLE_NAME" "$ROOT/backend/ai-proxy/src/handler.ts" \
  && grep -q "ALLOW_IN_MEMORY_USAGE_STORE" "$ROOT/backend/ai-proxy/src/handler.ts"; then
  pass "handler requires durable usage table unless local fallback is explicit"
else
  fail "handler usage-store guard missing or incomplete"
fi

printf "\n[7/7] Amplify rewrite placeholders\n"
if grep -q "REPLACE_WITH_AI_FUNCTION_URL_HOST" "$ROOT/amplify-rewrites.json" \
  && grep -q "REPLACE_WITH_SPINE_FUNCTION_URL_HOST" "$ROOT/amplify-rewrites.json"; then
  warn "repo template still has AI/spine Function URL placeholders, as expected"
  info "Render a paste-ready file with: bash scripts/render-amplify-rewrites.sh <ai-lambda-url-host> <spine-lambda-url-host>"
else
  pass "amplify-rewrites.json has concrete Function URL hosts"
fi

printf "\n"
if [[ $FAIL -eq 0 ]]; then
  printf "\033[32mPredeploy repo checks passed.\033[0m For a fresh deploy, apply concrete Function URL rewrites before hosted smoke.\n\n"
  exit 0
fi

printf "\033[31mPredeploy repo checks failed.\033[0m Fix the failed items before uploading/deploying.\n\n"
exit 1
