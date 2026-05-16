# Audit verification report - 80acb19 / f4a85ce

## Summary
- 7 findings confirmed remediated
- 4 findings partially remediated (with caveats)
- 0 findings disputed (claim does not hold)
- 1 incidental finding outside scope

## Per-finding verdicts
### H-1 / M-6 - partial
`executeAttachConveyance` does call `assertRootTotalNotWorsened` after `validateCalcGraph`, so the defensive parity guard exists at `src/engine/math-engine.ts:863-867`. The structural claim also holds: the source always gets `parentId: attachParentId`, so a root source leaves the root set and a child source stays non-root; `parentId === 'unlinked'` is normalized to no source parent, cross mineral/NPRI attach is rejected, and same-parent refund is explicitly handled at `src/engine/math-engine.ts:762-790` and `src/engine/math-engine.ts:816-823`. The two added attach tests are success-path guard non-regression tests, not guard-exercising tests; by inspection they would still pass if `src/engine/math-engine.ts:866-867` were removed because neither constructs a post-state with a worsened root total (`src/engine/__tests__/math-engine.test.ts:1279-1322`).

### M-1 - partial
The helper implements hosted keys as `user-<sub>` and keeps local mode on `default`, and workspace/canvas persistence now calls those helpers at `src/storage/active-workspace-key.ts:56-63`, `src/storage/workspace-persistence.ts:496-507`, and `src/storage/canvas-persistence.ts:34-43`. Auth wires the Cognito `sub` into the helper and bootstrap waits for readiness before the first IndexedDB load at `src/auth/AuthProvider.tsx:77-88` and `src/main.tsx:28-38`. Caveats: the tests only exercise the helper, not a persistence round trip (`src/storage/__tests__/active-workspace-key.test.ts:22-76`); there is no migration from the legacy `default` row because startup only loads the current key (`src/main.tsx:33-38`, `src/storage/workspace-persistence.ts:505-507`); and the deploy guide gives only a generic IndexedDB limitation, not a warning that existing hosted `default` data becomes invisible under `user-<sub>` (`DEPLOYMENT_GUIDE.md:268-274`).

### M-2 - confirmed
Desk Map lease coverage now uses `parseStrictInterestString` only after trimming non-empty `leasedInterest`, so whitespace-only input falls through to owner-share allocation and malformed non-empty input surfaces an overlap warning at `src/components/deskmap/deskmap-coverage.ts:168-190`. The new test pins `leasedInterest: '1//8'` as a `clippedFraction: 'malformed'` warning at `src/components/deskmap/__tests__/deskmap-coverage.test.ts:246-282`. Other lenient parser math call sites remain in Leasehold summary calculations, but that is outside this specific Desk Map coverage claim (`src/components/leasehold/leasehold-summary.ts:356`, `src/components/leasehold/leasehold-summary.ts:433-455`, `src/components/leasehold/leasehold-summary.ts:887-977`).

### M-3 - confirmed
The `deleteNode` tool no longer accepts `confirmCascade`; its schema only accepts `nodeId`, and descendant deletes are refused unconditionally at `src/ai/tools.ts:614-653`. The preview field is now `cascadeRequiresUiApproval`, and the system prompt tells the model not to retry after refusal at `src/ai/tools.ts:574-610` and `src/ai/system-prompt.ts:39-40`. The refusal test covers the cascade case and workspace immutability at `src/ai/__tests__/tools.test.ts:273-303`; repeated model retries would keep refusing and eventually hit the eight-step cap in `runChat` (`src/ai/runChat.ts:62-69`). Leaf-delete success is not covered by the AI tool tests; the underlying store path still delegates to `executeDeleteBranch` at `src/store/workspace-store.ts:910-939`.

### M-4 - partial
`DynamoDbUsageStore` exists, uses an atomic `ADD tokens :n SET #ttl = :ttl`, and defaults TTL to 48 hours at `backend/ai-proxy/src/usage-store.ts:61-100`. The handler selects DynamoDB only when `USAGE_TABLE_NAME` is configured and otherwise falls back to memory at `backend/ai-proxy/src/handler.ts:64-69`; if DynamoDB throws, the request fails closed with the handler's 500 path before the OpenAI fetch at `backend/ai-proxy/src/handler.ts:132-155` and `backend/ai-proxy/src/handler.ts:214-227`. The deployment guide gives the right table key, TTL attribute, and minimum `dynamodb:UpdateItem` grant at `DEPLOYMENT_GUIDE.md:112-123`, but the durable fix is optional and the known-limits table still says the daily ceiling is per-Lambda-instance/in-memory at `DEPLOYMENT_GUIDE.md:268-276`.

### L-2 / H2-full - confirmed
The parser is split into pure implementation plus a Vite worker entry: `parseWorkbookSync` lives in `src/ai/wizard/parse-workbook-impl.ts:62-113`, the worker calls it in `src/ai/wizard/parse-workbook.worker.ts:23-37`, and `parseWorkbookInWorker` creates a one-shot worker with a 30-second timeout and buffer transfer at `src/ai/wizard/parse-workbook.ts:45-89`. The production wizard caller uses the worker result and does not reuse the transferred buffer afterward at `src/ai/wizard/WizardPanel.tsx:69-85`. Existing sync tests still cover the shared parser and caps at `src/ai/wizard/__tests__/parse-workbook.test.ts:14-90`, but the worker path itself is only build-smoked, not unit-tested; CSP allows same-origin workers via `worker-src 'self' blob:` at `customHttp.yml:15`.

### L-3 - confirmed
`npm audit` now reports only the unfixed `xlsx` high advisories; `xlsx` remains a dependency at `package.json:30` and `package-lock.json:4147-4162`, and the worker/cap mitigation is the intended containment at `src/ai/wizard/parse-workbook.worker.ts:4-8` and `src/ai/wizard/parse-workbook-impl.ts:31-45`. I found no remaining `postcss` advisory in the audit output, so the L-3 claim holds.

### L-4 - confirmed
`createLease` now rejects explicit `royaltyRate === ''` and `leasedInterest === ''` before parsing or writing, then still applies strict parsing to malformed non-empty values at `src/ai/tools.ts:701-728`. The test covers both explicit-empty failures and verifies no lease was written at `src/ai/__tests__/tools.test.ts:177-202`. Missing keys remain safe because only nonblank string overrides are passed to `createBlankLease`, and `createBlankLease` defaults both fields to empty strings for later user completion at `src/ai/tools.ts:736-740` and `src/types/owner.ts:231-261`.

### L-8 - partial
Pure request policy helpers were extracted and tested for route matching, bearer extraction, body decoding, JSON object parsing, token estimation, model override, `max_tokens` clamping, and verified-user pinning at `backend/ai-proxy/src/request-policy.ts:19-75` and `backend/ai-proxy/src/__tests__/request-policy.test.ts:13-118`. Handler integration uses those helpers before forwarding to OpenAI at `backend/ai-proxy/src/handler.ts:112-155`. The original L-8 concern explicitly included JWT verification, and that path is still not unit-tested because `CognitoJwtVerifier.verify` remains only in the untested handler flow at `backend/ai-proxy/src/handler.ts:58-62` and `backend/ai-proxy/src/handler.ts:123-129`; the upstream streaming path is likewise untested beyond the handler code at `backend/ai-proxy/src/handler.ts:155-213`.

### L-7 - confirmed
The five skipped Playwright tests are placeholders: each body only loads the app, loads the combinatorial demo, and asserts no browser errors at `tests/e2e/landroid-workflows.spec.ts:177-230`. Their comments consistently say the meaningful assertions depended on the retired leasehold fixture and should be rebuilt in Phase 4 at `tests/e2e/landroid-workflows.spec.ts:180-183`, `tests/e2e/landroid-workflows.spec.ts:193-198`, `tests/e2e/landroid-workflows.spec.ts:204-210`, `tests/e2e/landroid-workflows.spec.ts:214-220`, and `tests/e2e/landroid-workflows.spec.ts:223-230`. I accept the deferral; unskipping them would create trivial no-error coverage rather than restoring the retired assertions.

### M-5 - confirmed
The installed AI SDK type accepts `timeout` as either a number or object, and documents number-as-milliseconds at `node_modules/ai/dist/index.d.ts:583-665`. The runtime implementation confirms a bare number is returned by `getTotalTimeoutMs` and merged through `AbortSignal.timeout(totalTimeoutMs)` in `streamText` at `node_modules/ai/dist/index.mjs:879-887` and `node_modules/ai/dist/index.mjs:6370-6425`. The current `runChat` call passes numeric timeouts for Ollama and cloud providers at `src/ai/runChat.ts:62-69`, so the no-fix-needed claim holds.

## Meta-concerns
**Lambda zip is stale.** Source now imports `usage-store` and `request-policy` and depends on `@aws-sdk/client-dynamodb` at `backend/ai-proxy/src/handler.ts:16-30` and `backend/ai-proxy/package.json:14-16`. Artifact inspection of `backend/ai-proxy/lambda.zip` found `handler.js` but not `usage-store.js`, `request-policy.js`, or `node_modules/@aws-sdk/client-dynamodb`; the guide warns to rerun `npm run bundle`, but it frames the warning as daily-ceiling/logging freshness rather than explicitly saying the old zip will crash from missing modules (`DEPLOYMENT_GUIDE.md:101-106`, `backend/ai-proxy/package.json:8-16`).

**IAM grant missing.** The guide's wording is unambiguous: it tells the operator to grant the Lambda role `dynamodb:UpdateItem` on the usage table and then set `USAGE_TABLE_NAME` (`DEPLOYMENT_GUIDE.md:112-123`). That matches the implementation, which only constructs an `UpdateItemCommand` and does not need read permissions (`backend/ai-proxy/src/usage-store.ts:74-92`).

**Existing `default` workspace data invisibility.** This concern is real: hosted startup waits for the namespaced key and then loads only that row (`src/main.tsx:28-38`, `src/storage/workspace-persistence.ts:505-507`, `src/storage/canvas-persistence.ts:42-43`). I found no automatic migration path, and the deploy guide does not specifically warn that pre-namespacing hosted data under `default` will not appear after the change (`DEPLOYMENT_GUIDE.md:268-274`).

**Amplify rewrite placeholder.** The placeholder is still present at `amplify-rewrites.json:1-5`. The deployment guide is loud enough for a careful operator because it explicitly says to replace `REPLACE_WITH_FUNCTION_URL_HOST` with the Function URL host and gives formatting rules at `DEPLOYMENT_GUIDE.md:174-183`.

## Incidental findings
- MED: Several Leasehold math paths still use the lenient parser for royalty, ORRI burden, and assignment fractions, so malformed persisted values can still coerce to zero outside the Desk Map coverage path fixed for M-2 (`src/components/leasehold/leasehold-summary.ts:356`, `src/components/leasehold/leasehold-summary.ts:433-455`, `src/components/leasehold/leasehold-summary.ts:887-977`).

## Recommendation
Fix M-1's migration/operator warning, decide whether M-4 must be mandatory before AWS deploy, and add the missing JWT/streaming proxy coverage before merging; the code changes themselves mostly hold, but the deployment handoff is not yet safe as-is.
