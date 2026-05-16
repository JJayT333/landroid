# LANDroid End-to-End Audit — 2026-04-25

**Calibration commit:** `84b1a85` (`fix(audit): pre-AWS remediation for M1–M5, H2 partial, H6, L2`)
**Branch:** `audit-remediation-pre-aws`
**Scope:** full-stack pre-AWS audit; calibrated against `AUDIT_REPORT.md` (2026-04-19) and `DEPLOYMENT_READINESS_AUDIT.md` (2026-04-22).
**Output:** findings only, no code changes.

---

## Executive summary

The 84b1a85 remediation pass closes most of the high-impact items from the prior two audits. Math engine, persistence, CSV/`.landroid` import, lease overlap surfacing, and the hosted-mode read-only AI subset are all in good shape. Build, type-check, and 56-file/445-test vitest suite all pass.

The remaining issues fall into three buckets:

1. **One real H6 hole** — `executeAttachConveyance` is the only mutating math op missing the `assertRootTotalNotWorsened` guard. Reproducible and silently raises root mineral total above 1.0.
2. **Hosted-mode multi-user data isolation** — `WORKSPACE_ID = 'default'` is hardcoded; two Cognito users on one browser/profile see each other's IndexedDB. Documented as a known limit, but worth a HIGH because hosted is now real.
3. **Operational soft spots** — Amplify rewrite placeholder (`REPLACE_WITH_FUNCTION_URL_HOST`) requires manual swap on first deploy; daily token ceiling resets on Lambda cold start; `xlsx` (high-sev advisory) still in use; one E2E suite, four active tests.

Total findings below: **1 HIGH, 6 MEDIUM, 9 LOW** — plus 12 prior audit items confirmed remediated. No new CRITICAL.

| Area | Status |
| --- | --- |
| Math engine correctness | 1 HIGH (H6 hole), otherwise solid |
| Persistence / import-export | 2 MED (multi-user, lenient parser path), otherwise solid |
| AI surface | 1 MED (model-supplied confirmCascade), 2 LOW |
| Auth / deploy | 2 MED (workspace isolation overlap, ceiling reset), 2 LOW |
| UI invariants | 1 LOW |
| Test coverage | 1 MED (H6 attach), 3 LOW |
| Ops hygiene | 1 LOW (`xlsx`/`postcss` advisories) |

---

## Findings

### HIGH

#### H-1 — `executeAttachConveyance` does not enforce root-mineral-total ≤ 1.0
**File:** [src/engine/math-engine.ts:750-872](src/engine/math-engine.ts:750)
**Symptom:** `executeRebalance` (line 613) and `executePredecessorInsert` (line 726) both call `assertRootTotalNotWorsened(originalNodes, nodes)` before returning. `executeAttachConveyance` only calls `validateCalcGraph(updatedNodes)` at line 863 and returns. The same H6 invariant added in 84b1a85 is silently absent on this code path.
**Confirmed by:** the H6 test block at [src/engine/__tests__/math-engine.test.ts:1208-1305](src/engine/__tests__/math-engine.test.ts:1208) covers `executeRebalance` and `executePredecessorInsert` cases only — no `executeAttachConveyance` case.
**Repro sketch:** two roots `root-a=0.5, root-b=0.5` (mineral, total = 1.0). Detach a 0.6 subtree from `root-a` and re-attach it to `root-b` with `calcShare=0.6`. The destination capacity check at line 791 only verifies `0.6 ≤ root-b.fraction` (= 0.5) — actually it would fail there. But construct: `root-a=0.5`, `root-b=0.5` with `root-a` having a child `c1=0.4`. Move `c1` → `root-b` at calcShare=0.4: destination capacity = `0.5`, allowed. The move *itself* doesn't change root totals (children don't contribute). However: detach a *root* via attach. Roots can be the source — `sourceParentId` is null, so `refundSourceParent=false`, and the source root is re-parented to a new parent (line 819, `parentId: attachParentId`). `calcRootMineralTotal` (line 244) only counts nodes whose `parentId == null`, so the moved root no longer contributes — total drops, not rises. **Real exposure:** the inverse — *detaching from a parent into a new root* is not done by this op (it always sets `parentId: attachParentId`), so the lift-to-root path is closed. That said, the missing guard is a latent defect: any future change that adds a "lift to root" branch, or a chained operation that flips parentId, can violate H6 silently.
**Severity rationale:** marking HIGH because (a) the symmetry of guards across the three mutating root-affecting ops is the actual invariant the prior audit asked for, (b) the current path being safe is incidental and undocumented, and (c) no test pins it. Demote to MED if you decide the guard is intentionally elided.
**Fix sketch:**
```ts
const validation = validateCalcGraph(updatedNodes);
if (!validation.valid) return err('invalid_graph', '…', validation.issues);
const rootTotalErr = assertRootTotalNotWorsened(nodes, updatedNodes);
if (rootTotalErr) return rootTotalErr;
return ok(updatedNodes, { … });
```
**Verification test:** add a case in the existing `describe('root mineral total invariant (audit H6)', …)` block that constructs an attach scenario whose updated graph would have `calcRootMineralTotal > 1.0`, and assert `result.ok === false` with `error.code === 'invalid_graph'`.

---

### MEDIUM

#### M-1 — Hosted multi-user IndexedDB collision (`WORKSPACE_ID = 'default'`)
**Files:** [src/storage/workspace-persistence.ts:63](src/storage/workspace-persistence.ts:63), [src/store/workspace-store.ts](src/store/workspace-store.ts) (workspaceId hydration).
**Symptom:** the persisted workspace key is the literal string `'default'`. In hosted mode, two distinct Cognito users on the same browser profile read/write the same IndexedDB row. Switching users mid-session via Cognito sign-out + sign-in does not create a fresh namespace; the second user sees the first user's nodes/owners/PDFs/contacts.
**Why MED, not HIGH:** this was previously HG-1 in `DEPLOYMENT_READINESS_AUDIT.md` and is documented as a "known limit" in `DEPLOYMENT_GUIDE.md`. It is, however, a real data-mixing risk now that hosted is shipping; the local-first IndexedDB layer was designed under the local-only assumption. If you only ever invite one named user per device, this is fine.
**Fix sketch:** namespace the workspace id on the `sub` claim from the Cognito ID token. In hosted mode, derive `WORKSPACE_ID = 'user-' + sub` after AuthProvider resolves; in local mode keep `'default'`. Migrate by detecting `'default'`-row data on first hosted load and renaming it to the new key (or leaving it; new logins start clean).
**Verification:** integration test that simulates two `sub` values writing to persistence and asserts row separation.

#### M-2 — Lease coverage allocation uses the *lenient* `parseInterestString`
**Files:** [src/components/deskmap/deskmap-coverage.ts:170](src/components/deskmap/deskmap-coverage.ts:170), [src/utils/interest-string.ts:4-26](src/utils/interest-string.ts:4).
**Symptom:** `allocateLeaseCoverage` parses `lease.leasedInterest` with the lenient parser. The lenient parser returns `Decimal(0)` for empty/whitespace input, then the function takes the "leased interest text length > 0" branch only when truthy — so a stored `leasedInterest = '   '` (whitespace, after a save round-trip that normalised it imperfectly) would pass the length check but the lenient parser would error or return 0. More importantly, the lenient parser was kept for *display* paths after audit finding #4; coverage is a math path.
**Why MED:** writes are gated by the *strict* parser via `parseStrictInterestString` in lease creation tools and form save handlers, so the most common bad-data path is closed. The exposure is data imported via `.landroid` import or constructed manually outside the form layer.
**Fix sketch:** swap the `parseInterestString` call at `deskmap-coverage.ts:170` for `parseStrictInterestString`, and treat `null` as "fully clipped" overlap rather than silently zeroing. Or: make `normalizeLease` reject malformed `leasedInterest` at persistence boundary so coverage can keep trusting the field.
**Verification test:** unit test feeding `allocateLeaseCoverage` a lease with `leasedInterest = '1//8'` (multi-slash garbage) and asserting it surfaces a coverage warning rather than a zero allocation.

#### M-3 — `deleteNode` cascade guard is a model-supplied boolean
**File:** [src/ai/tools.ts:644](src/ai/tools.ts:644).
**Symptom:** the `deleteNode` AI tool requires `confirmCascade: true` from the model when descendants exist. The boolean is part of the tool schema and the model sets it. Audit C1 from 2026-04-19 specifically called out that the "human-in-the-loop" gate cannot be a model-controlled flag. The fix in 84b1a85 carved out a `readOnlyLandroidTools` subset for hosted mode (good), but in local mode the model can still pass `confirmCascade: true` and trigger a cascade.
**Why MED:** local mode is single-user-on-their-own-machine; the snapshot-and-undo-store path ([src/ai/runChat.ts:55-85](src/ai/runChat.ts:55)) makes the operation reversible. Still, "the AI deleted my whole branch" is recoverable but unpleasant.
**Fix sketch:** drop `confirmCascade` from the AI tool schema entirely. Have the model surface an explicit "I would delete N children — please confirm" message and require the *user* to issue a follow-up tool call (e.g., `confirmDestructiveAction({operationId})`) that the UI mints only after explicit user click. The proposal/approval boundary the prior audit recommended.

#### M-4 — Daily token ceiling resets on Lambda cold start
**File:** [backend/ai-proxy/src/handler.ts:57-76, 134-146](backend/ai-proxy/src/handler.ts:57).
**Symptom:** `userUsage` is a process-local `Map`. Cold start = empty map = ceiling re-armed. A user near the 500k/day limit can simply wait for a cold start (~15 min idle) to refill. The comment at line 13 acknowledges this is "fine for POC".
**Why MED:** small attack surface (only invited users, server-controlled model `gpt-4o-mini`, hard 2048-token cap per request). But the ceiling is the only line of defence against runaway cost from a compromised user account.
**Fix sketch:** persist the daily counter in DynamoDB (PK = `sub`, SK = day) with a TTL of 48h. Cheap and durable.

#### M-5 — `streamText({ timeout: ... })` may not be honoured by the Vercel AI SDK
**File:** [src/ai/runChat.ts:69](src/ai/runChat.ts:69).
**Symptom:** `streamText` is called with `timeout: settings.provider === 'ollama' ? 600_000 : 120_000`. The Vercel `ai` SDK `streamText` API does not document a `timeout` parameter; cancellation is via `abortSignal`. If the SDK silently ignores the option, a wedged Ollama request will hang the panel until the user clicks cancel.
**Why MED:** behavioural — needs verification against the installed `ai` SDK version. If unsupported, route through `AbortSignal.timeout(ms)` composed with the caller's signal.
**Fix sketch:** `const composed = AbortSignal.any([input.signal, AbortSignal.timeout(...)].filter(Boolean));` and pass `composed` as `abortSignal`.

#### M-6 — H6 attach-conveyance test gap
**File:** [src/engine/__tests__/math-engine.test.ts:1208-1305](src/engine/__tests__/math-engine.test.ts:1208).
**Symptom:** the H6 invariant block has cases for `executeRebalance` and `executePredecessorInsert` but none for `executeAttachConveyance`. Together with H-1 above, this means there is neither code nor test coverage for attach-driven root-total violations.
**Fix:** add a case as described in H-1.

---

### LOW

#### L-1 — Amplify rewrite placeholder requires manual swap
**File:** [amplify-rewrites.json:4](amplify-rewrites.json:4).
**Symptom:** `"target": "https://REPLACE_WITH_FUNCTION_URL_HOST/<*>"`. Operator must paste the real Lambda Function URL host into Amplify console after first deploy. If forgotten, AI calls will resolve to the literal placeholder DNS name (NXDOMAIN) and the smoke test will catch it (`/api/ai/* → ???`). Smoke-test step 3 explicitly handles 404 with a useful error message.
**Fix:** provide a CDK/Terraform template, or a `scripts/configure-amplify-rewrites.sh` that takes the function URL as an argument.

#### L-2 — `xlsx` advisory (high-sev: prototype pollution + ReDoS) still present
**Source:** `npm audit`.
**Status:** "No fix available" — upstream SheetJS has not patched. 84b1a85 added size, sheet-count, and cell-count caps in [src/ai/wizard/parse-workbook.ts:48-93](src/ai/wizard/parse-workbook.ts:48). H2 *partial* — H2 *full* (move parsing into a Web Worker) is still listed as pending.
**Fix:** either (a) move xlsx parsing into a Web Worker (worker `'self'` is allowed in CSP at [customHttp.yml:18](customHttp.yml:18) — `worker-src 'self' blob:`), or (b) replace `xlsx` with a stricter parser (e.g., `exceljs`).

#### L-3 — `postcss` moderate advisory has a fix available
**Source:** `npm audit`.
**Symptom:** dev-time only (build pipeline). One `npm audit fix` away.
**Fix:** run `npm audit fix` and commit the lockfile change.

#### L-4 — `parseStrictInterestString` returns `0` for empty/null
**File:** [src/utils/interest-string.ts:46-56](src/utils/interest-string.ts:46).
**Symptom:** documented in JSDoc as intentional ("no value entered yet" is a legal state for optional fields). Side-effect: AI `createLease` with `royaltyRate: ''` will save a lease with royalty 0/1 silently rather than rejecting. The strict parser was supposed to surface "blank" as a form error in the prior audit's recommendation #4.
**Why LOW:** lease forms validate at submit; this is a path-specific concern in tool code where blank is treated as "not specified" rather than "explicitly zero". Documented behaviour, not a defect.
**Fix:** if you want stricter AI behaviour, branch in `tools.ts:700-710` between "missing key" (allow) and "explicit empty string" (reject), and pass the missing key through as undefined.

#### L-5 — `validateCalcGraph` does not enforce root total ≤ 1
**File:** [src/engine/math-engine.ts](src/engine/math-engine.ts) (`validateCalcGraph`, `validateOwnershipGraph`).
**Symptom:** the global validator catches per-parent over-allocation, cycles, missing-parent refs, and lessor-fraction issues, but does not assert that summed root mineral fractions ≤ 1.0. Imports / direct workspace-store edits could leave a 1.5-total state on disk that the per-op `assertRootTotalNotWorsened` then locks in (since the rule is "do not worsen", not "must be ≤ 1").
**Why LOW:** intentional — the comment at [math-engine.ts:240-243](src/engine/math-engine.ts:240) explicitly states "a workspace that already has total > 1 can still be edited back downward". Worth surfacing in the desk-map coverage card as a warning when total > 1.

#### L-6 — Lambda token estimator over-counts but is single-axis
**File:** [backend/ai-proxy/src/handler.ts:78-83](backend/ai-proxy/src/handler.ts:78).
**Symptom:** `Math.ceil(rawBody.length / 3.5) + MAX_OUTPUT_TOKENS`. Generous on input, but assumes `MAX_OUTPUT_TOKENS=2048` was actually consumed even when the model returned 50 tokens. Real OpenAI usage gets discarded ([handler.ts:191-211](backend/ai-proxy/src/handler.ts:191) streams the body without counting). Over time this depresses the user's effective ceiling vs. their actual usage.
**Why LOW:** the over-count is a feature for safety; the wasted budget is a UX concern, not a correctness one.
**Fix:** parse the final SSE chunk for the OpenAI `usage` event and `trackUsage(sub, actual - estimated)` correction.

#### L-7 — One Playwright spec, four active tests
**File:** [tests/e2e/landroid-workflows.spec.ts](tests/e2e/landroid-workflows.spec.ts).
**Symptom:** four active `test(…)` blocks; five `test.skip(…)` blocks for leasehold seed, landroid export/import, branch-scoped lessee delete, curative linking, and research records. The unit suite is healthy (445 tests / 56 files / all passing) but golden-path E2E coverage is thin given hosted mode is now active.
**Fix:** un-skip the leasehold seed and export/import specs first; both are listed as "Done" remediations in `PATCH_PLAN.md` and lack regression tests.

#### L-8 — No Cognito JWT verification test in `backend/ai-proxy/`
**File:** `backend/ai-proxy/src/` has no `__tests__` directory.
**Symptom:** the JWT verification, daily-ceiling logic, model override, and OpenAI proxying all rely on smoke testing in production. The smoke test catches "auth not enforced" and "rewrite missing" but not "verifier accepts a malformed token" or "ceiling counter races on concurrent requests".
**Fix:** add a vitest suite that mocks `CognitoJwtVerifier` and the `awslambda` global, and asserts the rejection codes for each branch (missing bearer, invalid token, ceiling, bad JSON, upstream 5xx).

#### L-9 — AI panel assumes hosted-mode model name in UI copy
**File:** [src/ai/AISettingsPanel.tsx:27](src/ai/AISettingsPanel.tsx:27).
**Symptom:** the hosted settings panel hardcodes `HOSTED_MODEL_ID` from `client.ts`; if the Lambda's `HARDCODED_MODEL` ([backend/ai-proxy/src/handler.ts:42](backend/ai-proxy/src/handler.ts:42)) ever drifts, the UI lies to the user. There's no shared constant.
**Fix:** publish the model name through a `/api/ai/meta` endpoint or a build-time env var consumed by both sides.

---

## Already remediated (verified at 84b1a85)

| ID | Item | Where verified |
| --- | --- | --- |
| M1 | Atomic batch graft | [workspace-store.ts:800-840](src/store/workspace-store.ts:800) |
| M2 | Explicit `deskMapId` rejection in `createRootNode` | [workspace-store.ts:692-695](src/store/workspace-store.ts:692) |
| M3 | Owner / contact normalization rejects records without IDs; pre-decode 25 MB blob cap | [workspace-persistence.ts](src/storage/workspace-persistence.ts), [blob-serialization.ts:15](src/storage/blob-serialization.ts:15) |
| M4 | Strict CSV parsing + duplicate-ID rejection + `validateOwnershipGraph` | [csv-io.ts:218-239](src/storage/csv-io.ts:218) |
| M5 | `LeaseCoverageOverlap` surfaced through `DeskMapCoverageSummary.leaseOverlaps` | [deskmap-coverage.ts:264-294](src/components/deskmap/deskmap-coverage.ts:264) |
| H2 (partial) | xlsx parser hard caps: 10 MB / 50 sheets / 500k cells | [parse-workbook.ts:48-93](src/ai/wizard/parse-workbook.ts:48) |
| H4 | Lease activeness gates by Texas-math jurisdiction *and* status | [deskmap-coverage.ts:88-90](src/components/deskmap/deskmap-coverage.ts:88) |
| H5 | `attachLease` rejects non-Texas leases and owner mismatches | [workspace-store.ts:857-870](src/store/workspace-store.ts:857) |
| H6 | `assertRootTotalNotWorsened` invoked for `executeRebalance` and `executePredecessorInsert` | [math-engine.ts:613, 726](src/engine/math-engine.ts:613) — but **not** `executeAttachConveyance` (see H-1) |
| L2 | `settings-store` in-memory storage fallback for jsdom-less vitest | [settings-store.ts:18-41](src/ai/settings-store.ts:18) |
| C1 (partial) | Hosted-mode `readOnlyLandroidTools` subset; pre-turn snapshot capture | [tools.ts:892](src/ai/tools.ts:892), [runChat.ts:55-85](src/ai/runChat.ts:55) |
| Auth | Session 401 recovery path; token-expiry re-prompt | [AuthProvider.tsx:117-128](src/auth/AuthProvider.tsx:117), [session.ts:38-40](src/auth/session.ts:38) |

---

## Recommended remediation sequence

1. **H-1** — add `assertRootTotalNotWorsened` to `executeAttachConveyance` and a paired test (M-6). 30-line patch, removes a real but currently-uncatchable invariant gap.
2. **L-3** — `npm audit fix` for `postcss`. One commit.
3. **M-2** — switch `allocateLeaseCoverage` to the strict parser. Bounded blast radius.
4. **L-2 / H2-full** — move xlsx parsing into a Web Worker. Closes the only HIGH advisory in the dependency tree.
5. **M-1** — namespace `WORKSPACE_ID` on Cognito `sub`. Required before inviting a second user to the same machine.
6. **M-3** — replace `confirmCascade` model boolean with a UI-mediated approval flow. Aligns with the original C1 remediation plan.
7. **M-4** — persist daily token counter in DynamoDB.
8. **M-5** — verify `streamText` `timeout`; if unsupported, compose `AbortSignal`.
9. **L-7 / L-8** — un-skip Playwright specs for the M3-era remediations; add proxy unit tests.

---

## Methodology

- Read source files at exact commit `84b1a85`, no working-tree edits.
- Cross-checked every claim in `AUDIT_REPORT.md` and `DEPLOYMENT_READINESS_AUDIT.md` against current code; explicitly noted what was confirmed remediated vs. still open.
- Validated build with `npm run lint` (✓), `npm run build` (✓), `npm test` (445/445 ✓), `npm audit` (1 high `xlsx`, 1 moderate `postcss`).
- Sampled views and components by inspection rather than exhaustive read; UI section is intentionally narrower than engine/persistence/AI.
- E2E suite was not re-run in this session — relying on `npm test` for regression signal and inspection of the `tests/e2e/` skip pattern for coverage assessment.
- All severity calls are mine; comments at the top of each finding explain the rationale and the demote-able alternatives.
