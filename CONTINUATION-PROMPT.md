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

Phase 0 rebuild planning reconciliation is active on this branch. The first
checkpoint adopted Claude's `docs/phase-0-inventory.md` as the draft master
Phase 0 inventory and updated source-of-truth docs. A follow-up cleanup renamed
the second demo fixture to Vulcan Mesa and archived the ultrareview prompt; no
rebuild implementation has started.
`AGENTS.md` now includes an efficiency/reporting rule: use targeted validation
and delta summaries for docs/fixtures/planning work, keep full rigor for risky
code/data/security/architecture work, and give the user brief orientation each
turn without reopening settled scope.
The branch now also includes a Phase 0 performance-baseline capture walkthrough,
status template, reproducible closeout capture script, and closeout evidence.
PERF-01 through PERF-06 and PERF-08 are captured under
`fixtures/phase-0/perf/2026-05-24-codex-closeout/`; PERF-07 remains blocked
until a deterministic 5,000-row spreadsheet import fixture exists.
AI-036 system-prompt rule integrity is also frozen with a Phase 0 snapshot and
targeted test.
The Phase 0 manual smoke-check runbook is documented, and the branch now
contains browser smoke artifacts for the highest-risk current surfaces.
`SECURITY.md` now states the rebuild security verdict explicitly: the planned
direction is safer only if backup/export, local-first, private-storage,
AI/citation, sync-conflict, and threat-model gates are actually implemented.
The fixture generator now also emits a deterministic W2 Raven Forest stress
manifest/checksum without committing a full large `.landroid` export.
A lightweight local browser smoke artifact now exists for the Vulcan Mesa demo
load, but the full manual smoke runbook is still not complete.
A broader main-tab smoke artifact also exists; it found current Flowchart React
DOM-prop warnings from `src/components/canvas/OwnershipEdge.tsx`.
A lane-detail/export smoke artifact now records read-only Documents, Leasehold,
Owners, Runsheet, Federal Leasing, and Research signals plus a `.landroid`
export download checksum.
A Runsheet CSV export smoke artifact now records a mismatch between the browser
UI export and the committed generated W1 runsheet golden; the UI export appears
globally chronological while the generated golden begins tract-grouped.
The user decided Runsheet ordering must be user-controlled: global instrument
date, global file date, individual tract, whole-project grouped-by-tract, and
later manual/custom package order. Future Runsheet goldens must be named by
ordering/filter mode rather than treated as one generic `demo.runsheet.csv`.
Document preview smoke now confirms Documents registry PDF actions and Desk Map
document chips open blob-backed iframe previews with `sandbox="allow-downloads"`.
Packet manifest smoke now records that `Packet: Runsheet` downloads 32 items
while the committed full-registry packet manifest golden contains 64 items; this
is a named packet-source golden gap, not an implementation fix to make during
Phase 0 inventory.
AI panel smoke now records the visible local-first AI surface: the panel opens
on W1, defaults to Ollama `gpt-oss:20b`, exposes Ollama/OpenAI/Anthropic
settings, and keeps Send disabled with empty input. No browser LLM call or
mutating proposal was attempted; targeted AI tests cover approval boundaries.
Flowchart/print surface smoke now records Desk Map import into React Flow,
toolbar/page-size/Print controls, and current `OwnershipEdge` DOM-prop console
errors. Closeout perf evidence also includes print-media screenshots for all
8 W2 print pages; this is visual proof, not an automated visual-diff guard.
`.landroid` round-trip smoke now records that a readiness-gated UI export
contains the v8 package shape, side-store keys, 64 documents, 64 attachments,
canvas data, and no legacy `pdfData` key, then re-imports behind the typed
`LOAD WORKSPACE` destructive confirmation. A prior immediate-export attempt
before the Documents registry was visibly ready produced zero exported
documents; treat export timing as a Phase 0 risk/evidence item, not as a
current-phase implementation fix.
Curative/Maps/Sales Deck smoke now records current empty-state/reference
surface behavior: Curative issue filters, Maps present/edit/upload controls,
and the native 10-slide Sales Deck plus legacy PDF/PowerPoint actions.
Future-version rejection smoke now records that a version `999` `.landroid`
probe fails visibly with `Import Failed` after the destructive `LOAD WORKSPACE`
confirmation and leaves Vulcan Mesa intact. Multi-tab boundary smoke now
records that a second same-context tab opens the same workspace with no visible
lock, read-only banner, conflict prompt, or editing-elsewhere warning.
V7 orphan import smoke now records that W3 replaces W1's 64-document side store
with 2 migrated PDFs and surfaces `legacy-orphan.pdf` as linked to
`node legacy-orphan-node`; the orphan blob is preserved, but there is still no
dedicated orphan-discovery/recovery UI.
Closeout performance capture now records W2 Desk Map render, Documents load,
packet preview, `.landroid` export/import timing, Flowchart print screenshots,
W1 autosave debounce, and W2 Leasehold transfer-order timing. The W2 UI
`.landroid` export was imported successfully, but the 15.8 MB package was
removed from the working tree after recording its size and checksum.

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
audit/rebuild-planning handoff. Current reconciliation and demo-rename
validation:

- `./node_modules/.bin/tsx scripts/generate-phase-0-fixtures.ts` - passed;
  wrote deterministic Vulcan Mesa W1 fixtures under `fixtures/phase-0/`.
- `shasum -a 256 fixtures/phase-0/demo.landroid fixtures/phase-0/demo.runsheet.csv fixtures/phase-0/demo.packet-manifest.json fixtures/phase-0/demo.leasehold-decimals.json fixtures/phase-0/demo.coverage-summary.json`
  - passed; `demo.landroid` matched `fixtures/phase-0/demo.sha256`.
- `npm test -- src/phase0/__tests__/vulcan-mesa-fixtures.test.ts` - passed, 1
  file / 8 tests.
- `git diff --check -- *.md docs/**/*.md` - passed.
- `rg -n "[ \t]+$" docs/phase-0-inventory.md docs/phase-0-ultrareview-prompt.md`
  - passed after removing one trailing space from the inventory draft.
- `git diff --check -- *.md docs/**/*.md src/**/*.ts src/**/*.tsx` - passed.
- `npm test -- src/ai/__tests__/runChat-hosted.test.ts` - passed, 1 file / 4
  tests.
- `npm run lint` - passed after fixing one single-quote syntax issue in the
  renamed Vulcan Mesa seed.
- `npm test` - passed, 80 files / 640 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `git diff --check -- *.md docs/**/*.md fixtures/phase-0/* scripts/*` -
  passed after adding the performance-baseline capture walkthrough and status
  template.
- `npm test -- src/ai/__tests__/system-prompt.test.ts` - passed, 1 file / 5
  tests.
- `git diff --check -- *.md docs/**/*.md fixtures/phase-0/* fixtures/phase-0/ai/* fixtures/phase-0/perf/* src/**/*.ts scripts/*`
  - passed after adding the AI snapshot and manual smoke runbook.
- `npm run lint` - passed after adding the AI system-prompt snapshot test and
  manual smoke runbook.
- `./node_modules/.bin/tsx scripts/generate-phase-0-fixtures.ts` - passed after
  adding W2 stress-manifest generation; W1 `.landroid` checksum remained stable.
- Local Playwright Chromium smoke against `npm run dev -- --host 127.0.0.1` -
  passed after rerunning outside the macOS sandbox: Vulcan Mesa loaded from
  Demo Data with no console/page errors. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-local-browser-smoke.json`.
- Broad local Playwright Chromium tab smoke - rendered all 11 main tabs with
  recognizable content; recorded current Flowchart React DOM-prop warnings.
  Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-main-tabs-smoke.json`.
- Lane-detail/export Playwright Chromium smoke - confirmed the Vulcan Mesa load
  guard, read-only lane signals for Documents, Leasehold, Owners, Runsheet,
  Federal Leasing, and Research, and a `.landroid` export download with
  checksum. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-lane-detail-export-smoke.json`.
- Runsheet export Playwright Chromium smoke - downloaded the browser CSV export
  without console/page errors, but the checksum did not match
  `fixtures/phase-0/demo.runsheet.csv`. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-runsheet-export-smoke.json`.
- Runsheet ordering contract documented in `docs/phase-0-inventory.md`,
  `docs/rebuild-plan.md`, and `TESTING.md`: preserve multiple user-controlled
  ordering/filter modes and name future goldens by mode.
- Document preview Playwright Chromium smoke - registry PDF actions and Desk
  Map document chips opened blob-backed iframes with `sandbox="allow-downloads"`
  and no console/page errors. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-document-preview-smoke.json`.
- Packet manifest Playwright Chromium smoke - `Packet: Runsheet` manifest
  downloaded and parsed as JSON, but did not match the full-registry packet
  golden because the packet source item set differs. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-packet-manifest-smoke.json`.
- AI panel Playwright Chromium smoke - panel opened, local Ollama defaults and
  hosted provider options were visible, and Send remained disabled while input
  was empty. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-ai-panel-boundary-smoke.json`.
- Targeted AI approval-boundary tests - `npm test -- src/ai/__tests__/approval-preview.test.ts src/ai/__tests__/approval-store.test.ts src/ai/__tests__/action-journal.test.ts src/ai/__tests__/chat-context.test.ts src/ai/__tests__/system-prompt.test.ts`
  passed, 4 files / 12 tests. The named approval-store path did not correspond
  to a runnable file; Vitest ran the existing matching files.
- Flowchart/print surface Playwright Chromium smoke - Desk Map import rendered
  React Flow nodes/edges, page-size controls, toolbar controls, and Print
  action; current `OwnershipEdge` DOM-prop console errors were recorded.
  Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-flowchart-print-surface-smoke.json`.
- `.landroid` round-trip Playwright Chromium smoke - after waiting for the
  Documents registry ready state, File -> Save workspace exported a parseable
  v8 package with 64 documents, 64 attachments, side-store keys, canvas data,
  and no legacy `pdfData`; File -> Load workspace required `LOAD WORKSPACE` and
  restored the registry. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-landroid-roundtrip-smoke.json`.
- Curative/Maps/Sales Deck Playwright Chromium smoke - Curative empty-state
  filters, Maps present/edit/upload controls, and the native 10-slide Sales
  Deck plus legacy PDF/PowerPoint actions were recorded without attempting
  mutations. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-curative-maps-sales-smoke.json`.
- Future-version rejection Playwright Chromium smoke - a temp version `999`
  `.landroid` probe failed visibly after `LOAD WORKSPACE` confirmation and left
  Vulcan Mesa intact. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-future-version-rejection-smoke.json`.
- Multi-tab boundary Playwright Chromium smoke - two same-context tabs opened
  the same local workspace with no visible lock/read-only/conflict warning.
  Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-multi-tab-boundary-smoke.json`.
- V7 orphan import Playwright Chromium smoke - W3 import replaced W1's
  64-document registry with 2 migrated PDFs, preserved `legacy-orphan.pdf`, and
  showed it linked to `node legacy-orphan-node`. Evidence:
  `fixtures/phase-0/manual-smoke/2026-05-24-v7-orphan-import-smoke.json`.
- Closeout performance/print Playwright Chromium capture -
  `node scripts/capture-phase-0-closeout-evidence.mjs http://127.0.0.1:5174/ 2026-05-24-codex-closeout`
  passed after running outside the macOS sandbox. It captured PERF-01 through
  PERF-06 and PERF-08, machine profile, W2 `.landroid` export/import size and
  checksum, and print-media screenshots for 8 W2 Flowchart pages. PERF-07
  remains blocked pending `fixtures/phase-0/import-stress.csv`. Evidence:
  `fixtures/phase-0/perf/2026-05-24-codex-closeout/`.
- `node --check scripts/capture-phase-0-closeout-evidence.mjs` - passed.
- `git diff --check -- AGENTS.md PROJECT_CONTEXT.md CONTINUATION-PROMPT.md CHANGELOG.md TESTING.md docs/phase-0-inventory.md fixtures/phase-0/perf scripts/capture-phase-0-closeout-evidence.mjs`
  - passed.
- `npm test -- src/phase0/__tests__/vulcan-mesa-fixtures.test.ts src/storage/__tests__/autosave-change-detection.test.ts`
  - passed, 2 files / 10 tests.
- Targeted storage/fixture tests - `npm test -- src/phase0/__tests__/vulcan-mesa-fixtures.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/document-migration.test.ts src/storage/__tests__/autosave-change-detection.test.ts`
  passed, 4 files / 44 tests.
- Full unit test suite - `npm test` passed, 80 files / 640 tests. Expected
  stderr from tests that intentionally simulate Dexie failures was observed.
- Type/lint check - `npm run lint` passed.
- Production build - `npm run build` passed. Vite reported existing
  chunk-size/dynamic-import warnings for large app chunks and mixed static/
  dynamic imports; no build failure.
- E2E workflow suite - `npm run test:e2e` passed, 11 Chromium tests. It reused
  the local dev server and covered seeded document chips, document registry
  metadata/packet preview, inline project rename, export/import preservation,
  branch-scoped lease deletion, curative issues, research records/imports, and
  federal leasing workflows.
- Hosted predeploy repo check - `bash scripts/predeploy-check.sh` passed. The
  script confirmed required hosted files, Cognito build guards, Lambda package
  script/dependencies, Lambda zip contents, and durable usage-store guard. It
  also reported the expected `REPLACE_WITH_FUNCTION_URL_HOST` rewrite-template
  placeholder; AWS console setup is still required for deployment.
- Targeted inventory-risk tests passed:
  - `npm test -- src/components/deskmap/__tests__/deskmap-coverage.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/document-migration.test.ts`
    - passed, 3 files / 54 tests.
  - `npm test -- src/ai/__tests__/read-only-tools.test.ts src/ai/__tests__/approval-preview.test.ts src/documents/__tests__/document-registry.test.ts src/storage/__tests__/federal-lease-seed.test.ts src/federal-leasing/__tests__/federal-lease-tracking.test.ts`
    - passed, 5 files / 22 tests.
  - `npm test -- src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts src/storage/__tests__/document-store.test.ts`
    - passed, 3 files / 5 tests.
  - `npm test -- src/store/__tests__/workspace-store-doc-actions.test.ts src/engine/__tests__/fraction-display.test.ts src/storage/__tests__/runsheet-export.test.ts`
    - passed, 3 files / 40 tests.
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
  PERF-07 fixture/capture, remaining source-doc cross-links, and named
  golden-master expansion before Phase 0 can be called done.
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

- This branch contains Phase 0 reconciliation plus the Vulcan Mesa demo rename.
  Do not start fixture generation, sharding, backend, or the runsheet
  walkthrough wizard unless the user explicitly redirects.
- `docs/phase-0-inventory.md` and `docs/phase-0-ultrareview-prompt.md` came in
  as Claude/session artifacts. The inventory is now committed as the draft
  master Phase 0 inventory; the prompt was archived under
  `docs/archive/prompts/`.
- Current source search verified most top-risk inventory claims. Correction:
  the v7 document migration records orphaned node IDs and uses a fallback
  workspace path; a literal `__orphaned_pre_v8__` workspace was not found in
  current source during reconciliation.
- The W1 Runsheet UI export and committed generated W1 runsheet golden do not
  currently match. Treat this as a Phase 0 ordering-contract decision, not an
  implementation bug to patch during inventory. The product decision is now
  multi-mode Runsheet ordering, so the next implementation step is named
  goldens and UI/export support for those modes, not picking only one order.
- The W1 packet manifest UI export for `Packet: Runsheet` and the committed
  full-registry packet manifest golden do not currently match. Treat this as a
  named packet-source contract gap; add packet-source-specific goldens later.
- Closeout print screenshots prove W2 print pages render, but they are not an
  automated visual-diff contract. Page screenshots should be reviewed before
  treating print fidelity as closed.
- Closeout W2 export/import timing was captured after waiting for Documents
  readiness. The earlier zero-document immediate export remains a timing risk
  to decide before implementation work proceeds.
- Multi-tab smoke currently shows no visible lock, read-only banner, conflict
  prompt, or editing-elsewhere warning. Phase 0.5 must make an explicit
  protection decision instead of leaving this implicit.
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

- W1 Vulcan Mesa fixture freezing is now partly complete: `.landroid`,
  checksum, runsheet CSV, packet manifest, leasehold decimals, coverage summary,
  fixture manifest, and regeneration script exist under `fixtures/phase-0/`.
- W3 migration-stress fixture now exists and is covered by the Phase 0 fixture
  test.
- W2 Raven Forest-scale fixture strategy is documented as
  `fixtures/phase-0/raven-forest-stress-recipe.md`; the deterministic manifest
  is `fixtures/phase-0/raven-forest-stress-manifest.json`. Do not commit a full
  large W2 `.landroid` export unless a later generated artifact stays
  reviewably small.
- Phase 0 performance capture is documented in
  `scripts/capture-phase-0-baselines.md`; current PERF status lives at
  `fixtures/phase-0/perf/baseline-status.json`. The closeout script
  `scripts/capture-phase-0-closeout-evidence.mjs` captured PERF-01 through
  PERF-06 and PERF-08; PERF-07 still needs the deterministic import-stress CSV.
- AI-036 system-prompt rule integrity is covered by
  `fixtures/phase-0/ai/system-prompt.snapshot.md` and
  `src/ai/__tests__/system-prompt.test.ts`.
- Manual smoke-check instructions are documented in
  `docs/phase-0-manual-smoke-checks.md`; browser smoke evidence now covers
  Vulcan Mesa demo-load, main tabs, lane-detail/export, Runsheet export,
  document previews, packet manifest, AI panel, Flowchart/print surface,
  `.landroid` round trip, Curative/Maps/Sales Deck, future-version rejection,
  multi-tab boundary, and W3 v7 orphan import.
- Security direction is clarified in `SECURITY.md`; backend work still requires
  a concrete threat model before implementation.
- Next Phase 0 work: add the deterministic PERF-07 import-stress CSV, capture
  PERF-07, review W2 print screenshots, decide the export-readiness timing
  risk, decide the multi-tab protection contract for Phase 0.5, split Runsheet
  goldens into named ordering modes when that contract is implemented, split
  packet manifest goldens into named source modes when that contract is
  implemented, and mark remaining inventory rows as verified or
  `needs verification`.
- Do not start the full runsheet walkthrough wizard unless the user explicitly
  redirects to that scope.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on
`codex/phase-0-reconcile-2026-05-23`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, `DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first.
This is a Phase 0 reconciliation branch with the draft master inventory,
Vulcan Mesa demo rename, archived ultrareview prompt, W1 Vulcan Mesa fixture
set, W3 migration-stress fixture, and W2 Raven Forest stress-test recipe.
It also includes `scripts/capture-phase-0-baselines.md`,
`scripts/capture-phase-0-closeout-evidence.mjs`, and
`fixtures/phase-0/perf/baseline-status.json`; PERF-01 through PERF-06 and
PERF-08 are captured under
`fixtures/phase-0/perf/2026-05-24-codex-closeout/`, while PERF-07 remains
blocked until a deterministic import-stress CSV exists.
AI-036 has a system-prompt snapshot fixture and test.
Manual smoke-check instructions live in
`docs/phase-0-manual-smoke-checks.md`; smoke artifacts now cover Vulcan Mesa
demo-load, main tabs, lane-detail/export, Runsheet export, document preview,
packet manifest, AI panel, Flowchart/print surface, `.landroid` round trip,
Curative/Maps/Sales Deck, future-version rejection, multi-tab boundary, and W3
v7 orphan import. Closeout print screenshots exist, but no visual-diff guard
has been added.
`SECURITY.md` clarifies that hosted/backend work can be safer than today's
browser-only durability story only if the documented safety gates ship.
`docs/phase-0-inventory.md` is the draft master Phase 0 inventory after
Claude's lane review. `fixtures/phase-0/` contains deterministic W1 goldens
generated by `scripts/generate-phase-0-fixtures.ts`; W2 is documented as a
rebuild stress recipe plus deterministic manifest/checksum instead of a
committed exact large export. Runsheet ordering is now a user-controlled
multi-mode contract: global instrument date, global file date, single-tract,
grouped-by-tract, and later manual/custom package order. Backend
architecture is approved in principle but deferred until OCR/search/sync or
another hard trigger; LANDroid remains local-first, hosted-web/PWA first, with
`.landroid` export permanent; Phase 0.5 must shard Dexie storage, add multi-tab
protection, persistent-storage request, lazy PDF loading, canvas viewport
persistence, autosave timing, and iPad Pro-class Raven Forest scale; Phase 1
records must be backend-ready. Do not start backend, sharding, or the runsheet
walkthrough wizard unless explicitly directed.
