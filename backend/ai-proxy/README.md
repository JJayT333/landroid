# LANDroid AI Proxy — Lambda

Minimal OpenAI proxy for the hosted LANDroid instance. Cognito-authenticated,
single endpoint: `POST /chat/completions`. Hardcoded `gpt-4o-mini`.

The Lambda Function URL uses auth type `NONE`; the handler verifies Cognito ID
tokens itself. CORS is still configured for the hosted origin, but CORS is not
a replay defense if an ID token is stolen.

## Environment variables

| Name | Source |
| --- | --- |
| `COGNITO_USER_POOL_ID` | Cognito console after pool creation |
| `COGNITO_CLIENT_ID`    | App client ID on the same pool |
| `OPENAI_API_KEY`       | Pasted once at deploy time; consider AWS Secrets Manager for rotation |
| `USAGE_TABLE_NAME`     | DynamoDB table for durable daily token counts (`landroid-ai-usage` in the deploy guide) |
| `ALLOW_IN_MEMORY_USAGE_STORE` | Local smoke-test escape hatch only; do not set in hosted deploys |

## Build and package

```bash
cd backend/ai-proxy
npm install
npm run bundle   # produces lambda.zip
```

Use `npm run bundle` or `npm run package` for deployable zips. The bundle includes
`dist`, `package.json`, and runtime `node_modules`; a zip that only contains
`handler.js` will fail because the handler imports helper modules and the DynamoDB
SDK.

## Deploy (first time, console click-ops)

1. Lambda console → **Create function** → Author from scratch
   - Name: `landroid-ai-proxy`
   - Runtime: **Node.js 22.x**
   - Architecture: arm64
2. Upload `lambda.zip` (Code → Upload from → .zip file)
3. Runtime settings → Handler: `handler.handler`
4. Configuration → Environment variables → add the four above
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
