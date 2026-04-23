# LANDroid AI Proxy — Lambda

Minimal OpenAI proxy for the hosted LANDroid instance. Cognito-authenticated,
single endpoint: `POST /chat/completions`. Hardcoded `gpt-4o-mini`.

## Environment variables

| Name | Source |
| --- | --- |
| `COGNITO_USER_POOL_ID` | Cognito console after pool creation |
| `COGNITO_CLIENT_ID`    | App client ID on the same pool |
| `OPENAI_API_KEY`       | Pasted once at deploy time; consider AWS Secrets Manager for rotation |

## Build and package

```bash
cd backend/ai-proxy
npm install
npm run bundle   # produces lambda.zip
```

## Deploy (first time, console click-ops)

1. Lambda console → **Create function** → Author from scratch
   - Name: `landroid-ai-proxy`
   - Runtime: **Node.js 20.x**
   - Architecture: arm64
2. Upload `lambda.zip` (Code → Upload from → .zip file)
3. Runtime settings → Handler: `handler.handler`
4. Configuration → Environment variables → add the three above
5. Configuration → Function URL → **Create**
   - Auth type: **NONE** (JWT is verified inside the handler)
   - Invoke mode: **RESPONSE_STREAM**
   - CORS: allow origin `https://landroid.abstractmapping.com`, methods `POST`, headers `authorization, content-type`
6. Save the Function URL — Amplify will proxy `/api/ai/*` to it.

## Local test

```bash
# Cognito JWT needed. Easiest: sign in on the staging site and copy the id_token from localStorage.
curl -N -X POST "$LAMBDA_URL/chat/completions" \
  -H "authorization: Bearer $ID_TOKEN" \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}],"stream":true}'
```
