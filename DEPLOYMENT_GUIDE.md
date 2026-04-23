# LANDroid Deployment Guide

**Goal:** take LANDroid live at `https://landroid.abstractmapping.com` with Cognito login, OpenAI-backed AI via a server proxy, and a monthly cost of roughly $0–15 at POC usage.

**Architecture picked for POC:**

```
GoDaddy CNAME  landroid.abstractmapping.com
     │
     ▼
AWS Amplify Hosting  (React SPA; auto-deploys from GitHub)
     │
     ├──  /api/ai/*   ─ rewrite ─▶  Lambda Function URL  ─▶  OpenAI (gpt-4o-mini)
     │                             (verifies Cognito ID token)
     │
     └──  login flow  ─────────▶  Cognito Hosted UI
```

**No idle charges:** every service is pay-per-use. Expected POC bill is under $15/month, most of which is OpenAI tokens.

---

## Prerequisites

- AWS account signed in
- GoDaddy account signed in (domain `abstractmapping.com`)
- GitHub access to the `JJayT333/landroid` repo
- OpenAI API key in hand (do **not** paste into chat; we'll enter it only in AWS console)
- Region: **us-east-1** (Virginia) — required for Amplify-attached ACM certs and simplest for everything else.

---

## Step 0 — Safety: billing alarm ($5, 10 minutes)

Do this before anything else so a surprise can't run unchecked.

1. AWS console → **Billing and Cost Management** → **Billing preferences** → enable "Receive Free Tier usage alerts" and "Receive Billing alerts" (save).
2. AWS console → **CloudWatch** → change region to **us-east-1** (top-right — billing metrics only live here).
3. CloudWatch → **Alarms** → **All alarms** → **Create alarm**.
4. **Select metric** → Billing → Total Estimated Charge → `USD` → Select.
5. Conditions: **Greater than** `10`. Additional configuration → data points to alarm: `1 out of 1`.
6. Notification: **Create new topic** → name `landroid-billing` → email `Landroid@abstractmapping.com`. Create topic.
7. Name the alarm `landroid-budget-10usd`. Create.
8. Check your email and **confirm** the SNS subscription. (Alarm won't fire until confirmed.)
9. Repeat for a `$25` hard-stop alarm if you want two tiers. Optional.

---

## Step 1 — Cognito User Pool (15 minutes)

This is the login backend.

1. AWS console → **Cognito** (region us-east-1) → **Create user pool**.
2. **Application type:** `Single-page application (SPA)`.
3. **Name your application:** `LANDroid`.
4. **Options for sign-in identifiers:** check `Email`.
5. **Required attributes for sign-up:** `email`.
6. **Add a return URL:** `https://landroid.abstractmapping.com/`
   - You can also add `http://localhost:5173/` during development if you want to test the hosted path locally. Skip it for now unless needed.
7. Create.

**After creation, grab these values** (save them in a note — you'll need them in Step 2 and Step 4):

- **User pool ID** — looks like `us-east-1_XXXXXXXXX` (top of the pool page).
- **App client ID** — looks like a long alphanumeric string (App integration → App client list).
- **Cognito domain** — under **App integration → Domain**. You get a `*.auth.us-east-1.amazoncognito.com` hostname for free. If not auto-created, click **Actions → Create Cognito domain**, pick a prefix like `landroid-abstractmapping` → creates `landroid-abstractmapping.auth.us-east-1.amazoncognito.com`. Save the **full domain**.

**Pre-create the admin user** (so you can log in on day 1):

1. Pool → **Users** tab → **Create user**.
2. Sign-in method: `Email`.
3. Email: `Landroid@abstractmapping.com`.
4. Password: either auto-generate (emailed) or set a temporary one.
5. Mark `Send an email invitation` so Cognito emails you a login.
6. Create.

On first login you'll be prompted to set a permanent password.

---

## Step 2 — Lambda AI proxy (20 minutes)

### 2a. Build the package locally

```bash
cd backend/ai-proxy
npm install
npm run bundle
# produces backend/ai-proxy/lambda.zip
```

### 2b. Create the Lambda

1. AWS console → **Lambda** (us-east-1) → **Create function**.
2. **Author from scratch.**
3. Name: `landroid-ai-proxy`.
4. Runtime: **Node.js 20.x**. Architecture: **arm64** (cheapest).
5. Execution role: "Create a new role with basic Lambda permissions".
6. Create.

### 2c. Upload the code

1. Function → **Code** tab → **Upload from** → `.zip file` → select `backend/ai-proxy/lambda.zip`.
2. After upload, **Runtime settings → Edit** → Handler: `handler.handler` → Save.

### 2d. Environment variables

Function → **Configuration → Environment variables → Edit → Add**:

| Key | Value |
| --- | --- |
| `COGNITO_USER_POOL_ID` | `us-east-1_TWeBB7xvQ` |
| `COGNITO_CLIENT_ID` | `6os4uiu0b46pf74nhbrm5gsg0v` |
| `OPENAI_API_KEY` | paste your real OpenAI key here |

Save.

> **Upgrade path:** for production, move `OPENAI_API_KEY` to AWS Secrets Manager and have the Lambda read it at cold-start. For POC, a plain env var is fine and much simpler.

### 2e. Memory, timeout, streaming

Function → **Configuration → General configuration → Edit**:
- Memory: **512 MB**.
- Timeout: **2 min 0 sec** (OpenAI streaming needs more than the 3s default).
- Save.

### 2f. Function URL

Function → **Configuration → Function URL → Create function URL**:
- Auth type: **NONE** (we verify the Cognito JWT *inside* the handler).
- Invoke mode: **RESPONSE_STREAM** ← critical for streaming.
- CORS → **Configure CORS**:
  - Allow origin: `https://landroid.abstractmapping.com`
  - Allow methods: `POST`
  - Allow headers: `authorization, content-type`
  - Max age: `3600`
- Save.

**Copy the Function URL** (looks like `https://<random>.lambda-url.us-east-1.on.aws/`). You need it in Step 3.

---

## Step 3 — Amplify Hosting (20 minutes)

### 3a. Connect the repo

1. AWS console → **AWS Amplify** → **Create new app** → **Host web app**.
2. Source: **GitHub**. Authorize and pick `JJayT333/landroid`.
3. Branch: **`codex/landroid-checkpoint-2026-04-21`** (the branch that's already pushed with all the deployment wiring). You can switch to `main` later once you've merged.

### 3b. Build settings

Amplify auto-detects Vite. The `amplify.yml` committed at repo root will be used. Confirm:
- Base directory: `dist`
- Build command: `npm run build`

### 3c. Environment variables (build-time)

**Advanced settings → Environment variables → Add:**

| Key | Value |
| --- | --- |
| `VITE_COGNITO_DOMAIN` | `us-east-1twebb7xvq.auth.us-east-1.amazoncognito.com` |
| `VITE_COGNITO_CLIENT_ID` | `6os4uiu0b46pf74nhbrm5gsg0v` |
| `VITE_COGNITO_REDIRECT_URI` | `https://landroid.abstractmapping.com/` |

Save and deploy. First build takes ~3 minutes.

### 3d. API rewrite to Lambda

After the first deploy, Amplify app → **Hosting → Rewrites and redirects → Manage rewrites**:

| Source | Target | Type |
| --- | --- | --- |
| `/api/ai/<*>` | `https://<your-function-url>/<*>` | **200 (Rewrite)** |
| `/<*>` | `/index.html` | **200 (Rewrite)** |

The second row is the SPA fallback — it catches all other paths and returns `index.html` so client-side routing works. Order matters: the `/api/ai/*` rule must be above the SPA catch-all.

> **Gotcha:** when you paste the Function URL, **strip the trailing slash** and use `<*>` as the suffix so the path is forwarded.

### 3e. Custom headers (CSP, HSTS)

The `customHttp.yml` at the repo root will be picked up automatically on the next build. No console action needed.

Verify after next deploy: in Amplify → **Hosting → Custom headers**, you should see the rules.

---

## Step 4 — Custom domain `landroid.abstractmapping.com` (15 minutes + ~5 min DNS)

### 4a. Add the domain in Amplify

1. Amplify app → **Hosting → Custom domains → Add domain**.
2. Domain: `abstractmapping.com` → **Exclude root** → add subdomain **`landroid`** → **map to the deployed branch**.
3. Amplify gives you:
   - A **CloudFront validation CNAME** (for the ACM cert), and
   - A **CNAME for `landroid`** pointing at the Amplify default domain.
4. Leave this page open.

### 4b. Add the DNS records in GoDaddy

GoDaddy → **My Products → DNS (on `abstractmapping.com`) → Add record**:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `landroid` | (the Amplify-provided target for `landroid.abstractmapping.com`) | 1 hr |
| CNAME | (validation name from Amplify, e.g., `_abc123.landroid`) | (validation target from Amplify) | 1 hr |

**Important:** when GoDaddy asks for "name", paste only the prefix before `.abstractmapping.com`. If Amplify gives you `_abc123.landroid.abstractmapping.com`, in GoDaddy the name is `_abc123.landroid`.

### 4c. Wait for validation

- Cert validation usually finishes in 5–30 minutes.
- Amplify will flip from "Pending" to "Available".
- Visit `https://landroid.abstractmapping.com` — you should hit the LANDroid login screen.

---

## Step 5 — Smoke test

1. Open `https://landroid.abstractmapping.com`.
2. Login screen appears → **Sign in** → Cognito Hosted UI → enter `Landroid@abstractmapping.com` + the password you set on first login.
3. Redirected back to LANDroid → app renders.
4. Open the AI panel. Settings should say "Managed by the server. Model: gpt-4o-mini."
5. Ask a simple question like "hello, can you see the workspace?" — it should stream a reply.
6. Upload a small `.csv` and confirm the wizard still parses it.

If any step fails, check in order:
- **Login redirect fails with "Invalid request":** the `redirect_uri` in Cognito pool settings must exactly match `VITE_COGNITO_REDIRECT_URI`.
- **AI panel shows "Not found":** the `/api/ai/*` rewrite rule is missing or the Function URL is wrong.
- **AI returns 401:** the Lambda env vars `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` don't match the pool you logged into.
- **CSP error in DevTools console:** review `customHttp.yml` and adjust the `connect-src` directive.

---

## Step 6 — Everyday workflow

- **Local development:** `npm run dev` — no auth, no proxy, direct OpenAI/Ollama. Zero change from today.
- **Push a change:** `git push` to the branch Amplify is watching → auto-build → live in ~3 minutes.
- **Rollback:** Amplify app → Deployments → pick a previous green build → **Redeploy this version**. Atomic.
- **Add a beta tester:** Cognito pool → Users → Create user. Email the temp password. They'll be prompted to set a real one.
- **Shut everything down temporarily:** Amplify app → Hosting → Actions → Disable hosting. Flip back when ready.
- **Check costs:** Billing → Cost Explorer → filter by service. Expect: `$0` AWS most months; OpenAI shows up on your OpenAI dashboard separately.

---

## Known POC limits (by design)

These are intentional trade-offs to keep the first deploy cheap and small. They should be fixed before going beyond a handful of trusted users.

| Limit | Why it exists | When to address |
| --- | --- | --- |
| Single Cognito user pool, no groups/roles | Simplicity | When you need admin vs. user distinction |
| No per-project data isolation — browser IndexedDB only | Backend DB isn't built yet | Before two users share data |
| OpenAI key in Lambda env var, not Secrets Manager | One moving part, not two | When you want rotation |
| Daily token ceiling resets on Lambda cold start | In-memory counter | When budgets need to be durable |
| File uploads still stored in IndexedDB | No S3 yet | When files are big or shared |
| AI mutating tools disabled in hosted mode (read-only Q&A + import) | Approval boundary not yet built | When the proposal/approval UI ships |
| No structured audit log | Not urgent for solo use | Before multi-user |

---

## Appendix: verifying the pieces locally

Before you push to Amplify, you can smoke-test the code changes without any AWS:

```bash
npm install
npm run lint     # tsc strict pass
npm test -- --run
npm run build    # vite production build
```

All four should succeed before triggering an Amplify deploy.
