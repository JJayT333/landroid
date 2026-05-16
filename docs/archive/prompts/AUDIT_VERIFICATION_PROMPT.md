# Audit verification task — `audit-remediation-pre-aws`

You are a second-opinion auditor. The previous chat (Claude, this repo, branch `audit-remediation-pre-aws`, commit `f4a85ce`) claimed to remediate 11 findings from `AUDIT_REPORT_2026-04-25.md`. **Your job is to verify those claims, not extend the audit, not fix anything.**

Findings only. No code changes. No commits. Output a structured report (template below).

---

## Ground truth & context

- **Calibration commit:** `f4a85ce` on branch `audit-verification-pre-aws` (this branch). Diff against `main` is the change set under audit.
- **Original audit:** `AUDIT_REPORT_2026-04-25.md` at the repo root. Read it. The "Findings" section is the contract the remediation claims to fulfill.
- **Prior remediation:** `84b1a85` (`fix(audit): pre-AWS remediation for M1–M5, H2 partial, H6, L2`) was the first pass on the same audit. `f4a85ce` is the second pass.
- **App context:** LANDroid is a local-first React/Vite/TypeScript title application for Texas oil-and-gas landwork. Two modes: local (no auth, IndexedDB only) and hosted (AWS Amplify + Cognito User Pools + Lambda Function URL AI proxy at `landroid.abstractmapping.com`). User is a landman, single-user-per-device today, multi-user invited rollout planned.
- **Scope of the change set:** see the commit message on `f4a85ce`. 11 finding IDs claimed remediated. Two (M-5 and L-7) explicitly deferred / dismissed with stated reasons — verify those reasons hold.

## How to read this prompt

For each finding the previous chat made a specific claim. Your job is:

1. **Confirm the claim** by reading the cited code at the cited file:line and running the cited tests.
2. **Stress-test the claim** — find the edge case the previous chat missed.
3. **Flag regressions** — does this change break anything previously working?
4. **Call BS where warranted** — if a "fix" doesn't actually fix the underlying audit concern, say so.

Severity convention from the original audit applies (CRIT / HIGH / MED / LOW).

---

## Per-finding verification list

### H-1 / M-6 — Root-mineral-total guard on attach
**Claim:** `executeAttachConveyance` now invokes `assertRootTotalNotWorsened`, mirroring the rebalance / predecessor parity. Two tests added in the H6 describe block.

**Verify:**
- The guard call is at [src/engine/math-engine.ts:866-867](src/engine/math-engine.ts:866).
- New tests at [src/engine/__tests__/math-engine.test.ts:1280-1322](src/engine/__tests__/math-engine.test.ts:1280).
- The original audit's H-1 said the current attach path is "structurally incapable" of pushing root total > 1.0 because the moved node always becomes a child. The previous chat acknowledged this and added the guard as defensive parity. **Verify that claim:** is there *any* path through `executeAttachConveyance` where the post-state can have a higher root mineral total than the pre-state? Specifically check:
  - Source node was a root, becomes a child → total decreases or stays. ✓ obvious.
  - Source node was already a child, still a child of a different parent → roots unchanged. ✓ obvious.
  - **Edge cases worth checking:** source `parentId === 'unlinked'`, source's `interestClass` differs from destination's (rejected at line 762, but is the rejection complete?), source has descendants whose `interestClass` is `mineral` while source itself is something else (impossible per `validateCalcGraph`, but worth sanity check), refundSourceParent + same-parent-as-destination edge case (lines 788-790).
- Are the two new tests actually exercising the guard? Or do they pass even without the guard call? Run with line 866-867 commented out and see if any test fails.

### M-1 — Workspace IndexedDB key namespaced on Cognito sub
**Claim:** New `src/storage/active-workspace-key.ts` exposes a per-user key in hosted mode (`user-<sub>`) and the legacy `default` in local mode. Bootstrap awaits `awaitWorkspaceKeyReady`. AuthProvider populates it via `setActiveUserSub`. 5 tests pass.

**Verify:**
- Module: [src/storage/active-workspace-key.ts](src/storage/active-workspace-key.ts).
- Tests: [src/storage/__tests__/active-workspace-key.test.ts](src/storage/__tests__/active-workspace-key.test.ts).
- Wired through workspace-persistence.ts and canvas-persistence.ts.
- AuthProvider integration: [src/auth/AuthProvider.tsx:80-90](src/auth/AuthProvider.tsx:80).
- Bootstrap gating: [src/main.tsx](src/main.tsx).

**Stress tests / questions:**
1. **Timing race:** in hosted mode, `bootstrapApp()` runs at module load and awaits the ready promise. AuthProvider mounts later and resolves it. **What if AuthProvider crashes during `signinSilent` / `signinRedirectCallback` and the promise never resolves?** The app would stay in "Loading…" forever. Trace this — is the failure path covered?
2. **Sign-in→sign-out→sign-in-as-different-user without page reload:** is this possible in this app? If yes, the workspace store still has user A's data in memory when user B signs in; the autosave subscription would write A's data under B's key. (Cognito redirect normally prevents this, but check there's no silent renew path that swaps users.)
3. **Migration concern:** existing production users have data under `'default'`. After this deploy, hosted users get a fresh empty workspace because their key is now `user-<sub>`. The previous chat noted this as a "documented manual migration" risk. **Verify there is no automatic migration in `bootstrapApp`** (which would silently merge data wrongly), and verify the deployment guide actually warns the operator.
4. **Local mode regression:** confirm `getWorkspaceDbKey()` returns `'default'` in local mode regardless of any sub set, and the existing `'default'` row in users' local IndexedDB is still loaded as before. The test at [active-workspace-key.test.ts:30](src/storage/__tests__/active-workspace-key.test.ts:30) covers this — does it actually exercise the persistence layer or just the helper?

### M-2 — Lease coverage allocation uses strict parser
**Claim:** [deskmap-coverage.ts:170](src/components/deskmap/deskmap-coverage.ts:170) (approx) now uses `parseStrictInterestString`. Malformed `leasedInterest` surfaces as a coverage warning instead of silently coercing to 0. New test asserts `1//8` triggers a `clippedFraction: 'malformed'` overlap.

**Verify:**
- Code change: import + call site in `deskmap-coverage.ts`.
- Test: [src/components/deskmap/__tests__/deskmap-coverage.test.ts](src/components/deskmap/__tests__/deskmap-coverage.test.ts) — search for "M-2".

**Stress tests:**
1. The strict parser returns `Decimal(0)` for empty/whitespace input (documented at [src/utils/interest-string.ts:46-56](src/utils/interest-string.ts:46)). The coverage code's `if (leasedInterestText.length > 0)` branch only enters when the trimmed string is non-empty. **Confirm there is no path where a whitespace-only `leasedInterest` (e.g. `'  '`) survives the trim and reaches the strict parser as non-empty.**
2. Are there OTHER call sites of `parseInterestString` (the lenient parser) that are also math paths and should also be flipped? Grep for `parseInterestString` (not `parseStrictInterestString`) and judge each call site: display path = OK to keep lenient, math path = should be strict.

### M-3 — `deleteNode` cascade refusal
**Claim:** Removed the model-supplied `confirmCascade` boolean. Cascading deletes are refused unconditionally and routed to the UI. System prompt and tool description updated. New test pins refusal.

**Verify:**
- Tool: [src/ai/tools.ts:612-670](src/ai/tools.ts:612).
- Preview tool: [src/ai/tools.ts:574-610](src/ai/tools.ts:574). Note the field rename: `requiresConfirmCascade` → `cascadeRequiresUiApproval`.
- System prompt: [src/ai/system-prompt.ts:39](src/ai/system-prompt.ts:39).
- Test: [src/ai/__tests__/tools.test.ts](src/ai/__tests__/tools.test.ts) — search for "M-3".

**Stress tests:**
1. **AI loop risk:** if the model retries `deleteNode` after refusal, what happens? Does the tool just keep refusing, or does the model burn tokens looping? The system prompt says "Do NOT retry" — is that enough? Check `runChat.ts` for stop conditions.
2. **Schema breakage:** any external caller (other than the AI) that passes `confirmCascade: true`? Grep for `confirmCascade`. The ai/__tests__ updates removed references; is anything else referencing it?
3. **Leaf delete path still works:** the previous chat removed the success-case test for leaf delete because it triggered IndexedDB in the test env. Has leaf delete been verified anywhere? If not, flag it as a coverage gap.

### M-4 — Durable per-user daily token counter
**Claim:** New `usage-store.ts` with `InMemoryUsageStore` + `DynamoDbUsageStore` (atomic `ADD` with 48h TTL). Handler picks backend by `USAGE_TABLE_NAME` env. Deployment guide updated. 7 tests.

**Verify:**
- Store: [backend/ai-proxy/src/usage-store.ts](backend/ai-proxy/src/usage-store.ts).
- Handler integration: [backend/ai-proxy/src/handler.ts](backend/ai-proxy/src/handler.ts).
- Tests: [backend/ai-proxy/src/__tests__/usage-store.test.ts](backend/ai-proxy/src/__tests__/usage-store.test.ts).
- Deployment guide: `DEPLOYMENT_GUIDE.md` step 2d.

**Stress tests:**
1. **DDB error handling:** `DynamoDbUsageStore.trackUsage` propagates errors from `client.send`. Look at the handler call site — what does the proxy do when DDB throws (e.g. throttled, missing permission, table doesn't exist)? Is the request rejected with 500, or does it fall through and serve the AI request anyway? Either is defensible but the behaviour should be intentional.
2. **TTL correctness:** the `ttl` attribute is set to `now + 48h`. DynamoDB's TTL feature requires the table-level TTL to be enabled on the `ttl` attribute name, manually. The deployment guide mentions this. **Verify the guide actually tells the operator to enable TTL** and points at the correct attribute name.
3. **IAM grant:** the deployment guide instructs the operator to grant `dynamodb:UpdateItem`. Is that the minimum sufficient permission? `UpdateItemCommand` only needs `UpdateItem`; no `GetItem`/`PutItem` required because of the `ADD` semantics.
4. **Schema alignment:** the test at [usage-store.test.ts:46-58](backend/ai-proxy/src/__tests__/usage-store.test.ts:46) asserts `UpdateExpression: 'ADD tokens :n SET #ttl = :ttl'`. Confirm DynamoDB accepts `ADD` and `SET` in the same expression (it does, but only when targeting different attributes). `tokens` is `ADD`, `ttl` is `SET` — non-overlapping. ✓

### L-2 / H2-full — xlsx Web Worker isolation
**Claim:** Pure parser extracted to `parse-workbook-impl.ts`. New `parse-workbook.worker.ts` runs the parser off-thread. `parse-workbook.ts` shell exposes both sync (for tests) and async-via-worker (for production). 30s worker timeout. Existing 6 sync tests still pass unchanged.

**Verify:**
- Impl: [src/ai/wizard/parse-workbook-impl.ts](src/ai/wizard/parse-workbook-impl.ts).
- Worker: [src/ai/wizard/parse-workbook.worker.ts](src/ai/wizard/parse-workbook.worker.ts).
- Shell: [src/ai/wizard/parse-workbook.ts](src/ai/wizard/parse-workbook.ts).
- Caller switch: [src/ai/wizard/WizardPanel.tsx:77-79](src/ai/wizard/WizardPanel.tsx:77).
- Build: `npm run build` should emit a `parse-workbook.worker-*.js` chunk under `dist/assets/`.

**Stress tests:**
1. **Dev-mode runtime:** `?worker` import works in `npm run build`. Does it work in `npm run dev`? Vite handles them differently. The previous chat did NOT smoke-test dev mode — call this out.
2. **Vitest:** the existing `parse-workbook.test.ts` calls `parseWorkbook` (the sync re-export of `parseWorkbookSync`). This works. But the worker path itself has no test. Either accept that as low-risk or flag it.
3. **Buffer transfer:** the worker call uses `worker.postMessage(request, [buffer])` to transfer ownership. **The original ArrayBuffer is detached after this call.** Confirm the caller (`WizardPanel.tsx`) doesn't reuse the buffer afterward. (It doesn't — `await file.arrayBuffer()` is single-use — but verify.)
4. **Worker error path:** the worker posts `{ ok: false, error }` for parse errors and uses `addEventListener('error')` for crashes. The 30s timeout is the only timeout. **What if the worker hangs without crashing or posting?** The timeout fires, terminates, rejects. ✓ But verify the timer is cleared in the success path (it is, line 70).
5. **CSP:** confirm `customHttp.yml`'s `worker-src 'self' blob:` covers a worker emitted as a same-origin asset. (It does — the worker is `self` not `blob:` after build.)

### L-3 — `npm audit fix` for postcss
**Claim:** moderate advisory cleared.

**Verify:** `npm audit` should show no postcss entry. Only `xlsx` should remain (high, no fix available — mitigated by L-2 worker isolation + caps).

### L-4 — `createLease` rejects explicit empty strings
**Claim:** `royaltyRate: ''` and `leasedInterest: ''` are now rejected with a clear error. Missing keys still allowed. New test.

**Verify:**
- Tool: [src/ai/tools.ts:700-720](src/ai/tools.ts:700) (approx).
- Test: [src/ai/__tests__/tools.test.ts](src/ai/__tests__/tools.test.ts) — search for "L-4".

**Stress tests:**
1. Are there other tools that accept `royaltyRate` / `leasedInterest` and have the same blank-coercion footgun? `updateLease` if it exists?
2. The previous chat dropped a "missing keys are still valid" sanity case from the test because it tripped IndexedDB. Acceptable, but is the missing-key path actually safe? Trace `createBlankLease` to confirm undefined royaltyRate produces a clean lease record.

### L-8 — Proxy unit tests expanded
**Claim:** Pure policy helpers extracted to `request-policy.ts`. 19 tests covering route, bearer extraction, body decode, JSON parsing, body policy (model override + max_tokens clamp + user pin).

**Verify:**
- Module: [backend/ai-proxy/src/request-policy.ts](backend/ai-proxy/src/request-policy.ts).
- Tests: [backend/ai-proxy/src/__tests__/request-policy.test.ts](backend/ai-proxy/src/__tests__/request-policy.test.ts).
- Handler integration: [backend/ai-proxy/src/handler.ts](backend/ai-proxy/src/handler.ts).

**Stress tests:**
1. **Coverage gap:** the JWT verification path (CognitoJwtVerifier) is still untested. Is that an acceptable coverage gap? The original L-8 explicitly mentioned JWT verification.
2. **Streaming integration:** the actual upstream OpenAI fetch + stream-back path is also untested. Acceptable for a Lambda? The smoke test exercises auth but not the success path.
3. **`applyBodyPolicy` handles arrays defensively?** If a client sends `messages: [...]` with thousands of messages, the policy doesn't trim it. The token estimator covers it, but the model field might still go wrong if tampered. Sanity-check.

### L-7 — Playwright skips (deferred)
**Claim:** The 5 `test.skip` placeholders in `tests/e2e/landroid-workflows.spec.ts` are placeholders waiting for a Phase 4 fixture rebuild; un-skipping now would run trivial bodies pretending coverage that doesn't exist.

**Verify:** read each `test.skip` body. Confirm the body is genuinely a placeholder (just `loadCombinatorialDemo + assert no errors`) and the meaningful assertions reference the retired leasehold fixture. **Either accept the deferral, or call out that one or more skips actually have meaningful bodies that should be un-skipped now.**

### M-5 — `streamText({ timeout })` no-fix-needed claim
**Claim:** verified the Vercel AI SDK supports `timeout` natively (`node_modules/ai/dist/index.d.ts:661`); the `runChat.ts` call site is correct as-is.

**Verify:**
- Read the SDK type at the cited line.
- Run a manual trace: `streamText` is called with `timeout: 600_000` (Ollama) or `120_000` (cloud). Does the SDK actually wire that through to AbortController, or does it accept the option silently and not enforce it? **Look at the SDK's runtime behaviour, not just the type signature.** If the type is `timeout?: TimeoutConfiguration` but the implementation only handles a `{ totalMs: number }` object and not a bare number, the current call site is broken even though it typechecks.

---

## Meta-concerns the previous chat raised

The previous chat called these out as "things that affect AWS deployment but were not part of the audit." Verify they are real concerns and the user has been clearly warned:

1. **Lambda zip is stale** — current `lambda.zip` does not include `usage-store.js`, `request-policy.js`, or `@aws-sdk/client-dynamodb`. Deploying the existing zip will crash the proxy on first request. **Has this been documented or scripted to prevent the footgun?**
2. **IAM grant missing** — `dynamodb:UpdateItem` not yet attached to the Lambda role. The deployment guide mentions it; verify the wording is unambiguous.
3. **Existing `'default'` workspace data invisibility** — covered above under M-1 stress test #3.
4. **Amplify rewrite placeholder** — `amplify-rewrites.json:4` still has `REPLACE_WITH_FUNCTION_URL_HOST`. Was L-1 in the original audit, marked won't-fix. Acceptable — but is it loud enough in the deploy guide?

---

## What you should NOT do

- Do not fix anything. This is a verification pass, not remediation.
- Do not run `npm audit fix`, `npm install`, or any command that mutates the lockfile.
- Do not push to remote. Stay on this branch read-only.
- Do not extend the original audit. New findings outside the 11 claimed remediations are out of scope; if you spot one, note it briefly under "incidental findings" but do not deep-dive.
- Do not invoke `gh` or any GitHub API.

## Output format

Write your verdict to `AUDIT_VERIFICATION_REPORT.md` at the repo root. Structure:

```markdown
# Audit verification report — f4a85ce

## Summary
- N findings confirmed remediated
- N findings partially remediated (with caveats)
- N findings disputed (claim does not hold)
- N incidental findings outside scope

## Per-finding verdicts
### H-1 / M-6 — [confirmed | partial | disputed]
[2-4 sentences. Cite file:line. If disputed, what's broken.]

### M-1 — [confirmed | partial | disputed]
...

(continue for each)

## Meta-concerns
[2-4 sentences each]

## Incidental findings
[Brief list, severity-tagged. No deep dives.]

## Recommendation
[Single sentence: ship as-is / fix X before merging / hold for review.]
```

Be honest. The previous chat is not your colleague; the user is. If the previous chat called something done that isn't done, say so.
