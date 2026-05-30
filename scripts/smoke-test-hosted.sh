#!/usr/bin/env bash
# Post-deploy smoke test for landroid.abstractmapping.com
#
# Run this after Amplify shows "Available" for the custom domain.
# Exits 0 if all checks pass, 1 on any failure.
#
# Usage:  bash scripts/smoke-test-hosted.sh
# Override: HOST=staging.example.com bash scripts/smoke-test-hosted.sh
# Cognito override:
#   COGNITO_REGION=us-east-1 COGNITO_USER_POOL_ID=us-east-1_... bash scripts/smoke-test-hosted.sh

set -uo pipefail

HOST="${HOST:-landroid.abstractmapping.com}"
BASE="https://${HOST}"
COGNITO_REGION="${COGNITO_REGION:-us-east-1}"
COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_TWeBB7xvQ}"
COGNITO_METADATA="https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/openid-configuration"
COGNITO_JWKS="https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json"
FAIL=0

pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=1; }
info() { printf "  \033[36m·\033[0m %s\n" "$1"; }

printf "\n== Smoke test: %s ==\n\n" "$BASE"

# 1. Root loads, returns 200, serves HTML.
printf "[1/6] Root page serves HTML\n"
ROOT=$(curl -s -o /tmp/landroid-root.html -w "%{http_code}" "$BASE/" || true)
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
printf "\n[2/6] Security headers present\n"
HEADERS=$(curl -s -I "$BASE/" || true)
for h in "strict-transport-security" "content-security-policy" "x-content-type-options" "x-frame-options"; do
  if printf "%s" "$HEADERS" | grep -qi "^$h:"; then
    pass "$h"
  else
    fail "missing $h header"
  fi
done

# 3. AI proxy enforces auth.
printf "\n[3/6] /api/ai/* rejects unauthenticated requests\n"
CODE=$(curl -s -o /tmp/landroid-ai.txt -w "%{http_code}" -X POST "$BASE/api/ai/chat/completions" \
  -H "content-type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"ping"}]}' || true)
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

# 4. Backend spine route exists and enforces auth beyond health.
printf "\n[4/6] /api/spine/* health and auth boundary\n"
SPINE_HEALTH=$(curl -s -o /tmp/landroid-spine-health.txt -w "%{http_code}" "$BASE/api/spine/health" || true)
if [[ "$SPINE_HEALTH" == "200" ]] && grep -q "landroid-backend-spine" /tmp/landroid-spine-health.txt; then
  pass "GET /api/spine/health → 200"
else
  fail "GET /api/spine/health → $SPINE_HEALTH (expected 200 with landroid-backend-spine JSON)"
  info "body: $(head -c 200 /tmp/landroid-spine-health.txt 2>/dev/null || true)"
fi

SPINE_SESSION=$(curl -s -o /tmp/landroid-spine-session.txt -w "%{http_code}" "$BASE/api/spine/session" || true)
case "$SPINE_SESSION" in
  401|403)
    pass "GET /api/spine/session → $SPINE_SESSION (auth enforced)"
    ;;
  404)
    fail "GET /api/spine/session → 404 — the Amplify rewrite rule for /api/spine/<*> is missing or wrong"
    ;;
  200)
    fail "GET /api/spine/session → 200 WITHOUT a token — auth is NOT being enforced, do not ship"
    ;;
  *)
    fail "GET /api/spine/session → $SPINE_SESSION (expected 401/403)"
    info "body: $(head -c 200 /tmp/landroid-spine-session.txt 2>/dev/null || true)"
    ;;
esac

SPINE_VALIDATE=$(curl -s -o /tmp/landroid-spine-validate.txt -w "%{http_code}" -X POST "$BASE/api/spine/validate-records" \
  -H "content-type: application/json" \
  -d '{"records":[]}' || true)
case "$SPINE_VALIDATE" in
  401|403)
    pass "POST /api/spine/validate-records → $SPINE_VALIDATE (auth enforced)"
    ;;
  404)
    fail "POST /api/spine/validate-records → 404 — the Amplify rewrite rule for /api/spine/<*> is missing or wrong"
    ;;
  200)
    fail "POST /api/spine/validate-records → 200 WITHOUT a token — auth is NOT being enforced, do not ship"
    ;;
  *)
    fail "POST /api/spine/validate-records → $SPINE_VALIDATE (expected 401/403)"
    info "body: $(head -c 200 /tmp/landroid-spine-validate.txt 2>/dev/null || true)"
    ;;
esac

OVERSIZE_PAYLOAD=$(printf '{"records":["%*s"]}' 262144 '')
SPINE_OVERSIZE=$(curl -s -o /tmp/landroid-spine-oversize.txt -w "%{http_code}" -X POST "$BASE/api/spine/validate-records" \
  -H "content-type: application/json" \
  -d "$OVERSIZE_PAYLOAD" || true)
if [[ "$SPINE_OVERSIZE" == "413" ]]; then
  pass "POST /api/spine/validate-records oversized body → 413"
else
  fail "POST /api/spine/validate-records oversized body → $SPINE_OVERSIZE (expected 413)"
  info "body: $(head -c 200 /tmp/landroid-spine-oversize.txt 2>/dev/null || true)"
fi

# 5. SPA fallback serves index.html for unknown paths.
printf "\n[5/6] SPA fallback for client-side routes\n"
FALLBACK=$(curl -s -o /tmp/landroid-fallback.html -w "%{http_code}" "$BASE/some-deep-view-that-does-not-exist" || true)
if [[ "$FALLBACK" == "200" ]] && grep -q "LANDroid" /tmp/landroid-fallback.html; then
  pass "unknown path → index.html"
else
  fail "unknown path → $FALLBACK (SPA catch-all rewrite not wired)"
fi

# 6. Cognito user-pool issuer metadata is reachable.
printf "\n[6/6] Cognito user-pool metadata reachable\n"
COGNITO_META=$(curl -s -o /dev/null -w "%{http_code}" "$COGNITO_METADATA" || true)
if [[ "$COGNITO_META" == "200" ]]; then
  pass "Cognito OIDC metadata endpoint → 200"
else
  fail "Cognito OIDC metadata endpoint → ${COGNITO_META:-000} (pool ID or region mismatch)"
fi

COGNITO=$(curl -s -o /dev/null -w "%{http_code}" "$COGNITO_JWKS" || true)
if [[ "$COGNITO" == "200" ]]; then
  pass "Cognito JWKS endpoint → 200"
else
  fail "Cognito JWKS endpoint → ${COGNITO:-000} (pool ID or region mismatch)"
fi

printf "\n"
if [[ $FAIL -eq 0 ]]; then
  printf "\033[32mAll smoke tests passed.\033[0m Manual: open %s, sign in, confirm the app loads, then ask the AI a question.\n\n" "$BASE"
  exit 0
else
  printf "\033[31mOne or more smoke tests failed.\033[0m See DEPLOYMENT_GUIDE.md Step 6 for remediation.\n\n"
  exit 1
fi
