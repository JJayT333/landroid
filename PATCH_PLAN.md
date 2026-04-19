# LANDroid Audit Patch Plan

Date: 2026-04-19  
Repository: `/Users/abstractmapping/projects/landroid`  
Source audit: `/Users/abstractmapping/projects/landroid/AUDIT_REPORT.md`

This plan orders remediation in the smallest safe sequence, prioritizing
blast-radius reduction before broader cleanup. It is now a living checklist:
check status here before treating the original audit wording as current.

## Current Status Summary

| Finding / Workstream | Status | Current Notes |
| --- | --- | --- |
| C1 AI live mutation approval boundary | Partial | Rollback, cancel/status, and timeout safety improved. Live local mutations remain intentionally available for the current single-user workflow. Full proposal/approval queue remains open. |
| H1 workbook prompt injection into mutating chat | Partial | First deterministic `Review rows` staging flow exists. The old guided chat path still needs stronger isolation/proposal gating. |
| H2 vulnerable `xlsx` read path | Open | Still needs file-size containment, worker isolation, or parser replacement. |
| H3 persisted cloud AI keys | Done | Cloud keys are session-only; persisted settings keep only safe fields. |
| H4 Texas-only active math gates | Done | Active math and attach paths filter/reject non-Texas math leases. |
| H5 strict AI lease validation and owner matching | Done | AI lease creation strict-validates economics and Texas jurisdictions; attach rejects linked-owner mismatch. |
| H6 root total invariant | Open | Over-100 title states remain allowed with clearer warning; root rebalance/predecessor policy still needs a final invariant decision. |
| H7 AI timeout/cancel controls | Partial | Chat cancel/status and provider timeouts exist. Cost/output budgets and workbook analysis cancellation remain candidates. |
| M1 atomic batch graft | Open | Batch graft can still partially mutate. |
| M2 explicit desk-map targeting | Open | Invalid explicit `deskMapId` fallback still needs hard rejection. |
| M3 `.landroid` import hardening | Open | Side-store normalization and size limits remain. |
| M4 CSV import strictness | Open | Invalid fraction and duplicate-ID behavior still needs hardening. |
| M5 Desk Map lease overlap warning | Open | Lease overlap warnings still need Desk Map surfacing. |
| M6 docs and handoff cleanup | Partial | Professional docs rails added; ongoing status updates must keep them current. |
| M7 skipped e2e workflows | Open | 5 Playwright workflows remain skipped. |

## Phase 0: Freeze the Risky Surface

Goal: prevent the most dangerous AI behavior while deeper fixes are built.

In scope:

- Temporarily disable AI mutating tools or route them to proposal-only responses.
- Disable `Walk me through it` mutating workbook import.
- Keep read-only AI tools available if needed.

Out of scope:

- Rewriting the AI architecture.
- Changing deterministic math behavior.

Validation:

- Add a test proving AI chat cannot mutate stores while the freeze is active.
- Run `npm run lint`, `npm test`.

## Phase 1: Security Blockers

### 1. App-enforced AI approval boundary

Fixes:

- C1: live AI mutations without authoritative approval.
- H1: workbook prompt injection into mutating tools.

Smallest safe implementation:

- Split tools into read-only tools and proposed-mutation tools.
- Make mutating tools return structured pending actions instead of calling stores.
- Add a UI review queue in `AIPanel`.
- Only execute pending actions after explicit user click.
- For destructive actions, require an app-generated nonce from a preview response.

Tests:

- Mock model attempt to call `deleteNode(confirmCascade: true)` before approval; assert no mutation.
- Approve a pending action; assert exactly one intended mutation.
- Workbook prompt-injection fixture; assert no mutation and no pending destructive action.

### 2. AI provider key hardening

Fixes:

- H3: browser-persisted cloud keys.

Smallest safe implementation:

- Stop persisting `openaiApiKey` and `anthropicApiKey` to localStorage.
- Keep provider/model/base URL persistence if desired.
- Add a clear UI notice that cloud keys are session-only.
- Prefer Ollama default.

Tests:

- Mock persisted storage and verify cloud keys are absent.
- Verify `isConfigured()` still works with in-memory keys.

### 3. Workbook parser containment

Fixes:

- H2: vulnerable `xlsx` dependency on user-controlled files.

Smallest safe implementation:

- Add strict file-size limits before `file.arrayBuffer()`.
- Parse in a Web Worker or isolate behind a cancellable task.
- Evaluate replacement parser for read paths.
- If no safe replacement is immediately available, disable `.xls/.xlsx` upload for AI import and keep `.csv` only until replacement.

Tests:

- Oversized workbook rejected before parsing.
- Malformed workbook error does not mutate state.
- UI exits loading state on parser failure.

## Phase 2: Correctness Bugs

### 4. Enforce Texas-only active math jurisdiction

Fixes:

- H4: federal/private/tribal leases in active Texas math.
- H5: AI lease creation/attachment bypasses jurisdiction checks.

Smallest safe implementation:

- Add `isTexasMathLease(lease)` helper.
- Use it in:
  - `getActiveLeases`
  - leasehold summary lease grouping
  - desk-map coverage
  - attach-lease eligibility
  - AI `createLease` / `attachLease`
- Reject or quarantine non-Texas active-math attach attempts.

Tests:

- Federal/private active lease does not alter Desk Map coverage.
- Federal/private active lease does not alter Leasehold summary.
- AI cannot create or attach non-Texas lease into active math.

### 5. Strict AI lease economics and owner matching

Fixes:

- H5: malformed lease economics and wrong-owner attachments.

Smallest safe implementation:

- Reuse strict parser from UI save paths for `royaltyRate` and `leasedInterest`.
- Reject invalid fields before saving.
- Require `lease.ownerId === parent.linkedOwnerId` in `attachLease`, except through an explicit documented override path.

Tests:

- Invalid `leasedInterest` and `royaltyRate` rejected.
- Owner mismatch rejected.
- Valid existing lease attaches successfully.

### 6. Root total invariant

Fixes:

- H6: rebalance/predecessor can create roots over 1.

Smallest safe implementation:

- Decide whether incomplete imports are represented by multiple orphan roots or a staging mode.
- Enforce root mineral total <= 1 for active desk-map math.
- Add operation-level guards for root rebalance/predecessor insert.

Tests:

- Rebalance root above 1 fails.
- Predecessor insert above root above 1 fails.
- Valid incomplete import path remains possible only if explicitly modeled.

### 7. Atomic batch graft

Fixes:

- M1: partial `graftToParent` mutations.

Smallest safe implementation:

- Build a candidate graph in memory for all grafts.
- Validate the whole candidate graph.
- Commit once only if all grafts pass.

Tests:

- One invalid orphan means no parent IDs change.
- All valid orphans commit together.

### 8. Explicit desk-map targeting

Fixes:

- M2: invalid explicit `deskMapId` falls back to active map.

Smallest safe implementation:

- If `deskMapId` is provided and not found, fail with `lastError`.
- Preserve current fallback only when no explicit `deskMapId` is provided.

Tests:

- Missing explicit desk map rejects root creation.
- Omitted desk map still uses active map.

## Phase 3: AI Safety and Reliability

### 9. Timeout, cancel, and cost controls

Fixes:

- H7: no timeout/abort/cost controls.

Smallest safe implementation:

- Add `AbortController` to chat and workbook analysis.
- Add visible Cancel button.
- Add per-turn timeout.
- Add max output tokens or provider-equivalent budget where supported.
- Ensure abort does not commit snapshots or partial pending actions.

Tests:

- Never-resolving model can be canceled.
- Timeout returns a user-visible error.
- Aborted turn does not mutate or save undo state.

### 10. Prompt isolation

Fixes:

- H1 and broader prompt-injection risk.

Smallest safe implementation:

- Wrap workbook contents in a clearly delimited data block.
- Escape quotes/newlines enough that rows cannot masquerade as instructions.
- Add prompt language that workbook content is untrusted data.
- Keep mutating tools disabled during workbook analysis regardless of prompt text.

Tests:

- Workbook cell that says "delete everything" is treated as data.

## Phase 4: Import Hardening

### 11. `.landroid` import normalization and size limits

Fixes:

- M3: side-store under-normalization and unbounded blobs.

Smallest safe implementation:

- Add max `.landroid` file size.
- Add max total serialized blob bytes and per-blob bytes.
- Normalize owners and contacts before `replaceOwnerWorkspaceData`.
- Reject records missing required IDs.

Tests:

- Malformed owner/contact records rejected or normalized.
- Oversized base64 blob fails before decode.

### 12. CSV import strictness

Fixes:

- M4: invalid fractions to zero, duplicate IDs dropped silently.

Smallest safe implementation:

- Use strict decimal/fraction parsing.
- Report row-level validation errors.
- Reject duplicate node IDs.
- Run graph validation before returning.

Tests:

- Invalid numeric values fail with row/column error.
- Duplicate node IDs fail.
- Valid legacy CSV still imports.

## Phase 5: Missing Tests

Goal: convert the audit into deterministic regression coverage.

Add or restore:

- AI mutator approval tests.
- AI prompt-injection tests.
- AI provider timeout/cancel tests.
- Jurisdiction exclusion tests.
- Import hardening tests.
- Root total invariant tests.
- Atomic graft tests.
- Retarget all skipped e2e tests in `tests/e2e/landroid-workflows.spec.ts`.

Validation:

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `npm audit --omit=dev`

## Phase 6: Cleanup and Docs

Fixes:

- M6: stale docs and handoff files.
- Dead-code/duplicate-path findings.

Smallest safe implementation:

- Update `README.md` current surfaces/demo/test coverage.
- Update `USER_MANUAL.md` to document the active AI layer and its limits.
- Clarify archived audit reports as historical.
- Replace stale `audit finding #...` comments with current domain explanations or links to active docs.
- Update `CONTINUATION-PROMPT.md` after the remediation phase.

Validation:

- Markdown review by inspection.
- Run full relevant validation commands after any code-adjacent changes.
