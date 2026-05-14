# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.

## Current Branch

`audit-verification-pre-aws`

## Current Workstream

Second-opinion audit verification and autonomous follow-up fixes for the
pre-AWS remediation branch. The verification target was `f4a85ce`; the current
branch head is `80acb19`, which adds `AUDIT_VERIFICATION_PROMPT.md`.

## Last Completed

- Wrote `AUDIT_VERIFICATION_REPORT.md` with per-finding verdicts:
  7 confirmed, 4 partial, 0 disputed, 1 incidental finding.
- Added attach-conveyance invariant coverage for root source, child source,
  unlinked source, same-parent resize, and mineral/NPRI mismatch cases.
- Added persistence DB-key tests proving workspace/canvas saves use active
  per-user keys and do not silently load or migrate legacy `default` rows.
- Added Lambda proxy handler integration tests for invalid Cognito JWT rejection
  and successful streamed OpenAI forwarding with verified-sub body policy.
- Changed `backend/ai-proxy` packaging so `npm run package` delegates to the
  full `npm run bundle` path.
- Made the AI proxy fail fast when `USAGE_TABLE_NAME` is missing unless the
  explicit local-only `ALLOW_IN_MEMORY_USAGE_STORE=true` escape hatch is set.
- Rebuilt `backend/ai-proxy/lambda.zip` locally; the ignored generated zip now
  contains `handler.js`, `usage-store.js`, `request-policy.js`, `package.json`,
  and `node_modules/@aws-sdk/client-dynamodb/package.json`.
- Updated `DEPLOYMENT_GUIDE.md`, `backend/ai-proxy/README.md`, `TESTING.md`,
  `SECURITY.md`, and `CHANGELOG.md` for the hosted proxy and IndexedDB
  migration risks.
- Added `DEPLOY_TEST_CHECKLIST.md`, `npm run deploy:check`,
  `scripts/predeploy-check.sh`, and `scripts/render-amplify-rewrites.sh` so
  repo-side deploy readiness and Amplify rewrite rendering can be checked
  before touching AWS.
- Corrected `scripts/smoke-test-hosted.sh` to verify Cognito JWKS at the
  user-pool issuer URL instead of the Hosted UI domain.

## Latest Validation

- `npm test -- --run src/engine/__tests__/math-engine.test.ts src/storage/__tests__/active-workspace-key.test.ts src/storage/__tests__/persistence-db-key.test.ts`
  - passed: 3 files, 65 tests.
- `npm test` from `backend/ai-proxy`
  - passed: 3 files, 29 tests.
- `npx tsc -p tsconfig.json --noEmit` from `backend/ai-proxy`
  - passed.
- `npm run lint`
  - passed.
- `npm run bundle` from `backend/ai-proxy`
  - passed; produced a 21 MB ignored `lambda.zip`.
- `unzip -l backend/ai-proxy/lambda.zip usage-store.js request-policy.js node_modules/@aws-sdk/client-dynamodb/package.json handler.js package.json`
  - passed; all expected files present.
- `git diff --check`
  - passed.
- `npm test`
  - passed: 58 files, 460 tests. Known non-blocking `--localstorage-file`
    warning still appears in settings-store tests.
- `npm run deploy:check`
  - passed; warned only that the repo template still contains
    `REPLACE_WITH_FUNCTION_URL_HOST`, which is expected until the Lambda
    Function URL host is known.
- `bash scripts/render-amplify-rewrites.sh https://abc123.lambda-url.us-east-1.on.aws/`
  - passed; rendered the expected `/api/ai/<*>` reverse-proxy rule and SPA
    fallback rule.
- `npm run build`
  - passed; Vite reported the known non-blocking large chunk warning.
- `npm run test:e2e`
  - passed: 4 active Playwright tests, 5 intentionally skipped workflows.
- `bash scripts/smoke-test-hosted.sh`
  - failed because `landroid.abstractmapping.com` does not currently resolve;
    Cognito issuer JWKS returned 200 after the script fix.

## Open Risks

- No commit or push has been made.
- `landroid.abstractmapping.com` is not live as of 2026-05-12; read-only smoke
  testing returns `000` for root/API/fallback requests, and `dig +short
  landroid.abstractmapping.com` returns no records.
- AWS-side work remains manual: provision DynamoDB table `landroid-ai-usage`,
  enable TTL on `ttl`, grant Lambda `dynamodb:UpdateItem`, set
  `USAGE_TABLE_NAME`, leave `ALLOW_IN_MEMORY_USAGE_STORE` unset, and upload the
  freshly bundled zip.
- Legacy hosted IndexedDB data under `default` is intentionally not
  auto-migrated; users must export/import `.landroid` snapshots manually to
  avoid copying the wrong shared-browser data.
- The `xlsx` package still has no upstream fix; current mitigation is caps plus
  Web Worker isolation.
- Five Playwright workflows remain intentionally skipped pending fixture retargeting.
- Leasehold summary still has some lenient parser math call sites outside the
  Desk Map coverage fix; review before broader hosted/data-import rollout.

## Local Noise / Uncommitted State

- Source/docs/test changes are unstaged.
- `AUDIT_VERIFICATION_REPORT.md` is a requested untracked report file.
- `DEPLOY_TEST_CHECKLIST.md`, `scripts/predeploy-check.sh`, and
  `scripts/render-amplify-rewrites.sh` are new untracked deploy-readiness files.
- `backend/ai-proxy/src/__tests__/handler.test.ts` and
  `src/storage/__tests__/persistence-db-key.test.ts` are new untracked test
  files.
- `backend/ai-proxy/lambda.zip` and `backend/ai-proxy/dist/` were regenerated
  by `npm run bundle` but are ignored generated artifacts.

## Next Best Tasks

- [ ] Review and decide whether to stage the report plus autonomous fixes.
- [ ] If creating a checkpoint, create/use a non-`main` branch, commit, and push.
- [ ] Follow `DEPLOY_TEST_CHECKLIST.md` for the AWS test deploy sequence.
- [ ] Provision the DynamoDB usage table and IAM grant before hosted user invites.
- [ ] Upload the regenerated `backend/ai-proxy/lambda.zip` after the AWS table/env work.
- [ ] Retarget or replace the skipped Playwright workflows.
- [ ] Decide whether to add explicit Leasehold malformed-interest warnings beyond the Desk Map coverage path.

## Paste-Ready Resume Prompt

> Resume work in `/Users/abstractmapping/projects/landroid` on branch `audit-verification-pre-aws`. First read `AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and `CONTINUATION-PROMPT.md`. The current workstream is post-verification remediation plus pre-AWS test-deploy readiness. `AUDIT_VERIFICATION_REPORT.md` is the verification snapshot; follow-up fixes have added attach invariant tests, persistence key tests, proxy handler tests, safer Lambda packaging docs/scripts, `DEPLOY_TEST_CHECKLIST.md`, and hosted deployment warnings. `landroid.abstractmapping.com` did not resolve during the latest read-only smoke test, while Cognito issuer JWKS returned 200. Keep work inside the repo, do not commit to main, and do not auto-migrate legacy hosted `default` IndexedDB data.
