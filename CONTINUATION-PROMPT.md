# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`codex/audit-pass-a-2026-05-20`.

Do not commit directly to `main` unless the user explicitly asks for a direct
main push/deploy.

## Current Workstream

AI/security/structure/performance audit remediation has started. Phase 0 plus
the first Phase 1 AI safety chunks are implemented on this branch.

Primary report:

- `docs/archive/audits/AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`

Pass A remains the backbone. Phase 0 pulled in the verified Pass B overlaps the
user listed:

- AI undo snapshot capture now fails closed if document side-store export fails.
- `.landroid` import rejects future schema versions.
- `.landroid` side-store replacement rolls back to previous active side stores
  if replacement fails before core workspace swap.
- Focused Leasehold decimal rows filter unit-scoped ORRI/WI by the focused
  tract's unit and `includedInMath`.
- CSV row staging no longer defaults ambiguous NPRI rows to fixed /
  burdened-branch. Unknown fixed/floating or fixed-basis answers mark the row
  `needs_question` / `needs answer` and block node creation until answered.

The next AI foundation chunk is also implemented:

- Approved AI proposals now capture structured approval details before the user
  applies them.
- Approval cards now show typed before/after previews and graph-validation
  previews where LANDroid can simulate the proposal.
- Proposals with blocked previews cannot be approved and do not take undo
  snapshots.
- Applied / failed / undone AI proposal results are recorded in an in-memory
  session action journal.
- Future local AI turns receive a concise approved-action journal so chained
  edits can reuse exact IDs and validation results from earlier approved work.
- The AI panel exposes the recent approved-action journal, and replacing a
  workspace clears approval, undo, and action-journal state.
- The hosted AI proxy now rejects client-supplied `tools` / `tool_choice`
  fields before usage charging or upstream forwarding.
- Map asset uploads now use an explicit passive-file allowlist and validate PDF
  magic bytes before saving or previewing PDF maps.

The full runsheet walkthrough wizard has not been started.

## Latest Validation

Commands run on this branch:

- `npm run lint` - passed.
- Red/green targeted checks:
  - `npm test -- src/components/leasehold/__tests__/leasehold-summary.test.ts`
    initially failed on wrong-unit ORRI/WI focused rows, then passed after the
    filter fix.
  - `npm test -- src/ai/__tests__/undo-store.test.ts` initially failed because
    document export errors were swallowed, then passed after the fail-closed
    change.
  - `npm test -- src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts`
    initially failed for unsupported future version / missing rollback helper,
    then passed after the storage fixes.
  - `npm test -- src/ai/wizard/__tests__/row-staging.test.ts` initially failed
    on NPRI fixed / burdened-branch defaults, then passed after the
    `needs_question` staging change.
- `npm test -- src/ai/wizard` - passed, 3 files / 27 tests.
- `npm test -- src/ai/__tests__/action-journal.test.ts src/ai/__tests__/chat-context.test.ts src/ai/__tests__/tools.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts`
  - passed, 4 files / 18 tests.
- `npm test -- src/ai/__tests__/approval-preview.test.ts src/ai/__tests__/tools.test.ts src/ai/__tests__/action-journal.test.ts`
  - passed, 3 files / 17 tests.
- `cd backend/ai-proxy && npm test` - passed, 3 files / 41 tests.
- `cd backend/ai-proxy && npm run build` - passed.
- `npm test -- src/maps/__tests__/map-asset-upload.test.ts src/utils/__tests__/file-validation.test.ts src/store/__tests__/map-store.test.ts`
  - passed, 3 files / 23 tests.
- `npm test -- src/ai src/storage src/components/leasehold` - passed, 25 files /
  177 tests. An initial run failed after the undo fail-closed change because AI
  tool tests did not mock document snapshot export; the tests now provide an
  explicit empty document snapshot.
- `npm test` - passed, 78 files / 627 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e` - passed, 11 Playwright tests.
- `git diff --check` - passed.

## Top Findings To Carry Forward

- P1: The desired runsheet assistant is not built end to end. Current pieces
  parse/stage rows or create desk maps, but not the full guided import,
  question, attachment, owner, lease, and graph workflow.
- P1/P2: AI approval previews now cover the current mutating tools, but they are
  still session-local UI safety surfaces rather than durable audit records.
- P2: Document attachment ordering is still not fully scoped by workspace.

## Open Risks And Assumptions

- This branch now contains Phase 0 source/docs remediation plus the original
  audit report artifact, AI approval-preview/action-journal foundation work, and
  map upload hardening, plus an undeployed hosted proxy policy hardening change.
- The action journal is in-memory session context, not a durable audit log.
- Approval previews are deterministic, typed summaries for the current proposal;
  they do not persist as formal audit records.
- Lambda source changes under `backend/ai-proxy` still require a manual bundle
  and upload to affect the hosted proxy.
- The full runsheet import-session / walkthrough wizard is still open and should
  not be started without explicit direction.
- MCP servers are relevant later for external systems such as county records,
  OCR, GIS, storage vaults, or backend-only connectors, but should not bypass
  LANDroid approval/undo/audit boundaries.

## Likely Next Steps

- Continue the Phase 1 AI foundation in small steps:
  - make result summaries more domain-specific where tool outputs are richer,
  - decide whether any action-journal records should become durable audit
    records later.
- Then choose the next hardening item:
  - document attachment ordering scoped by workspace,
  - structured runsheet import-session model.
- Do not start the full runsheet walkthrough wizard unless the user explicitly
  redirects to that scope.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on
`codex/audit-pass-a-2026-05-20`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, `DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first.
Pass A is `docs/archive/audits/AI_SECURITY_STRUCTURAL_AUDIT_2026-05-20.md`.
Phase 0 is implemented: AI undo fail-closed, future `.landroid` version
rejection, rollback-safe `.landroid` side-store replacement, focused Leasehold
ORRI/WI unit filtering, and NPRI `needs_question` row staging. The first Phase 1
AI foundation chunk is also implemented: structured approval details,
typed before/after approval previews, graph-validation previews, blocked-preview
approval refusal, in-memory applied/failed/undone action journal, future local
model context from approved results, journal visibility in the AI panel, and
journal clearing on workspace replacement. Hosted proxy source now rejects
client-supplied `tools` / `tool_choice` fields before usage charging; Lambda
changes still need manual bundle/upload to deploy. Map uploads now enforce a
passive allowlist and validate PDF bytes before save/preview. Latest validation passed:
`npm run lint`, targeted Phase 0/action-journal/approval-preview tests,
backend proxy tests/build, targeted map upload tests, `npm test`,
`npm run build`, and `npm run test:e2e`.
Do not start the full runsheet walkthrough wizard unless explicitly directed.
Recommended next small step is document attachment ordering scoped by workspace
or a structured runsheet import-session model.
