#!/usr/bin/env bash
# Post-deploy smoke test for landroid.abstractmapping.com
#
# Run this after Amplify shows "Available" for the custom domain.
# Exits 0 if all checks pass, 1 on any failure.
#
# Usage:  bash scripts/smoke-test-hosted.sh
# Override: HOST=staging.example.com bash scripts/smoke-test-hosted.sh

set -uo pipefail

HOST="${HOST:-landroid.abstractmapping.com}"
BASE="https://${HOST}"
FAIL=0

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=1; }
info() { printf "  \033[36m·\033[0m %s\n" "$1"; }

printf "\n== Smoke test: %s ==\n\n" "$BASE"

# 1. Root loads, returns 200, serves HTML.
printf "[1/5] Root page serves HTML\n"
ROOT=$(curl -s -o /tmp/landroid-root.html -w "%{http_code}" "$BASE/" || echo "000")
if [[ "$ROOT" == "200" ]]; then
  pass "GET / → 200"
  if grep -q "LANDroid" /tmp/landroid-root.html; then
    pass "response contains \"LANDroid\""
  else
    fail "response body missing \"LANDroid\" brand string"
  fi
else
  fail "GET / → $ROOT (expected 200)"
fi

# 2. Security headers applied.
printf "\n[2/5] Security headers present\n"
HEADERS=$(curl -s -I "$BASE/" || true)
for h in "strict-transport-security" "content-security-policy" "x-content-type-options" "x-frame-options"; do
  if printf "%s" "$HEADERS" | grep -qi "^$h:"; then
    pass "$h"
  else
    fail "missing $h header"
  fi
done

# 3. AI proxy enforces auth.
printf "\n[3/5] /api/ai/* rejects unauthenticated requests\n"
CODE=$(curl -s -o /tmp/landroid-ai.txt -w "%{http_code}" -X POST "$BASE/api/ai/chat/completions" \
  -H "content-type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}' || echo "000")
case "$CODE" in
  401|403)
    pass "POST /api/ai/* → $CODE (auth enforced)"
    ;;
  404)
    fail "POST /api/ai/* → 404 — the Amplify rewrite rule for /api/ai/<*> is missing or wrong"
    ;;
  200)
    fail "POST /api/ai/* → 200 WITHOUT a token — auth is NOT being enforced, do not ship"
    ;;
  *)
    fail "POST /api/ai/* → $CODE (expected 401/403)"
    info "body: $(head -c 200 /tmp/landroid-ai.txt 2>/dev/null || true)"
    ;;
esac

# 4. SPA fallback serves index.html for unknown paths.
printf "\n[4/5] SPA fallback for client-side routes\n"
FALLBACK=$(curl -s -o /tmp/landroid-fallback.html -w "%{http_code}" "$BASE/some-deep-view-that-does-not-exist" || echo "000")
if [[ "$FALLBACK" == "200" ]] && grep -q "LANDroid" /tmp/landroid-fallback.html; then
  pass "unknown path → index.html"
else
  fail "unknown path → $FALLBACK (SPA catch-all rewrite not wired)"
fi

# 5. Cognito domain is reachable.
printf "\n[5/5] Cognito hosted UI reachable\n"
COGNITO_HOST="us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com"
COGNITO=$(curl -s -o /dev/null -w "%{http_code}" "https://${COGNITO_HOST}/.well-known/jwks.json" || echo "000")
if [[ "$COGNITO" == "200" ]]; then
  pass "Cognito JWKS endpoint → 200"
else
  fail "Cognito JWKS endpoint → $COGNITO (pool domain wrong or region mismatch)"
fi

printf "\n"
if [[ $FAIL -eq 0 ]]; then
  printf "\033[32mAll smoke tests passed.\033[0m Manual: open %s, sign in, ask the AI a question.\n\n" "$BASE"
  exit 0
else
  printf "\033[31mOne or more smoke tests failed.\033[0m See DEPLOYMENT_GUIDE.md Step 5 for remediation.\n\n"
  exit 1
fi
