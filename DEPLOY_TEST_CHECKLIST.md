# LANDroid Test Deploy Checklist

Use this checklist after local validation passes and before inviting any tester.
It is intentionally operational and assumes the current target is the trusted
POC deploy at `https://landroid.abstractmapping.com`.

## 1. Local Repo Preflight

Run from the repo root:

```bash
npm run deploy:check
npm run lint
npm test
cd backend/ai-proxy
npm test
npx tsc -p tsconfig.json --noEmit
npm run bundle
cd ../spine
npm ci
npm test
npm run build
npm run bundle
cd ../..
```

Expected:

- `npm run deploy:check` passes.
- `amplify-rewrites.json` keeps `.landroid`, `.pdf`, and `.pptx` static assets
  out of the SPA fallback.
- Root tests pass.
- Backend proxy tests pass.
- `backend/ai-proxy/lambda.zip` exists and contains `handler.js`,
  `usage-store.js`, `request-policy.js`, `package.json`, and
  `node_modules/@aws-sdk/client-dynamodb/package.json`.
- Backend spine tests pass.
- `backend/spine/lambda.zip` exists and contains
  `backend/spine/src/lambda.js`, `backend/spine/src/handler.js`,
  `src/backend-spine/contracts.js`, `package.json`,
  `node_modules/aws-jwt-verify/package.json`, and
  `node_modules/zod/package.json`.

## 2. Git Checkpoint

Develop on a non-`main` branch, then merge through a PR. Amplify deploys the
frontend from `main`, so do not push half-finished work there. Before touching
AWS, checkpoint the exact source and docs changes that support the deploy:

```bash
git status
git add CHANGELOG.md CONTINUATION-PROMPT.md DEPLOYMENT_GUIDE.md DEPLOYMENT_STATE.md DEPLOY_TEST_CHECKLIST.md SECURITY.md TESTING.md amplify-rewrites.json backend/ai-proxy backend/spine src scripts package.json
git commit -m "chore(deploy): checkpoint test deploy readiness"
git push origin <your-branch>
```

Do not include generated `dist`, `dist-node`, or ignored Lambda build output in
the commit.

## 3. DynamoDB Usage Table

Create a table:

- Table name: `landroid-ai-usage`
- Partition key: `sub` (String)
- Sort key: `day` (String)
- TTL attribute: `ttl`

Then grant the Lambda execution role:

```json
{
  "Effect": "Allow",
  "Action": "dynamodb:UpdateItem",
  "Resource": "arn:aws:dynamodb:us-east-1:<account-id>:table/landroid-ai-usage"
}
```

## 4. Lambda AI Proxy

Upload `backend/ai-proxy/lambda.zip` to `landroid-ai-proxy`.

Required Lambda settings:

- Runtime: Node.js 22.x
- Architecture: arm64
- Handler: `handler.handler`
- Memory: 512 MB
- Timeout: 2 minutes
- Function URL auth: `NONE`
- Function URL invoke mode: `RESPONSE_STREAM`
- CORS origin: `https://landroid.abstractmapping.com`
- CORS methods: `POST`
- CORS headers: `authorization, content-type`

Required environment variables:

```text
COGNITO_USER_POOL_ID=us-east-1_TWeBB7xvQ
COGNITO_CLIENT_ID=6os4uiu0b46pf74nhbrm5gsg0v
OPENAI_API_KEY=<paste in AWS only>
USAGE_TABLE_NAME=landroid-ai-usage
```

Do not set `ALLOW_IN_MEMORY_USAGE_STORE` in AWS.

## 5. Backend Spine Lambda

Upload `backend/spine/lambda.zip` to `landroid-backend-spine`.

Required Lambda settings:

- Runtime: Node.js 22.x
- Architecture: arm64
- Handler: `backend/spine/src/lambda.handler`
- Memory: 128 MB
- Timeout: 10 seconds
- Function URL auth: `NONE`
- Function URL invoke mode: `BUFFERED`
- CORS origin: `https://landroid.abstractmapping.com`
- CORS methods: `GET, POST`
- CORS headers: `authorization, content-type`
- Resource policy allows both `lambda:InvokeFunctionUrl` with
  `FunctionUrlAuthType=NONE` and `lambda:InvokeFunction` with
  `InvokedViaFunctionUrl=true`

Required environment variables:

```text
COGNITO_USER_POOL_ID=us-east-1_TWeBB7xvQ
COGNITO_CLIENT_ID=6os4uiu0b46pf74nhbrm5gsg0v
```

This Lambda must not receive project records outside validation probes, document
bytes, OCR text, AI prompts, or owner PII.

## 6. Amplify Frontend

Connect/deploy branch `main`.

Build environment variables:

```text
VITE_COGNITO_DOMAIN=us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=6os4uiu0b46pf74nhbrm5gsg0v
VITE_COGNITO_REDIRECT_URI=https://landroid.abstractmapping.com/
VITE_COGNITO_USER_POOL_ID=us-east-1_TWeBB7xvQ
```

Generate paste-ready rewrites after both Lambdas give you Function URLs:

```bash
bash scripts/render-amplify-rewrites.sh <ai-lambda-function-url-host-or-url> <spine-lambda-function-url-host-or-url>
```

Paste the rendered JSON into Amplify Hosting -> Rewrites and redirects -> JSON
editor. The `/api/ai/<*>` and `/api/spine/<*>` rewrites must come before the
SPA catch-all.

## 7. Cognito

Verify the app client has:

- Callback URL: `https://landroid.abstractmapping.com/`
- Sign-out URL: `https://landroid.abstractmapping.com/`
- OAuth flow: authorization code
- Scopes: `openid email`

Create or confirm the invited test user.

## 8. Smoke Test

Run:

```bash
bash scripts/smoke-test-hosted.sh
```

Manual pass criteria:

- Login screen appears.
- Cognito sign-in redirects back to LANDroid.
- Navbar shows the hosted user menu.
- The hidden backend-spine startup check does not block app load.
- AI panel says it is server-managed.
- A simple AI prompt streams a response.
- DynamoDB `landroid-ai-usage` has a row for your Cognito `sub` and today's
  `day`.
- Uploading a small CSV still parses for AI-guided row review.

## 9. Stop Conditions

Do not invite additional testers if any of these are true:

- `/api/ai/*` returns 404.
- `/api/ai/*` returns 200 without a token.
- `/api/spine/health` returns 404.
- `/api/spine/session` or `/api/spine/validate-records` returns 200 without a token.
- Oversized `/api/spine/validate-records` does not return 413.
- Lambda logs show `Missing env: USAGE_TABLE_NAME`.
- DynamoDB usage rows are not being written after an AI call.
- Cognito user-pool metadata or JWKS smoke checks fail.
- Cognito redirects to an `Invalid request` page.
- Amplify rewrites still contain `REPLACE_WITH_AI_FUNCTION_URL_HOST` or
  `REPLACE_WITH_SPINE_FUNCTION_URL_HOST`.
