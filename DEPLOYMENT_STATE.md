# LANDroid Deployment State

Point-in-time hosted deployment map for the current POC.

Last updated: 2026-05-19.

## Frontend

- AWS service: Amplify Hosting
- AWS region: `us-east-1`
- Amplify app ID: `d11pv0mh1atit4`
- Source repository: `JJayT333/landroid`
- Production branch: `main`
- Public URL: `https://landroid.abstractmapping.com`
- Branch URL: `https://main.d11pv0mh1atit4.amplifyapp.com`
- Deploy behavior: merging to `main` triggers an Amplify frontend rebuild and
  redeploy.

Required Amplify build environment variables:

```text
VITE_COGNITO_DOMAIN=us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=6os4uiu0b46pf74nhbrm5gsg0v
VITE_COGNITO_REDIRECT_URI=https://landroid.abstractmapping.com/
VITE_COGNITO_USER_POOL_ID=us-east-1_TWeBB7xvQ
```

## AI Proxy

- AWS service: Lambda
- AWS region: `us-east-1`
- Function name: `landroid-ai-proxy`
- Runtime: Node.js 22.x
- Architecture: `arm64`
- Handler: `handler.handler`
- Function URL host:
  `xmx5aqm2lbpqkpzm4kyeqazhlu0cdxra.lambda-url.us-east-1.on.aws`
- Amplify rewrite: `/api/ai/<*>` proxies to the Lambda Function URL.

Required Lambda environment variables:

```text
COGNITO_USER_POOL_ID=us-east-1_TWeBB7xvQ
COGNITO_CLIENT_ID=6os4uiu0b46pf74nhbrm5gsg0v
OPENAI_API_KEY=<stored in AWS only>
USAGE_TABLE_NAME=landroid-ai-usage
```

Lambda deploy behavior:

- Frontend changes auto-deploy from `main`.
- Lambda changes under `backend/ai-proxy` do not auto-deploy yet.
- To update Lambda manually:

```bash
cd backend/ai-proxy
npm run bundle
```

Then upload `backend/ai-proxy/lambda.zip` to `landroid-ai-proxy`.

## Usage Tracking

- AWS service: DynamoDB
- AWS region: `us-east-1`
- Table name: `landroid-ai-usage`
- Partition key: `sub` (String)
- Sort key: `day` (String)
- TTL attribute: `ttl`
- Lambda role needs `dynamodb:UpdateItem` on this table.

## Cognito

- AWS service: Cognito
- AWS region: `us-east-1`
- User pool ID: `us-east-1_TWeBB7xvQ`
- App client ID: `6os4uiu0b46pf74nhbrm5gsg0v`
- Hosted UI domain:
  `us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com`
- Callback URL: `https://landroid.abstractmapping.com/`
- Sign-out URL: `https://landroid.abstractmapping.com/`

## Verification

Latest Sales Deck frontend deployment verified:

- Date: 2026-05-19
- Commit: `88a8967` (`Add native Sales Deck view (#80)`)
- Hosted bundle check confirmed `https://landroid.abstractmapping.com` serves
  the native `Sales Deck` code.

Automated hosted smoke:

```bash
bash scripts/smoke-test-hosted.sh
```

Manual hosted smoke:

1. Open `https://landroid.abstractmapping.com`.
2. Sign in with Cognito.
3. Confirm the app loads and the hosted user menu appears.
4. Open `Ask LANDroid AI` and send `hello`.
5. Confirm CloudWatch logs show an authenticated `evt: "request"` and
   DynamoDB records a usage row.
6. Use `Demo Data` to load `Crackbaby Carnival — Demo`.
