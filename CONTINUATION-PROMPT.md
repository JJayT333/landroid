# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`codex/phase-0-reconcile-2026-05-23`.

Do not commit directly to `main` unless the user explicitly asks for a direct
main push/deploy.

## Current Workstream

Phase 0 rebuild planning reconciliation is active on this branch. This is a
docs-only workstream: adopt Claude's `docs/phase-0-inventory.md` as the draft
master Phase 0 inventory, verify the highest-risk rows, and update the
source-of-truth docs without starting app-code implementation.

Rebuild planning is now documented and amended, but implementation has not
started. The current planning source of truth is `docs/rebuild-plan.md`. It
consolidates the incremental rebuild direction: inventory current page/workflow
behavior first, then Phase 0.5 workspace sharding, project record schema,
evidence-grade document vault, source attestations, import sessions, action
plans/action records, citation-verified AI, project-wide party identity,
well/unit/obligation reference records, and only later gated math expansion.
It also adds the title-opinion-as-root workflow, the Springhill-style Excel plus
document folder package workflow, attorney/eDiscovery packet sidecars,
`MathInputView`, `CitationVerifier`, `OpinionDraft`, `ObligationCalendar`, and
`AbstractorPackage` as rebuild planning requirements. The plan explicitly
reconciles the outside rebuild proposal, the repo-grounded analysis, and the
side-by-side review PDF, while locking dual decimal plus fraction display,
print fidelity, in-flight migration safety, multi-tab conflict handling, and
source citation proof as rebuild contracts.
Proposed ADRs were added for storage trajectory, AI citation verification, and
the action/audit schema. A proposed backend-spine ADR was added after the user
decided the next deep review should focus on Phase 0 and that backend
future-proofing should be decided immediately after Phase 0.

Current agreed rebuild sequence:

1. Reconcile `docs/phase-0-inventory.md` as the working Phase 0 master
   inventory. It contains lane rows, cross-lane contracts, coverage gaps,
   reference workspace plans, golden-master plans, and performance baseline
   plans. Treat it as a draft until high-risk rows are verified.
2. Execute Phase 0 lane by lane under one lead source-of-truth thread. Secondary
   agents may perform read-only lane reviews, but they should not create
   competing master plans.
3. Close Phase 0 with checked-in inventory, frozen or documented reference
   workspaces, expected outputs, performance baselines, manual smoke checks,
   missing coverage, and validation status.
4. Phase 0.75 backend decision is now: backend architecture approved in
   principle; backend implementation deferred until OCR/search/sync scale,
   live sharing, a second user, or browser storage limits force it. Phase 0.5
   through Phase 6 must be local-first and backend-ready.
5. Phase 0.5 storage sharding remains the first implementation phase after
   Phase 0 closes: sharded Dexie rows, multi-tab protection, persistent-storage
   request for PWA/iPad where supported, lazy PDF loading, canvas viewport
   persistence, autosave timing, and Raven Forest iPad Pro-class scale.

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

Commands run on this branch before this reconciliation remain from the prior
audit/rebuild-planning handoff. Current docs-only reconciliation validation:

- `git diff --check -- *.md docs/**/*.md` - passed.
- `rg -n "[ \t]+$" docs/phase-0-inventory.md docs/phase-0-ultrareview-prompt.md`
  - passed after removing one trailing space from the inventory draft.
- Targeted inventory-risk tests passed:
  - `npm test -- src/components/deskmap/__tests__/deskmap-coverage.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/document-migration.test.ts`
    - passed, 3 files / 54 tests.
  - `npm test -- src/ai/__tests__/read-only-tools.test.ts src/ai/__tests__/approval-preview.test.ts src/documents/__tests__/document-registry.test.ts src/storage/__tests__/federal-lease-seed.test.ts src/federal-leasing/__tests__/federal-lease-tracking.test.ts`
    - passed, 5 files / 22 tests.
  - `npm test -- src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts src/storage/__tests__/document-store.test.ts`
    - passed, 3 files / 5 tests.
  - `npm test -- src/store/__tests__/workspace-store-doc-actions.test.ts src/engine/__tests__/fraction-display.test.ts src/storage/__tests__/runsheet-export.test.ts`
    - passed, 3 files / 40 tests.
- `npm run lint` - passed.
- `npm test` - passed, 78 files / 627 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.

Prior validation from the audit/rebuild-planning checkpoint:

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
- `git diff --check -- *.md docs/**/*.md` - passed after the rebuild-plan
  amendment docs-only pass.

## Top Findings To Carry Forward

- P0 before rebuild: `docs/phase-0-inventory.md` is the draft master behavior
  inventory. It still needs lead-thread verification for high-risk rows,
  reference fixture creation, performance baseline capture, and source-doc
  cross-links before Phase 0 can be called done.
- P0.5 before rebuild schema work: workspace persistence needs sharding inside
  Dexie before broad record-schema work so Raven Forest scale does not depend
  on one large autosaved JSON workspace row. Phase 0.5 must also cover
  multi-tab protection, persistent-storage requests for PWA/iPad where
  supported, lazy PDF loading, canvas viewport persistence, autosave timing, and
  an iPad Pro-class Raven Forest scale gate.
- P0.75: Backend architecture is approved in principle, but implementation is
  deferred until OCR/search/sync scale, live sharing, a second user, or browser
  storage limits force it. Phase 0.5 through Phase 6 must be local-first and
  backend-ready.
- Product direction: LANDroid is hosted web first with PWA/iPad support; native
  iOS and desktop installers are deferred. Complete `.landroid` export remains
  permanent.
- Later product lanes to preserve but not start during Phase 0: template-driven
  communications, field/iPad mode, universal Cmd+K search, inline AI entry
  points, persistent workspace chat, three-pane Documents, rolling auto-export,
  and storage health indicators.
- P1: The Document Vault plan now means evidence-grade durability: immutable
  originals, hashes, document versions, extraction runs, citation anchors,
  deterministic manifests, and audit-event continuity.
- P1: AI document-text answers are not allowed before OCR/text extraction
  creates citation anchors and `CitationVerifier` can reject unsupported
  claims.
- P1: The desired runsheet assistant is not built end to end. Current pieces
  parse/stage rows or create desk maps, but not the full guided import,
  question, attachment, owner, lease, and graph workflow.
- P1/P2: AI approval previews now cover the current mutating tools, but they are
  still session-local UI safety surfaces rather than durable audit records.
- P2: Document attachment ordering is still not fully scoped by workspace.

## Open Risks And Assumptions

- This branch contains docs-only Phase 0 reconciliation. Do not start app code,
  fixture generation, demo rename implementation, sharding, backend, or the
  runsheet walkthrough wizard unless the user explicitly redirects.
- `docs/phase-0-inventory.md` and `docs/phase-0-ultrareview-prompt.md` came in
  as untracked Claude/session artifacts. The inventory is now being adopted as
  the draft master Phase 0 inventory; the prompt remains supporting context.
- Current source search verified most top-risk inventory claims. Correction:
  the v7 document migration records orphaned node IDs and uses a fallback
  workspace path; a literal `__orphaned_pre_v8__` workspace was not found in
  current source during reconciliation.
- `docs/landroid-rebuild-plan-reviews.pdf` is currently untracked local input
  from the user; do not delete or commit it unless the user explicitly asks.
- The action journal is in-memory session context, not a durable audit log.
- Approval previews are deterministic, typed summaries for the current proposal;
  they do not persist as formal audit records.
- Lambda source changes under `backend/ai-proxy` still require a manual bundle
  and upload to affect the hosted proxy.
- The full runsheet import-session / walkthrough wizard is still open and should
  not be started without explicit direction.
- SQLite/OPFS, Tauri 2, cloud object storage, and cloud OCR are documented
  decision gates only; they are not Phase 1 defaults.
- Backend implementation is not authorized to start yet. Backend architecture
  is approved in principle, but build is deferred until a documented hard
  trigger and security/deployment/test updates.
- MCP servers are relevant later for external systems such as county records,
  OCR, GIS, storage vaults, or backend-only connectors, but should not bypass
  LANDroid approval/undo/audit boundaries.

## Likely Next Steps

- Review the docs diff for consistency and decide whether to commit
  `docs/phase-0-inventory.md` as the Phase 0 master draft.
- Next Phase 0 work after docs reconciliation: generate/freeze reference
  workspaces, capture expected outputs, capture performance baselines, and mark
  remaining inventory rows as verified or `needs verification`.
- Before any external sharing, rename the Crackbaby Carnival demo fixture to a
  professional Texas-funny name chosen by the user.
- Do not start the full runsheet walkthrough wizard unless the user explicitly
  redirects to that scope.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on
`codex/phase-0-reconcile-2026-05-23`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, `DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first.
This is a docs-only Phase 0 reconciliation branch. `docs/phase-0-inventory.md`
is being adopted as the draft master Phase 0 inventory after Claude's lane
review. Source docs now need to reflect: backend approved in principle but
deferred until OCR/search/sync or another hard trigger; LANDroid remains
local-first, hosted-web/PWA first, with `.landroid` export permanent; Phase 0.5
must shard Dexie storage, add multi-tab protection, persistent-storage request,
lazy PDF loading, canvas viewport persistence, autosave timing, and iPad
Pro-class Raven Forest scale; Phase 1 records must be backend-ready. Do not
start app code, fixtures, demo rename implementation, backend, sharding, or the
runsheet walkthrough wizard unless explicitly directed. Current docs validation
passed with `git diff --check -- *.md docs/**/*.md`.
