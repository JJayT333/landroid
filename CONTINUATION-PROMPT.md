# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

`feat/phase-2.5-ocr-citation-anchors` — OCR/text extraction and citation-anchor
record foundation is ready for Claude review. Do not merge from this branch in
Codex. Phases 0, 0.5, 0.75, 1, and 2 are already merged to `main`; this branch
was created from local `main` on 2026-06-01.

Merged to `main` (squash; each validated by CI = lint + test + build):

- #82 `feat(storage): write workspace shards on autosave behind a single-writer
  lease` — shard writer that closes the edit-stranding data-loss regression
  (autosave writes the shard set in one transaction; monolith is a frozen backup
  re-anchored on workspace change; recency-aware, per-user-DB-key-scoped reads
  closing the cross-user shard leak, Bug 001).
- #86 `feat(storage): surface single-writer read-only state with takeover` —
  multi-tab read-only UI (editing-elsewhere banner + explicit takeover; canvas
  autosave shares the lease gate) plus a two-tab Playwright e2e. (Replaced the
  auto-closed #83 after its stacked base branch was deleted on #82's merge.)
- #84 `test(storage): lock the document-vault lazy-load contract` — lazy-load
  contract tests + sharded autosave perf recapture at 1476-node scale.
- #85 `feat(storage): request persistent browser storage on startup` — Storage
  API request, recorded, non-blocking.

Do not commit directly to `main` unless the user explicitly asks for a direct
main push/deploy.

## Current Workstream

OCR/text citation foundation is active on this branch. The goal is to make
document text evidence citeable without sending project documents to cloud
services by default. This branch is additive only: no UI migration, no Zustand
store migration, no `.landroid` format change, no OCR subprocess execution, no
cloud upload path, and no destructive side-store rewrite.

Current implementation state:

- `src/backend-spine/contracts.ts` adds `extraction_run`, local/cloud provider
  decision metadata, confidence summaries, derivative OCR/text vault-object
  kinds, source-citation creation metadata, and citation-anchor `vaultObjectId`
  plus polygon support.
- `src/project-records/extraction-runs.ts` adds a pure local-first builder for
  extraction-run lineage, derivative vault objects, source citations, and
  anchors. It keeps `selectable_pdf_text` separate from `scanned_pdf_ocr`.
- Derivative objects reference the original via `derivedFromVaultObjectId`.
  Failed or canceled runs cannot emit derivatives or citations.
- Cloud OCR remains interface-only. The schema requires per-document user
  opt-in, provider, data-residency warning acceptance, and retention-policy
  acknowledgement, but no upload path or fallback exists.
- `verifyCitationSupport` now rejects document-text citations until the record
  set includes a successful/partial extraction run, an output vault object, and
  page plus character-span anchors.
- AI document-text answers remain disabled. This branch only tightens the
  record/verifier prerequisites.

Local Mac tooling checkpoint:

- Present: Tesseract 5.5.2 with `eng`, `osd`, `snum`.
- Present: Poppler 26.04.0 tools `pdftotext`, `pdfimages`, `pdftoppm`.
- Present: qpdf 12.3.2, Ghostscript 10.07.0, Python 3.13.9.
- Missing: `ocrmypdf` and `mutool`. Searchable PDF generation should wait for
  `ocrmypdf` or an equivalent local pipeline before engine integration.

Validation passed:

- `npm test -- src/backend-spine/__tests__/contracts.test.ts src/project-records/__tests__/workspace-record-adapter.test.ts src/project-records/__tests__/evidence-vault.test.ts src/project-records/__tests__/extraction-runs.test.ts`
  - passed, 4 files / 20 tests.
- `npm run lint` - passed.
- `npm test` - passed, 99 files / 737 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `git diff --check` - passed.
- `git diff --check -- '*.md' 'docs/**/*.md'` - passed.

Not run: Playwright e2e, because this branch does not change UI workflows.

Open review notes:

- Check whether the additive `extraction_run` schema should remain contract
  version 1 until a server storage/sync cutover, or whether the reviewer wants a
  version bump before any hosted validation path accepts these records.
- Actual OCR engine execution, searchable PDF generation, storage writes,
  indexes, and AI document Q&A are intentionally deferred.
- Existing untracked local noise was present before this work and should remain
  excluded unless the user explicitly asks:
  `docs/archive/audits/LINE_BY_LINE_AUDIT_2026-05-31.md` and
  `scripts/springhill/`.

Earlier Phase 0 rebuild planning reconciliation adopted Claude's
`docs/phase-0-inventory.md` as the draft master Phase 0 inventory and updated
source-of-truth docs. A follow-up cleanup renamed the second demo fixture to
Vulcan Mesa and archived the ultrareview prompt.
`AGENTS.md` now includes an efficiency/reporting rule: use targeted validation
and delta summaries for docs/fixtures/planning work, keep full rigor for risky
code/data/security/architecture work, and give the user brief orientation each
turn without reopening settled scope.
The branch now also includes a Phase 0 performance-baseline capture walkthrough,
status template, reproducible closeout capture script, and closeout evidence.
PERF-01 through PERF-06 and PERF-08 are captured under
`fixtures/phase-0/perf/2026-05-24-codex-closeout/`; PERF-07 is captured under
`fixtures/phase-0/perf/2026-05-25-codex-perf07/`.
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
8 W2 print pages. A 2026-05-25 visual review found the pages are nonblank print
proof, and the user confirmed print preview is visible and saves correctly.
Manual node rearrangement after Desk Map import is understood as expected
current behavior; automated visual-diff remains future hardening.
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
W1 autosave debounce, PERF-07 Import wizard parse-only timing, and W2
Leasehold transfer-order timing. The W2 UI
`.landroid` export was imported successfully, but the 15.8 MB package was
removed from the working tree after recording its size and checksum.

Rebuild implementation has started for the Phase 0.75 minimal backend spine,
which is now implemented, deployed, committed, and pushed. Phase 0.5
storage-sharding implementation has also started with pure/unwired scaffolding:
`src/storage/workspace-shards.ts`, `src/storage/workspace-write-lock.ts`, a
named autosave debounce constant, `src/storage/workspace-shard-migration.ts`,
Dexie v10 shard/write-lease tables, shard-first runtime workspace load, and
focused tests. No live Dexie shard write path or write-lock gate is wired yet;
autosave still writes the monolithic `workspaces.data` row. Runtime workspace
load now reads complete shards first and falls back to the monolith with a
startup warning when shards are incomplete/corrupt. The current planning source
of truth is `docs/rebuild-plan.md`. It consolidates the incremental rebuild
direction:
inventory current page/workflow behavior first, then Phase 0.75 minimal backend
spine, Phase 0.5 workspace sharding, project record schema,
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
ADRs were added for storage trajectory, AI citation verification, the
action/audit schema, and the backend spine. ADR 0008 now records the updated
Phase 0.75 decision: build the minimal spine before sharding, while deferring
full storage/sync/OCR/search/collaboration backend scope.
The first Phase 0.75 implementation slice is now in place: shared schemas in
`src/backend-spine/contracts.ts`, local/mock/hosted adapters in
`src/backend-spine/adapter.ts`, a hidden app startup contract check in
`src/backend-spine/app-contract-check.ts`, a minimal `backend/spine` handler
package for health/session/record-validation proof, a deployable
`backend/spine/src/lambda.ts` wrapper, `/api/spine/<*>` Amplify rewrite
template support, deploy/smoke checks, and
`docs/backend-spine-threat-model.md`.
Phase 0.5 kickoff planning now inventories the current Dexie/storage surface,
identifies `workspaces.data` as the first shard target, keeps existing
side-store tables intact for the first slice, defines migration/rollback and
`.landroid` compatibility rules, preserves local-first/offline behavior, and
requires pessimistic single-writer protection plus lazy blob loading before the
storage shard can be called complete. The first Phase 0.5 code slice builds
backend-spine `workspace_manifest` and `desk_map` envelopes from current
`WorkspaceData`, keeps current ownership/leasehold/UI state as local-only
compatibility rows, round-trips back to `WorkspaceData`, tests UI-state-only
changes separately from title/Desk Map shards, and tests the future multi-tab
write-lease contract plus lazy document-registry metadata reads. The second
Phase 0.5 code slice adds deterministic monolith-to-shards migration plus
shards-to-monolith rollback helpers. The third slice bumps Dexie to v10,
creates the shard/write-lease tables, backfills shard rows from existing
monolithic `WorkspaceRecord` rows, preserves the monolith for fallback, and
skips corrupt autosave rows with a warning instead of blocking database open.
The shard-runtime branch adds a pure shard reader with monolith fallback:
complete shards load, incomplete/corrupt shards recover from the monolith, and
unrecoverable missing/corrupt fallback rows report corruption. The
`codex/phase-0-5-runtime-load-2026-05-28` branch wires `loadWorkspaceFromDb`
to use the shard reader first, while keeping autosave monolith-only.

Current agreed rebuild sequence:

1. Phase 0 is effectively closed with checked-in inventory, frozen or
   documented reference workspaces, expected outputs, performance baselines,
   manual smoke evidence, full validation, and user print confirmation.
2. Future-contract goldens remain parked for the implementation phase that
   creates each behavior; do not fake them as Phase 0 coverage.
3. Keep `docs/phase-0-inventory.md` as the Phase 0 behavior catalog and verify
   lane rows again when a later phase touches that lane.
4. Phase 0.75 is complete for the minimal backend-spine slice: shared
   backend-shaped record/API contracts, adapter boundaries, auth/session proof,
   validation endpoints, hosted `/api/spine/*` routing, smoke evidence, and
   deployment docs are in place. Full backend storage, object storage,
   OCR/search jobs, sync, sharing, collaboration, and multi-user permissions
   remain later gates.
5. Phase 0.5 storage sharding follows the Phase 0.75 contract: sharded Dexie
   rows, multi-tab protection, persistent-storage request for PWA/iPad where
   supported, lazy PDF/blob loading, canvas viewport persistence, autosave
   timing, and Raven Forest iPad Pro-class scale.
6. Phase 0.5 implementation has begun with tests and pure migration adapters,
   not a semantic project-record rewrite. Current `OwnershipNode` rows remain
   local-only compatibility payloads until Phase 1 defines the final
   `InstrumentRecord` / `InterestReference` split.

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

Phase 0.5 Dexie v10 shard-table upgrade validation on 2026-05-27:

- `npm test -- src/storage/__tests__/workspace-shard-dexie-migration.test.ts src/storage/__tests__/workspace-shards.test.ts`
  - passed, 2 files / 10 tests.
- `npm run lint`
  - passed.
- `npm test`
  - passed, 90 files / 684 tests. Existing intentional stderr coverage for
    simulated Dexie failures appeared.
- `npm run build`
  - passed with existing Vite dynamic/static import warnings, chunk-size
    warning, and Node `module.register()` deprecation warning. The build now
    emits a small `workspace-shard-migration` chunk from the dynamic v10
    upgrade import.
- `npm run test:e2e`
  - passed, 11 Chromium workflows in 24.6s, with existing Node
    `module.register()` and FORCE_COLOR/NO_COLOR warnings.
- `npm run deploy:check`
  - passed; repo template still intentionally contains AI/spine Function URL
    placeholders for fresh deploy rendering.

Phase 0.5 shard-reader validation on 2026-05-27:

- `npm test -- src/storage/__tests__/workspace-shard-reader.test.ts src/storage/__tests__/workspace-shards.test.ts src/storage/__tests__/workspace-shard-dexie-migration.test.ts`
  - passed, 3 files / 16 tests.
- `npm run lint`
  - passed.
- `npm test`
  - passed, 91 files / 690 tests. Existing intentional stderr coverage for
    simulated Dexie failures appeared.
- `npm run build`
  - passed with existing Vite dynamic/static import warnings, chunk-size
    warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e`
  - passed, 11 Chromium workflows in 25.6s, with existing Node
    `module.register()` and FORCE_COLOR/NO_COLOR warnings.
- `npm run deploy:check`
  - passed; repo template still intentionally contains AI/spine Function URL
    placeholders for fresh deploy rendering.

Phase 0.5 runtime load-switch validation on 2026-05-28:

- `npm test -- src/storage/__tests__/persistence-db-key.test.ts src/storage/__tests__/workspace-shard-reader.test.ts`
  - passed, 2 files / 12 tests.
- `npm run lint`
  - passed.
- `npm test`
  - passed, 91 files / 693 tests. Existing intentional stderr coverage for
    simulated Dexie failures appeared.
- `npm run build`
  - passed with existing Vite dynamic/static import warnings, chunk-size
    warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e`
  - passed, 11 Chromium workflows in 26.6s, with existing Node
    `module.register()` and FORCE_COLOR/NO_COLOR warnings.
- `npm run deploy:check`
  - passed; repo template still intentionally contains AI/spine Function URL
    placeholders for fresh deploy rendering.

Phase 0.5 first scaffolding validation on 2026-05-27:

- `npm test -- src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/workspace-shards.test.ts src/storage/__tests__/workspace-write-lock.test.ts src/storage/__tests__/document-store.test.ts`
  - passed, 4 files / 14 tests.
- `npm run lint`
  - passed.
- `npm test`
  - passed, 89 files / 678 tests. Existing intentional stderr coverage for
    simulated Dexie failures appeared.
- `npm run build`
  - passed with existing Vite dynamic/static import warnings, chunk-size
    warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e`
  - passed, 11 Chromium workflows in 29.2s, with existing Node
    `module.register()` and FORCE_COLOR/NO_COLOR warnings.
- `npm run deploy:check`
  - passed; repo template still intentionally contains AI/spine Function URL
    placeholders for fresh deploy rendering.
- `git diff --check`
  - passed.

Phase 0.5 migration-helper validation on 2026-05-27:

- `npm test -- src/storage/__tests__/workspace-shards.test.ts src/storage/__tests__/workspace-write-lock.test.ts src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/document-store.test.ts`
  - passed, 4 files / 17 tests after fixing the migration fixture to use
    persisted-valid decimal node fractions.
- `npm run lint`
  - passed.
- `npm test`
  - passed, 89 files / 681 tests. Existing intentional stderr coverage for
    simulated Dexie failures appeared.
- `npm run build`
  - passed with existing Vite dynamic/static import warnings, chunk-size
    warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e`
  - passed, 11 Chromium workflows in 27.7s, with existing Node
    `module.register()` and FORCE_COLOR/NO_COLOR warnings.
- `npm run deploy:check`
  - passed; repo template still intentionally contains AI/spine Function URL
    placeholders for fresh deploy rendering.
- `git diff --check`
  - passed.

Phase 0.5 storage-sharding kickoff planning validation on 2026-05-26:

- `git diff --check -- '*.md' 'docs/**/*.md'`
  - passed after the Phase 0.5 planning and handoff doc updates.

Phase 0.75 backend-spine hosted-wiring validation on 2026-05-26:

- `npm test -- src/backend-spine/__tests__/app-contract-check.test.ts src/backend-spine/__tests__/adapter.test.ts src/backend-spine/__tests__/contracts.test.ts`
  - passed, 3 files / 15 tests.
- `cd backend/spine && npm ci`
  - passed; local Node v26 emitted the expected `EBADENGINE` warning because
    the package targets Node 22 through `<26`, matching the repo/Lambda target.
- `cd backend/spine && npm audit --omit=dev`
  - initial sandbox run failed on registry DNS; rerun with approved network
    access passed with 0 vulnerabilities.
- `npm test -- --config backend/spine/vitest.config.ts`
  - passed, 2 files / 12 tests.
- `./node_modules/.bin/tsc -p backend/spine/tsconfig.json --noEmit`
  - passed.
- `cd backend/spine && npm run build`
  - passed.
- `cd backend/spine && npm run bundle`
  - passed and produced ignored `backend/spine/lambda.zip` at 1.2 MB.
- `COGNITO_USER_POOL_ID=us-east-1_TWeBB7xvQ COGNITO_CLIENT_ID=6os4uiu0b46pf74nhbrm5gsg0v node -e 'import("./backend/spine/dist/backend/spine/src/lambda.js").then(() => console.log("lambda import ok"))'`
  - passed after fixing deployed Node ESM import extensions in
    `backend/spine/src/lambda.ts` and `backend/spine/src/handler.ts`.
- `bash scripts/render-amplify-rewrites.sh https://ai123.lambda-url.us-east-1.on.aws/ https://spine456.lambda-url.us-east-1.on.aws/`
  - passed and rendered separate `/api/ai/<*>` and `/api/spine/<*>` rewrites.
- `npm run deploy:check`
  - passed; the repo template keeps AI/spine Function URL placeholders, while
    the live Amplify app now has concrete `/api/ai/<*>` and `/api/spine/<*>`
    custom rules.
- AWS deploy via `landroid-deploy` profile:
  - created `landroid-backend-spine-role` with
    `AWSLambdaBasicExecutionRole`.
  - created `landroid-backend-spine` in `us-east-1`, Node.js 22.x, arm64,
    handler `backend/spine/src/lambda.handler`, 128 MB, 10 sec timeout.
  - created Function URL
    `https://pdnipzleitt4l6dihshut54is40prgzk.lambda-url.us-east-1.on.aws/`
    with auth `NONE` and CORS for `https://landroid.abstractmapping.com`.
  - added both required Lambda URL resource-policy permissions:
    `lambda:InvokeFunctionUrl` with `FunctionUrlAuthType=NONE` and
    `lambda:InvokeFunction` with `InvokedViaFunctionUrl=true`.
  - updated Amplify app `d11pv0mh1atit4` custom rules so `/api/spine/<*>`
    proxies to the spine Function URL before the SPA fallback.
- Direct Function URL smoke:
  - `/health` returned 200.
  - unauthenticated `/session` returned 401.
  - unauthenticated `/validate-records` returned 401.
  - oversized `/validate-records` returned 413.
- CloudWatch log check:
  - structured request/reject JSON appeared for health/session/validation
    without record payloads or request bodies.
- `bash scripts/smoke-test-hosted.sh`
  - passed against `https://landroid.abstractmapping.com`; coverage included
    root HTML, security headers, `/api/ai/*` unauthenticated rejection,
    `/api/spine/*` health/auth/body-limit checks, SPA fallback, and Cognito
    metadata/JWKS.
- `npm run lint` - passed.
- `git diff --check -- '*.md' 'docs/**/*.md' 'src/**/*.ts' 'src/**/*.tsx' 'backend/spine/**/*.ts' 'backend/spine/package.json' 'backend/spine/tsconfig.json'`
  - passed.
- `npm test` - passed, 87 files / 667 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed after the AWS Lambda ESM import fix, with existing
  Vite dynamic/static import warnings, chunk-size warning, and Node
  `module.register()` deprecation warning.
- `npm run test:e2e` - passed after the AWS Lambda ESM import fix, 11 Chromium
  workflows in 27.2s, with existing Node `module.register()` and
  FORCE_COLOR/NO_COLOR warnings.

Phase 0.75 backend-spine validation on 2026-05-25:

- `npm test -- src/backend-spine/__tests__/contracts.test.ts src/backend-spine/__tests__/adapter.test.ts`
  - passed, 2 files / 8 tests.
- `npm test -- --config backend/spine/vitest.config.ts`
  - passed, 1 file / 7 tests.
- `./node_modules/.bin/tsc -p backend/spine/tsconfig.json --noEmit`
  - passed.
- `npm run lint` - passed.
- `npm test` - passed, 86 files / 660 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `npm run deploy:check` - passed; AWS console setup is still required and the
  Amplify rewrite template placeholder remains expected.
- `cd backend/spine && npm run build` - passed.
- `git diff --check -- *.md docs/**/*.md src/**/*.ts backend/spine/**/*.ts backend/spine/package.json backend/spine/tsconfig.json`
  - passed.
- `npm run test:e2e` - passed, 11 Chromium workflows, with existing Node
  `module.register()` and FORCE_COLOR/NO_COLOR warnings.

Closeout validation on 2026-05-25:

- `npm test` - passed, 84 files / 652 tests. Existing intentional stderr
  coverage for simulated Dexie failures appeared.
- `npm run lint` - passed.
- `npm run build` - passed with existing Vite dynamic/static import warnings,
  chunk-size warning, and Node `module.register()` deprecation warning.
- `npm run test:e2e` - passed, 11 Chromium workflows.
- `npm run deploy:check` - passed; AWS console setup is still required and the
  Amplify rewrite template placeholder remains expected.

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
  checksum, and print-media screenshots for 8 W2 Flowchart pages. Evidence:
  `fixtures/phase-0/perf/2026-05-24-codex-closeout/`.
- PERF-07 Import wizard parse-only capture -
  `node scripts/capture-phase-0-closeout-evidence.mjs http://127.0.0.1:5173/ 2026-05-25-codex-perf07 --perf07-only`
  passed after running outside the macOS sandbox. It uploaded the deterministic
  `fixtures/phase-0/import-stress.csv` fixture through the Import wizard,
  stopped before Analyze/Stage/Apply, and recorded 5,000 data rows parsed in
  198 ms wall clock with max observed frame gap 16.7 ms and no console/page
  errors. Evidence:
  `fixtures/phase-0/perf/2026-05-25-codex-perf07/`.
- In-app Browser check - loaded `http://127.0.0.1:5173/`, confirmed title
  `LANDroid v2`, meaningful Desk Map content, and visible Demo Data controls
  before the Playwright capture fallback.
- `./node_modules/.bin/tsx scripts/generate-phase-0-fixtures.ts` - passed
  after adding the deterministic PERF-07 import-stress CSV fixture; W1
  `.landroid` checksum remained stable.
- `npm test -- src/phase0/__tests__/vulcan-mesa-fixtures.test.ts src/ai/wizard/__tests__/parse-workbook.test.ts`
  - passed, 2 files / 16 tests.
- `node --check scripts/capture-phase-0-closeout-evidence.mjs` - passed after
  adding the `--perf07-only` path.
- `git diff --check -- CHANGELOG.md CONTINUATION-PROMPT.md TESTING.md docs/phase-0-inventory.md fixtures/phase-0 scripts src/phase0/__tests__/vulcan-mesa-fixtures.test.ts`
  - passed.
- `npm run lint` - passed after adding the PERF-07 fixture/test/capture updates.
- Flowchart print visual review - inspected all 8 W2 print screenshots from
  `fixtures/phase-0/perf/2026-05-24-codex-closeout/` and recorded findings in
  `fixtures/phase-0/perf/2026-05-24-codex-closeout/perf-06-print-visual-review.json`.
  The pages are nonblank print proof. The user confirmed on 2026-05-25 that
  print preview is visible and saves correctly, with manual node rearrangement
  after Desk Map import expected.
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

- P0: Phase 0 is effectively closed after full validation and user print
  confirmation. Future-contract goldens remain parked for the phase that
  implements each behavior.
- P0.75 before P0.5: the minimal backend spine is implemented and deployed so
  storage sharding can use backend-shaped records from the start. The completed
  slice is shared schemas, a record envelope, adapter boundary, and
  health/session/validation endpoints, not full backend storage or
  collaboration.
- P0.5 after P0.75: workspace persistence still needs sharding inside Dexie so
  Raven Forest scale does not depend on one large autosaved JSON workspace row.
  Phase 0.5 must also cover multi-tab protection, persistent-storage requests
  for PWA/iPad where supported, lazy PDF loading, canvas viewport persistence,
  autosave timing, and an iPad Pro-class Raven Forest scale gate.
- P0.5 kickoff planning: `docs/rebuild-plan.md` now records the concrete
  current persistence inventory, initial shard order, migration/rollback rules,
  `.landroid` compatibility strategy, local-first/offline constraints,
  pessimistic single-writer plan, lazy blob-loading plan, and targeted
  test/performance gates. No sharding code has been started.
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
- Closeout print screenshots prove W2 print pages render, and the user
  confirmed the Flowchart print preview/save path works for Phase 0. Automated
  visual-diff remains later hardening rather than a Phase 0 blocker.
- Closeout W2 export/import timing was captured after waiting for Documents
  readiness. The earlier zero-document immediate export remains a timing risk
  before real-use storage/backup work, but the 2026-05-25 decision is not to
  add a Phase 0 UI block because the app is not being used for production work
  during rebuild. Future normal export should be disabled or hard-blocked until
  document side stores are hydrated, with any partial diagnostic export clearly
  labeled as partial.
- Multi-tab smoke currently shows no visible lock, read-only banner, conflict
  prompt, or editing-elsewhere warning. The 2026-05-25 Phase 0.5 contract is
  pessimistic single-writer protection: first tab writable, later tabs
  read-only with a visible warning and explicit takeover confirmation.
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
- Full backend implementation is not authorized yet. The authorized Phase 0.75
  scope is the minimal spine: shared contracts, adapter boundary, auth/session
  proof, and validation endpoints with matching security/deployment/test
  updates.
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
  PERF-08.
- AI-036 system-prompt rule integrity is covered by
  `fixtures/phase-0/ai/system-prompt.snapshot.md` and
  `src/ai/__tests__/system-prompt.test.ts`.
- Phase 0 closeout now also adds current-behavior guards for AI mutating-tool
  registry drift, AI undo snapshot sections, local AI `stepCountIs(8)`
  configuration, AI app-context omission disclosure, AI approval document
  metadata details, packet-manifest output shape, `.landroid` document-export
  workspace scoping, lease-allocation tie-breaks, federal lease exclusion from
  Texas math, GeoJSON permissive-mode behavior, RRC fixed-width 1-index
  slicing, and performance-baseline artifact linkage.
- Manual smoke-check instructions are documented in
  `docs/phase-0-manual-smoke-checks.md`; browser smoke evidence now covers
  Vulcan Mesa demo-load, main tabs, lane-detail/export, Runsheet export,
  document previews, packet manifest, AI panel, Flowchart/print surface,
  `.landroid` round trip, Curative/Maps/Sales Deck, future-version rejection,
  multi-tab boundary, and W3 v7 orphan import.
- Security direction is clarified in `SECURITY.md`; the minimal backend-spine
  threat-model note is `docs/backend-spine-threat-model.md`.
- Phase 0.75 app-side contract check is wired from startup through
  `src/backend-spine/app-contract-check.ts`; it sends health, session, and a
  synthetic project-record validation probe only and does not change user-facing workflows.
- Phase 0.75 repo-side hosted wiring for `/api/spine/*` is ready: separate
  `landroid-backend-spine` Lambda package, live Lambda Function URL, live
  Amplify `/api/spine/<*>` rewrite, render helper, predeploy checks, smoke
  checks, CI steps, and deployment docs. Hosted smoke evidence passed on
  2026-05-26.
- Next Phase 0.5 work: before coding, turn the kickoff plan into the smallest
  implementation slice: storage migration tests, shard read/write adapters,
  autosave debounce extraction, write-lock tests, and lazy document/blob
  contract tests. Future-contract goldens are parked in
  `docs/phase-0-inventory.md` for Phase 0.5 / Phase 0.75 / Phase 1 instead of
  being faked as Phase 0 tests.
- Do not start the full runsheet walkthrough wizard unless the user explicitly
  redirects to that scope.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid`. Read `AGENTS.md`
(including the Conventions section), `PROJECT_CONTEXT.md`, `docs/README.md`,
`DEPLOYMENT_STATE.md`, and this file before touching code.

Workstream: `shard-runtime` (Phase 0.5 storage sharding) — COMPLETE and merged
to `main` (2026-05-30, PRs #82, #86, #84, #85; see the Current Branch section).
Integrated `main` is green: `npm run lint`, `npm test` (95 files / 723 tests),
`npm run build`. Sharded autosave measured at 1476-node scale: 2276 ms persist
vs a 2062 ms monolith baseline, evidence under
`fixtures/phase-0/perf/2026-05-30-shard-autosave/`.

Next task is the remaining Phase 0.5 follow-up, at a lower / medium effort level
(NOT extra-high): the metadata-first conversion of the blob-bearing side stores
so project open never holds blob bytes, mirroring what the document vault
already does. Scope and gotchas:
- Stores/loaders: `owner-persistence.ts` (`ownerDocs`), `map-persistence.ts`
  (`mapAssets`), `research-persistence.ts` (`researchImports`) each `toArray()`
  blob-bearing rows at `setWorkspace`; the zustand stores retain the blobs for
  the session.
- The hard part is the UI: `MapsView`, `DeskMapView`, `OwnerDocsTab`, and
  `ResearchView` read `asset.blob` / `doc.blob` / `researchImport.blob`
  SYNCHRONOUSLY (object URLs, `.text()` parsing, downloadBlob, preview modals).
  Converting to metadata-first means adding on-demand blob fetchers
  (`getMapAssetBlob` / `getOwnerDocBlob` / `getResearchImportBlob`, like
  `getDocBlob`) and making those reads async.
- Do it ONE store at a time with its own PR; mirror the locked vault contract
  test in `document-store-lazy.test.ts`. This is evidence-gated — the held
  blobs are lazy IndexedDB references today, so confirm it's worth it (or just
  land the readers + tests and defer the UI rewrite if risk outweighs value).
- Also available, lower value: per-view edit-control disabling for read-only
  tabs (the lease banner is signalling + a write gate today; individual edit
  controls are not disabled).

Resolved (do not redo): edit-stranding data-loss regression, cross-user shard
leak (Bug 001), single-writer lease + multi-tab read-only UI + takeover,
document-vault lazy contract, post-import monolith re-anchor, autosave perf
recapture, persistent-storage request.

Holds: do not start full backend storage/sync, OCR/search, the runsheet
walkthrough wizard, or any federal/private math without explicit direction.
LANDroid remains local-first; `.landroid` package export remains the
permanent escape hatch.
