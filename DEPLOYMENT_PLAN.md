# LANDroid Hosted Deployment Plan

Date: 2026-04-21
Status: Planning only; no hosting or backend implementation has been started in
this document.
Audience: product owner and future implementation chats

## 1. Executive Summary

LANDroid can be put online safely, but the current codebase is still a
single-user, local-first browser app. The secure path is **not** to expose the
existing browser-only AI/provider flows directly on the public internet.

Recommended target:

- Frontend on **AWS Amplify Hosting** or **CloudFront + private S3 origin**
- Auth with **Amazon Cognito User Pools**
- A thin **Node/TypeScript backend** on **AWS App Runner**
- Canonical project storage as **versioned workspace snapshots in S3**
- Small relational metadata store in **Postgres** (`RDS` / `Aurora Serverless v2`)
- All AI requests routed through the backend; **no OpenAI/Anthropic keys in the
  browser**
- Uploaded files handled as untrusted input with strict limits and isolated
  parsing
- Security controls at the edge: **CloudFront**, **AWS WAF**, response security
  headers, and per-user audit logs

This plan intentionally keeps the first hosted version compatible with the
current app structure by treating the workspace as a versioned server-side
snapshot. That is the safest way to get all current surfaces working online
before deciding whether to normalize everything into live multi-user database
tables.

## 2. Current Codebase Constraints

The current repo is not yet a secure hosted app:

- Workspace autosave is browser-local and boots from IndexedDB in
  `src/main.tsx`.
- Security notes explicitly describe LANDroid as a local-first single-user app
  and say hosted/cloud mode should use a backend AI proxy.
- AI providers are currently resolved in browser code in `src/ai/client.ts`.
- Anthropic currently uses browser mode with
  `anthropic-dangerous-direct-browser-access`.
- OpenAI/Anthropic keys are session-only now, but they are still entered in the
  browser and used from the browser.
- Uploads (`.landroid`, `.csv`, `.xlsx`, PDFs, images, GeoJSON) are treated as
  untrusted, but the hosted upload path does not exist yet.
- The production `xlsx` dependency still needs containment / replacement.

Implication: **hosting the current frontend is easy; hosting it safely with all
features and cloud AI requires a backend boundary first.**

## 3. Recommended Target Architecture

### 3.1 Frontend

- Deploy the existing React/Vite app with **AWS Amplify Hosting** for the
  simplest branch-based CI/CD path.
- If more manual control is preferred, use **CloudFront** with a private S3
  origin and **Origin Access Control (OAC)** instead of a public S3 website.
- Serve the app from `app.<your-domain>` and the API from `api.<your-domain>`.

Why:

- Amplify Hosting supports SPA deployments and branch environments well.
- CloudFront gives HTTPS, caching, custom domains, WAF attachment, and response
  header policies.
- OAC is the current AWS-recommended way to secure S3 origins behind
  CloudFront.

### 3.2 Authentication

- Use **Amazon Cognito User Pools** as the primary authentication system.
- Use authorization code flow with PKCE for the SPA.
- Start with **admin-created users only** for the first private beta. Do not
  enable public self-signup by default.
- Model project roles separately in app data:
  - `owner`
  - `editor`
  - `viewer`

### 3.3 Backend

- Add a separate **Node/TypeScript API service** in the repo and run it on
  **AWS App Runner**.
- Keep the backend small at first:
  - auth/session verification
  - project load/save/versioning
  - presigned upload/download URL creation
  - AI proxy
  - audit/event logging
  - background-job kickoff

Why App Runner:

- It fits a TypeScript web service without forcing a Lambda-only design.
- It is simpler than ECS/Fargate for an early secure app.
- It supports environment variables from Secrets Manager and VPC access for
  RDS/private services.
- Streaming AI responses are more natural here than in a heavily fragmented
  function-only architecture.

### 3.4 Persistence

#### Canonical server-side project storage

Start with **versioned snapshot persistence**, not a full live collaborative
database rewrite.

- Store the canonical workspace payload as a versioned project snapshot in S3.
- Track project metadata in Postgres:
  - project id
  - project name
  - owner
  - created/updated timestamps
  - latest snapshot key
  - version number
  - sharing/permissions

This allows the current app’s data model to come online without rewriting every
store and mutation path immediately.

#### Blob/document storage

- Store PDFs, images, GeoJSON, workbook uploads, and export artifacts in S3.
- Use presigned URLs with short expirations for upload/download.
- Keep blob references out of browser-only IndexedDB as the source of truth.

#### Database

- Use **Postgres** on **RDS** or **Aurora Serverless v2** for:
  - users / project membership
  - project metadata
  - audit log index
  - import job records
  - AI request ledger
  - future collaboration metadata

The domain state can stay snapshot-based at first. Normalize later only if
collaboration/search/reporting justify it.

### 3.5 Background Jobs

Add asynchronous workers for heavy or risky tasks:

- workbook parsing/import
- PDF/blob extraction
- large export creation
- virus scanning / validation pipeline

Implementation options:

- `SQS + App Runner worker`
- `SQS + Lambda`

For LANDroid, a worker queue is preferred over doing heavy parsing inside the
main web request path.

## 4. AI Architecture Plan

## 4.1 Hard rule

**Do not expose OpenAI or Anthropic API keys to the browser in the hosted
version.**

All hosted AI traffic should go through a backend endpoint such as:

- `POST /api/ai/chat`
- `POST /api/ai/analyze-workbook`

### 4.2 Provider abstraction

Introduce a server-side provider router with a stable interface:

- `OpenAIProvider`
- `AnthropicProvider`
- optional `BedrockProvider`

Keep the frontend unaware of vendor details. The frontend should send:

- project id
- user message
- selected tool mode
- requested provider alias or default routing policy

The backend should decide:

- which provider/model is allowed in the current environment
- timeout / max token budget
- prompt redaction policy
- audit logging
- fallback behavior

### 4.3 Provider choice strategy

#### Option A: Direct OpenAI backend integration

Good when:

- you want the newest OpenAI models directly
- you are comfortable keeping a provider secret in AWS Secrets Manager

Requirements:

- OpenAI key only on backend
- separate staging and production OpenAI projects
- usage alerts / spend caps
- `safety_identifier` per end user if the feature becomes broadly exposed

#### Option B: Direct Anthropic backend integration

Good when:

- you want Claude directly
- you want Anthropic workspaces and spend segmentation

Requirements:

- Anthropic key only on backend
- separate workspaces / keys per environment or use case
- stronger prompt-injection mitigation on tool-enabled routes
- verify retention controls and zero-data-retention availability under the
  intended commercial/API terms before go-live

#### Option C: Claude through Amazon Bedrock

Good when:

- you want to stay AWS-native
- you want IAM, Guardrails, and inference control in AWS
- Claude is the leading candidate

Benefits:

- no direct Anthropic secret in the app path
- Bedrock Guardrails can evaluate prompts and responses
- IAM can enforce which models/guardrails are allowed

#### Option D: Unified provider gateway

Optional, not required.

- Keep the backend adapter pattern as the default design.
- If multi-provider switching and failover become a top priority, evaluate a
  provider gateway service later.
- This can reduce code churn, but it adds another dependency/vendor layer.

### 4.4 AI safety controls required before go-live

- Server-side tool approval boundary for mutating actions
- Per-request timeout and cancellation
- Max input size and max output tokens
- Prompt/data separation for workbook content
- Input validation before tool execution
- Output validation before mutation or persistence
- Per-user and per-project audit log
- Rate limiting on AI endpoints
- Spend limits and anomaly alerting

### 4.5 AI observability

Log, at minimum:

- request id
- user id
- project id
- provider
- model
- input token count / estimated size
- output token count
- duration
- success / timeout / cancel / blocked
- whether tools were proposed or executed

Do **not** log raw API keys, full sensitive prompts, or whole uploaded
documents by default.

## 5. Security Controls Required

## 5.1 Edge and transport

- HTTPS everywhere
- CloudFront in front of the app and public assets
- **AWS WAF** attached to CloudFront and/or API
- Rate-based rules on:
  - `/api/ai/*`
  - `/api/upload/*`
  - auth endpoints
- CloudFront response headers policy with:
  - `Content-Security-Policy`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `X-Frame-Options` or `frame-ancestors` in CSP

## 5.2 Identity and access

- Cognito user pools for auth
- No anonymous write access
- Project-level authorization in backend
- Least-privilege IAM roles
- Separate AWS accounts or at least separate environments for:
  - dev
  - staging
  - prod

## 5.3 Secrets

- Store all provider keys and database credentials in **AWS Secrets Manager**
- Encrypt with KMS-managed keys
- Never store secrets in frontend env vars
- Rotate secrets on a schedule and on incident

## 5.4 Storage and encryption

- S3 with encryption at rest
- RDS/Aurora encryption at rest
- TLS for all data in transit
- Private S3 buckets only
- Short-lived presigned URLs for uploads/downloads
- Explicit object key naming strategy that avoids guessable paths

## 5.5 Upload and document safety

Treat every upload as hostile:

- hard max file sizes
- MIME/type validation
- extension validation
- workbook parsing in isolated worker/backend task
- PDF and image processing outside the request thread
- reject oversized or malformed blobs early
- consider antivirus/malware scanning for document uploads

## 5.6 App security model changes

Before internet exposure:

- add a real CSP
- remove browser-direct cloud AI provider calls
- remove any lingering sensitive browser persistence
- add CSRF protection if cookie sessions are used
- otherwise prefer bearer-token auth with backend validation
- add origin checks and CORS restrictions

## 5.7 Auditability

Add immutable or append-only audit events for:

- sign-in and auth failures
- project creation, rename, delete, restore
- document upload/delete
- AI mutation proposal / approval / execution
- export/download of sensitive project artifacts
- permission changes

## 6. Required Codebase Upgrades Before Secure Hosting

### 6.1 Frontend

- Add authenticated API client layer
- Add login/logout/session handling
- Add project picker backed by cloud metadata, not only local autosave
- Keep IndexedDB as optional cache, not canonical storage
- Add conflict/version handling UI when server version changes

### 6.2 Backend

- New API service
- JWT validation against Cognito
- Project authorization middleware
- S3 presigned URL issuance
- AI proxy endpoints
- audit/event logging
- health check endpoints

### 6.3 Persistence model

- Introduce server snapshot schema/versioning
- Move blob references to S3 object ids
- Add `project_version` / optimistic locking
- Add migration/version fields for future server-side schema evolution

### 6.4 AI layer

- Move provider resolution from browser to backend
- Replace direct browser `createOpenAI()` / `createAnthropic()` usage
- Remove `anthropic-dangerous-direct-browser-access`
- Add provider allowlists per environment
- Add moderation / screening / guardrail layer
- Add proposal-only path for destructive mutations

### 6.5 File-import hardening

- contain or replace `xlsx`
- move workbook import to isolated execution path
- add size/time limits
- add better structured upload errors

### 6.6 Testing and release engineering

- Add deployment smoke tests
- Add auth integration tests
- Add upload/AI rate-limit tests
- Add backup/restore tests
- Add environment promotion flow: dev -> staging -> prod

## 7. Rollout Phases

## Phase 0: Secure Hosted Preview

Goal:

- prove the frontend can be hosted cleanly
- no real cloud persistence yet

Deliverables:

- Amplify Hosting or CloudFront deployment
- custom domain + TLS
- WAF + security headers
- hosted preview environment

Limitations:

- browser-local data only
- no real multi-device sync
- no cloud AI yet, or AI restricted to internal preview only

## Phase 1: Private Beta With Real Backend

Goal:

- all major app surfaces work online for authenticated users

Deliverables:

- Cognito auth
- App Runner API
- S3 document storage
- project snapshot save/load
- AI proxy
- audit log
- import job pipeline

This is the first phase that should be considered a true online LANDroid.

## Phase 2: Hardened Production

Goal:

- make the hosted version safe enough for broader use

Deliverables:

- provider failover policy
- spend alerts and cost dashboards
- stronger AI proposal/approval UX
- upload scanning / deeper validation
- staged rollout controls
- disaster recovery / restore drill
- formal monitoring + on-call alerts

## Phase 3: Optional Collaboration / Data Normalization

Goal:

- move beyond snapshot-centric storage if collaboration/search/reporting demand it

Possible upgrades:

- selective normalization of project records into Postgres
- row-level collaborative updates
- background indexing/search
- finer-grained sharing

Do not start here. Only do this if the hosted private beta proves valuable.

## 8. Recommended Initial Environment Layout

- `landroid-dev`
  - cheapest environment
  - throwaway data allowed
- `landroid-staging`
  - production-like auth and AI config
  - masked or synthetic project data
- `landroid-prod`
  - restricted access
  - strict IAM
  - separate secrets
  - separate provider accounts/projects/workspaces where practical

## 9. Recommended Initial AWS Stack

### Minimum secure target

- Amplify Hosting or CloudFront
- Route 53
- Cognito User Pools
- App Runner
- S3
- RDS / Aurora Serverless v2
- Secrets Manager
- KMS
- CloudWatch
- WAF

### Optional later

- Bedrock
- SQS
- Lambda workers
- EventBridge scheduled jobs
- GuardDuty / Security Hub depending on account maturity

## 10. Go / No-Go Checklist Before Public Exposure

Do not expose the hosted app broadly until all of the following are true:

- [ ] No direct OpenAI/Anthropic browser calls remain in hosted mode.
- [ ] No provider secrets are stored in the browser.
- [ ] Hosted auth is required for non-demo access.
- [ ] Project load/save works against server storage.
- [ ] Upload limits are enforced server-side.
- [ ] `xlsx` path is contained or replaced.
- [ ] WAF rules are attached and tested.
- [ ] CSP and security headers are active.
- [ ] AI mutation approval is app-enforced, not prompt-enforced.
- [ ] Audit logs exist for AI mutations and project changes.
- [ ] Staging and production environments use separate secrets.
- [ ] Backup/restore of a project has been tested.
- [ ] Provider spend alerts are configured.

## 11. Recommended Provider Decision

If the goal is **maximum simplicity now**:

- Start with **OpenAI** or **Anthropic direct API** on the backend.
- Keep the adapter interface clean.

If the goal is **AWS-native governance and likely Claude usage**:

- Strongly consider **Anthropic Claude through Amazon Bedrock**.

If the goal is **fast multi-provider swapping/failover later**:

- Keep the backend abstraction and evaluate a provider gateway only after the
  secure beta is live.

## 12. Suggested Order Of Work

1. Hosted preview deployment
2. Backend service skeleton
3. Cognito auth
4. Server-side project save/load snapshots
5. S3 file storage
6. AI proxy
7. Upload hardening / worker isolation
8. WAF / headers / observability
9. Staging environment
10. Private beta

## 13. Research Notes / Primary Sources

AWS:

- Amplify Hosting overview: <https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html>
- Amplify Hosting getting started: <https://docs.aws.amazon.com/amplify/latest/userguide/getting-started.html>
- Cognito user pools: <https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html>
- Cognito getting started: <https://docs.aws.amazon.com/cognito/latest/developerguide/getting-started-user-pools.html>
- App Runner environment variables / secrets:
  <https://docs.aws.amazon.com/apprunner/latest/dg/env-variable-manage.html>
- App Runner VPC access:
  <https://docs.aws.amazon.com/apprunner/latest/dg/network-vpc.html>
- App Runner health checks:
  <https://docs.aws.amazon.com/apprunner/latest/dg/manage-configure-healthcheck.html>
- Secrets Manager best practices:
  <https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html>
- CloudFront response headers policy:
  <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/understanding-response-headers-policies.html>
- CloudFront private S3 origin with OAC:
  <https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html>
- WAF rate-based rules:
  <https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html>
- S3 presigned URLs:
  <https://docs.aws.amazon.com/boto3/latest/guide/s3-presigned-urls.html>
- RDS encryption:
  <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html>
- Bedrock quickstart:
  <https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html>
- Bedrock Claude models:
  <https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards-anthropic.html>
- Bedrock Guardrails:
  <https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html>
- Enforcing Bedrock guardrails in IAM:
  <https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-permissions-id.html>

OpenAI:

- API key safety:
  <https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety>
- Production best practices:
  <https://platform.openai.com/docs/guides/production-best-practices/model-overview>
- Safety best practices:
  <https://platform.openai.com/docs/guides/safety-best-practices/constrain-user-input-and-limit-output-tokens.pls>
- Safety identifiers / checks:
  <https://platform.openai.com/docs/guides/safety-checks>
- Enterprise privacy:
  <https://openai.com/policies/api-data-usage-policies>

Anthropic:

- API getting started / authentication:
  <https://docs.anthropic.com/en/api/getting-started>
- Claude quickstart:
  <https://docs.anthropic.com/en/docs/quickstart>
- Guardrail advice for jailbreaks/prompt injection:
  <https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks>
- Prompt leak reduction:
  <https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-prompt-leak>
- Workspaces / spend segmentation:
  <https://docs.anthropic.com/en/api/getting-started>
- Usage and cost API:
  <https://docs.anthropic.com/en/api/usage-cost-api>

Optional provider-routing reference:

- AI Gateway overview:
  <https://vercel.com/docs/ai-gateway>
- Provider timeouts:
  <https://vercel.com/docs/ai-gateway/models-and-providers/provider-timeouts>
- Model fallbacks:
  <https://vercel.com/docs/ai-gateway/models-and-providers/model-fallbacks>
