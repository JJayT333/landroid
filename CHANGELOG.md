# LANDroid Changelog

This file records meaningful project changes so `CONTINUATION-PROMPT.md` can
stay short.

## 2026-06-10

- Armed the title cutover flip governance at boot after the operator's
  Springhill soak of the merged Scope B hardening (DA-C1 exit complete). The
  flip itself remains a manual banner action gated on green readiness; revert
  stays always available. Also landed from soak findings: the
  lease-record-without-node silent no-op fix (#142) and lessee suggestions in
  both lease forms (#143).
- Scope B hardening (`feat/scope-b-hardening`, deep-audit findings DA-C1,
  DA-H2, DA-H3, DA-M14, DA-M15): journaled eight previously-silent
  title-visible store mutations (desk-map membership and attachment-cache
  changes project into title records); added the journal-coverage exit-gate
  test (semantic check + completeness guard, the new permanent CI invariant);
  disarmed the self-arming cutover flip (`cutoverEnabled` defaults false,
  banner auto-flip removed, re-arm = deliberate `setTitleCutoverArmed(true)`
  after the Springhill soak); journal hook returns a rollback verdict so
  vetoed mutators report failure and skip destructive cascades, and hook
  exceptions surface instead of being swallowed; AI undo now
  hydrates-then-appends (`undoTitleActionRecord` gained its live caller;
  `importAndOpenWorkspace` owns import ledger hydration); title-ledger writes
  and project rename/delete/duplicate are fenced behind the write lease with
  reader-tab hydration memory-only; and the write lease gained a TTL/3 writer
  heartbeat with visibility pause. Docs: SECURITY.md multi-tab section and
  docs/title-tree-read-cutover.md updated to match; audit-backlog statuses
  applied.

- Delivered Part 2 of the deep audit at `docs/deep-audit-2026-06-10-part2.md`
  covering the surfaces Part 1 skipped — Research, Curative, Flowchart/canvas,
  Maps/GIS, Federal Leasing, RRC decoders — with `DA2-*` findings and four
  direction plans: a staged Miro-class flowchart plan (the shape tools are
  built but dead — `addNodes` has zero call sites), an ArcGIS Pro interchange
  plan keyed on the existing `ExternalRef` GlobalID seam, a five-tier RRC
  dataset-ingestion plan (ASCII/CSV/dBase/EBCDIC/shapefile-via-GIS) against
  the live RRC download inventory, and a federal-register plan for the
  BLM-heavy 60k-acre use case (isolation verified at six layers; rich federal
  fields currently demo-only and non-persisted). ROADMAP gains the new lanes;
  Research hardening (DA2-R1/R2) is sequenced ahead of the title-math catalog
  import.
- Added `docs/title-math-research-prompt.md` and its follow-up
  `docs/title-math-research-supplement.md` — paste-ready external research
  briefs for the complete Texas (+ federal/NM) title-math and temporal-law
  catalog, with a machine-importable CSV appendix matched to the Research
  workspace record shapes.
- Delivered a full deep audit at `docs/deep-audit-2026-06-10.md`: severity-ranked
  findings with `DA-*` IDs (1 Critical, 10 High), a display-precision policy and
  migration plan, a Texas-math completeness gap matrix with build order, a
  "lean professional" aesthetics plan, document-storage and AI assessments, and
  roadmap resequencing. Verified against a green suite (979 tests / 140 files,
  Springhill 0.225/0.775, Phase 0 goldens intact). New findings are summarized
  into `docs/audit-backlog.md` pending row-by-row reconciliation.
- Documentation housecleaning: rewrote `ROADMAP.md` as a true short priority
  map with the audit's sequencing (Scope B hardening first) and removed the
  duplicated posture text and stale `PATCH_PLAN.md` reference; corrected stale
  `SECURITY.md` claims (Dexie v14, live write-fence with named heartbeat/ledger
  gaps, hosted AI sends no tools, numeric-only future-version gate); updated
  `docs/title-tree-read-cutover.md` status to merged (#138/#139) with audit
  pointers; reconciled the `AGENTS.md` target root doc set to reality
  (`PROJECT_CONTEXT.md`, `USER_MANUAL.md`, deploy docs; noted the sales-deck
  build import pins `DEPLOYMENT_STATE.md` to root); archived
  `DEPLOYMENT_PLAN.md` (2026-04-21, planning-only, superseded by the live
  deployment) and the root `NEXT-audit-sheet.md` feature brief into
  `docs/archive/`; added the audit's staged-math reconciliation note to
  rebuild-plan Phase 7; fixed the misleading SSN comment in
  `src/types/lease-purchase-report.ts` (no SSN field exists anywhere — DA-L9).

## 2026-06-08

- Added a first-class Lease workflow (Phase 1 of the Lease Purchase Report
  feature). A `LEASE` action now appears on present mineral-owner Desk Map cards
  (next to `CONVEY`), and the `Leasehold` view has an `Add Lease` button with an
  owner picker — both open the same lease editor. A lease is an overlay on the
  present owner and never changes mineral ownership, which is what distinguishes
  it from a conveyance.
- Introduced the `LeasePurchaseReport` record (lease abstract): lessee, lease
  type, lease form (defaults to Producers 88 (7-69)), dates, primary term,
  held-by-production, royalty, bonus/rental, and comments. Each lease is a
  per-tract slice linked to its LPR; the slice still carries lessor interest,
  gross acres, and computed net mineral acres (gross x lessor interest). Math is
  unchanged: only lessor interest, royalty, status, and jurisdiction feed
  coverage/royalty/NRI — every new LPR field is descriptive. Net mineral acres is
  the acre view of the same lessor interest, so the acre and fraction views
  cannot disagree.
- Stored LPRs in a new `leasePurchaseReports` Dexie table (additive v14 schema,
  per-user scoped) and added them to `.landroid` export/import with backward
  compatibility for files written before LPRs.

## 2026-06-07

- Fixed the hosted Amplify rewrite template so `.landroid`, `.pdf`, and
  `.pptx` static assets bypass the SPA fallback instead of being rewritten to
  `index.html`. Added predeploy and hosted-smoke coverage for the Springhill
  `.landroid` sample URL so the Dr. Elmore demo loader can be verified online.

- Stabilized the project picker branch after Springhill/LCT merged. `.landroid`
  and CSV imports now create or reconcile a saved-project identity, switch the
  active project storage key before side-store and snapshot writes, and avoid
  autosaving imported workspaces under the previously active project key. Blank
  implicit startup shells no longer become saved `Untitled Workspace` projects,
  while explicitly created blank projects still remain indexed.

## 2026-06-06

- Fixed the Dr. Elmore Springhill public sample so the LCT Revocable Trust /
  Charlyn K. Tyra Tract 1 owner carries the verified `OGML-LCT-Trust` lease,
  1/4 royalty, a related Desk Map lease node, and leasehold math showing Tract
  1 as fully leased. Added a deterministic sample regression test for the LCT
  owner, lease row, lease node, coverage, NRI constants, and `.landroid`
  import/export preservation.
- Hardened the Springhill sample source workflow: the raw private generator now
  takes configurable source/output paths, refuses to write raw private output or
  reports inside the repository, and has a documented generator -> scrubber ->
  public sample merge gate. README and the user manual now describe Dr. Elmore
  #1 Unit as a bundled scrubbed `.landroid` sample.
- Regenerated the Springhill public sample from the original NRI and DOTO
  runsheet workbooks, then scrubbed the private raw output back into
  `public/samples/springhill-dr-elmore.landroid`. The reconciliation report
  shows zero missing executed lease rows, and the LCT override now preserves the
  OGML-confirmed one-year primary term instead of the bad three-year workbook
  remark.

## 2026-06-05

- Added opt-in rolling local auto-export for browsers that support choosing a
  folder through the File System Access API. Snapshots are timestamped
  `.landroid` files written through the same serializer as manual export, with
  manual `Backup Now` fallback warnings when the API is unavailable or folder
  permission is revoked.

- Added a top-bar storage health panel that shows the latest successful
  browser autosave, latest `.landroid` backup/export, and browser Storage API
  persistence/usage status. Added `Backup Now` as a visible full `.landroid`
  export action that records the latest backup time without changing the
  serializer, autosave authority, or storage model.

- Added the browser-local project picker landing surface. Saved projects are
  indexed in Dexie, each project gets its own workspace storage key, and the
  picker can create, open, rename, duplicate, or typed-confirm-delete projects
  without changing the `.landroid` export/import format or title read path.

## 2026-06-04

- Added bounded whole-project AI context. Local/full context now includes
  all-tract project rollups and unit totals so the assistant can answer
  cross-tract questions without prompt-dumping every title node. Hosted minimal
  mode remains counts/structure only and excludes project names, party names,
  fractions, lease economics, remarks, document references, and record IDs;
  richer hosted rollups still require the full-context disclosure gate.

## 2026-06-02

- Added `.landroid` v9 action-ledger durability. Manual save can embed the
  current title `action_record` and `audit_event` rows as a validated
  `actionLedger` bundle, while the existing snapshot remains authoritative on
  import. v8 files stay readable, v10+ files are rejected, and corrupt embedded
  ledgers are dropped with a warning instead of blocking the snapshot.

- Closed the main-line audit-cleanup batch for the 2026-05-31 line-by-line
  audit. AI NPRI creation now requires explicit royalty characterization,
  document attachment ordering is workspace-scoped, strict import hydration
  clears stale attachment badges, non-Texas math lease attachments are blocked,
  CI branch filters match the branch taxonomy, aggregate local validation
  scripts cover root and backend packages, Ollama CORS guidance uses explicit
  local origins, stale patch-plan docs are archived, and AI settings comments
  match the session-only cloud key policy.

## 2026-06-01

- Added native attorney-packet packaging (finishes the deferred Phase 2 export
  step). `buildAttorneyPacketArchive` turns the deterministic packet projection
  into a downloadable, reproducible store-only ZIP: native originals (unaltered),
  the manifest JSON, a `checksums.sha256` file, and source-citation /
  unresolved-issue / optional eDiscovery sidecars. Every native file is verified
  against its recorded SHA-256 while packing (a mismatch throws rather than
  emitting a corrupt packet). Dependency-free, local-only, additive; the live
  store cutover remains deferred to Phase 4.

- Added Phase 3 import-session staging. Synthetic uploads can now be modeled as
  recurring runsheet or title-opinion source packages with immutable source rows
  and excerpts, staged candidates with confidence and blocking questions,
  `ActionPlan` dry-run previews, side-by-side OCR/text review projections, and
  batch approval into typed action drafts plus source citations. The phase
  remains project-record-only and does not apply target records to live Zustand
  stores or v8 `.landroid` packages.
- Added the local-first OCR/text citation foundation. Backend-spine records now
  model `extraction_run` lineage, derivative OCR/text vault objects, source
  citation creation metadata, and page/span/polygon anchors. The pure extraction
  builder keeps selectable-PDF text separate from scanned-PDF OCR, preserves
  originals through `derivedFromVaultObjectId`, records failures without
  derivatives, and leaves cloud OCR as per-document opt-in metadata only. AI
  document-text answers remain disabled until the UI path can verify citations.
- Added the first Evidence Vault project-record adapter. Registry documents,
  owner documents, map assets, and research imports now project into shared
  `document`, `document_version`, `vault_object`, and `document_link` records
  with SHA-256 hashes and deterministic workspace-scoped links, while v8
  `.landroid` and live Dexie side stores remain authoritative.
- Added deterministic attorney packet export modeling: manifest checksums,
  packet records/items/exports, source-citation sidecars, unresolved issue
  summaries, and optional eDiscovery sidecars are produced as pure
  project-record projections. Native ZIP/PDF packaging remains a later step.
- Added Phase 1 project-record schema foundations beside the running app. The
  backend-spine contract now defines full body schemas for instruments, tracts,
  desk maps, leases, units, wellbores, interest references, curative issues,
  lease obligations/events, and packet records instead of envelope-only stubs.
- Added pure project-record adapters and projections under
  `src/project-records`: current `WorkspaceData` can be validated into
  backend-spine records without serializing blobs, and `MathInputView`,
  `OpinionDraft`, `ObligationCalendar`, `AbstractorPackage`, packet export, AI
  context, and structural citation-verifier contracts are defined read-side.
- Documented the future `.landroid` project-record migration strategy. Phase 1
  keeps the live package format at v8 and makes no UI/store/runtime source of
  truth change.

## 2026-05-30

- Requested persistent browser storage on startup via the Storage API where
  supported, so a workspace's IndexedDB is not silently evicted under storage
  pressure (PWA / iPad durability). The result is recorded for diagnostics and a
  refusal never blocks local-first editing.
- Fixed a data-integrity edge in the shard writer: the monolithic backup row is
  now re-anchored when the active workspace changes (import / CSV / fresh
  install), so a later shard corruption falls back to the current workspace
  instead of the stale pre-import one. A workspace edited in place keeps its
  original migration-time backup.
- Added a two-tab Playwright e2e that exercises the single-writer lease in a
  real browser: the second tab opens read-only with the editing-elsewhere
  banner, an explicit takeover makes it the writer, and the original tab is
  stepped down by the claim broadcast.
- Recaptured autosave timing for the sharded write. At 1476-node Raven Forest
  scale the workspace persists 2276 ms after an edit (2000 ms debounce + ~276 ms
  shard write), versus the 2062 ms monolith baseline — ~210 ms slower, entirely
  off the debounced interaction path. The closeout capture script now measures
  the shard manifest and has an `--autosave-only` mode.

## 2026-05-29

- Locked the document-vault lazy-load contract with tests
  (`document-store-lazy.test.ts`). Project open and registry listing
  (`listDocumentRegistryData`, `listDocsForEntity`, `listAttachmentsForNodes`,
  `getDocMeta`) return blob-free metadata; `getDocBlob` is the only explicit
  byte path for preview/export. A reader that leaks a blob into project open now
  fails the contract test. The blob-bearing side stores (owner docs, map assets,
  research imports) remain a deliberately deferred, evidence-gated follow-up.
- Added the multi-tab read-only UI on top of the single-writer lease. The lease
  is engaged at startup and after a workspace swap, and a second tab now opens
  read-only with a visible "editing elsewhere" banner and an explicit takeover
  confirmation. A writer steps down when a peer claims the lease; a reader
  auto-promotes when the writer releases. Canvas autosave now shares the same
  lease gate so a read-only tab cannot overwrite the writer's viewport/layout.
- Landed the Phase 0.5 shard writer and closed the edit-stranding data-loss
  regression. Workspace autosave now rebuilds the shard set with
  `buildWorkspaceShards` and writes all five shard tables in one Dexie
  transaction, so edit then reload returns the edit instead of the
  v10-migration snapshot. The monolithic `workspaces` row is no longer
  rewritten on autosave; it stays a frozen migration backup the reader falls
  back to with a loud warning.
- Made the shard reader recency-aware: a strictly newer monolith now wins over
  stale shards instead of being discarded.
- Gated shard writes behind the single-writer lease (`BroadcastChannel` plus
  Dexie expiry). The first tab is the single writer; later tabs stay read-only
  and write nothing until the lease expires or is taken over.
- Scoped shard reads and writes by the active per-user DB key, stamped on the
  manifest, and clear the active key's shard rows on workspace replacement and
  sign-out. This closes the cross-user shard leak (Bug 001): a fresh hosted
  user can no longer adopt the previous user's workspace.

## 2026-05-27

- Added the first Phase 0.5 storage-sharding scaffolding without wiring it into
  live persistence. The new pure shard adapter builds backend-spine
  `workspace_manifest` and `desk_map` envelopes, keeps current title/leasehold
  state as local-only compatibility rows, and round-trips back to the current
  `WorkspaceData` shape.
- Added Phase 0.5 guardrails for implementation: a named autosave debounce
  constant, pure multi-tab write-lease evaluator with fencing-token tests, and
  a lazy document-registry test proving registry reads omit document blobs.
- Added the next Phase 0.5 migration slice with a live Dexie v10 schema bump.
  The upgrade creates workspace shard/write-lease tables, derives shard rows
  from existing monolithic `WorkspaceRecord` rows, keeps the monolithic row as
  the live load/save and rollback source, and skips corrupt autosave rows with
  a warning instead of blocking database open.
- Started the Phase 0.5 shard-runtime branch with a pure shard read adapter.
  Complete shard sets can now reconstruct `WorkspaceData`; incomplete or
  corrupt shard sets fall back to the preserved monolithic workspace row, and
  unrecoverable cases report corruption instead of silently opening bad data.
- Wired runtime workspace load to use the shard reader first. Complete v10
  shards now load before the monolith; incomplete/corrupt shards fall back to
  the monolithic row with a startup warning. Autosave still writes only the
  monolith until the write-lease-gated shard writer lands.

## 2026-05-26

- Started Phase 0.5 storage-sharding planning without implementation. The
  kickoff plan now inventories current Dexie tables and persistence paths,
  identifies `workspaces.data` as the first shard target, defines the initial
  shard order, migration/rollback strategy, `.landroid` compatibility rules,
  local-first/offline constraints, pessimistic single-writer plan, lazy blob
  loading plan, and targeted validation/performance gates.
- Wired the non-user-facing Phase 0.75 app contract check through the
  backend-spine adapter. Startup now runs a hidden health/session/synthetic
  project-record validation probe after local startup or hosted auth without
  changing user workflows, project storage, document handling, sync, or
  `.landroid` export.
- Added repo-side hosted wiring for the minimal backend spine: a deployable
  `backend/spine` Lambda wrapper/package, `/api/spine/<*>` Amplify rewrite
  template support, predeploy/smoke checks, and deployment docs. The spine
  remains contract proof only and does not add project storage, document upload,
  OCR/search, sync, collaboration, or permissions.
- Hardened the Phase 0.75 spine after read-only review: every declared
  `recordType` now has a validation-union schema, unfinished domain records use
  strict envelope-only stubs, the app probe validates a synthetic project record,
  hosted startup waits for auth, and the backend-spine handler logs structured
  request/reject events without payloads.
- Deployed the minimal backend spine to AWS as a separate
  `landroid-backend-spine` Lambda and added the live Amplify `/api/spine/<*>`
  rewrite. Hosted smoke now proves spine health, unauthenticated auth rejection,
  oversized-body rejection, and structured CloudWatch logging.

## 2026-05-25

- Updated the rebuild sequence for Phase 0.75: LANDroid should add a minimal
  backend spine before Phase 0.5 storage sharding, limited to shared
  backend-shaped records/API contracts, adapter boundaries, auth/session proof,
  and validation endpoints. Full backend storage, object storage, OCR/search,
  sync, sharing, collaboration, and multi-user permissions remain later gates.
- Added the first Phase 0.75 minimal-spine implementation slice: shared
  backend-spine schemas and adapters under `src/backend-spine`, a minimal
  `backend/spine` health/session/record-validation handler package, tests for
  offline adapters and hosted auth boundaries, and
  `docs/backend-spine-threat-model.md`.
- Closed the Phase 0 export-readiness decision for rebuild use: no Phase 0 UI
  export block, but future normal export must be readiness-gated before real
  work/storage/backup use.
- Recorded the Phase 0.5 multi-tab protection contract: pessimistic
  single-writer behavior with later tabs read-only and an explicit takeover
  path.
- Added Phase 0 closeout guards for AI mutating-tool registry drift, AI undo
  snapshot sections, the local AI 8-step cap, AI app-context omission
  disclosure, AI approval document-metadata details, packet-manifest shape,
  document-export workspace scoping, lease-allocation tie-breaks, federal lease
  exclusion from Texas math, GeoJSON permissive-mode behavior, RRC fixed-width
  slicing, and performance-baseline artifact linkage.
- Fixed `.landroid` document export so cross-workspace attachment rows are not
  included even when they point at an exported workspace document.
- Reclassified remaining Phase 0 golden-master work into current-behavior
  tests now covered versus future-contract goldens for Phase 0.5 / Phase 0.75 /
  Phase 1.
- Recorded the user print confirmation for Flowchart: print preview is visible,
  saving works, and manual node rearrangement after Desk Map import is expected
  current behavior rather than a Phase 0 blocker.

## 2026-05-24

- Added the Phase 0 performance-baseline capture walkthrough and perf status
  template, explicitly marking PERF-01 through PERF-08 as not captured or
  blocked until the W2 stress fixture, browser profiles, machine context, and
  measured results exist.
- Added the AI-036 Phase 0 system-prompt golden snapshot and test coverage for
  the ten non-negotiable rules, critical safety language, mutating-tool prompt
  coverage, and hosted-blocked focus switching.
- Added the Phase 0 manual smoke-check runbook covering Desk Map, Leasehold,
  Documents, Runsheet, Flowchart/print, Owners, Curative, Maps/GIS, Research,
  Federal Leasing, AI approval, and import/export recovery stop conditions.
- Clarified the rebuild security direction in `SECURITY.md`: hosted/backend
  work can improve durability and controlled access, but only with explicit
  backup/export, local-first, private-storage, AI/citation, sync-conflict, and
  threat-model gates.
- Extended the Phase 0 fixture generator so it preserves the current fixture
  README, emits a deterministic W2 Raven Forest stress manifest/checksum, and
  keeps the W1 Vulcan Mesa `.landroid` checksum stable.
- Captured a lightweight local browser smoke artifact showing Vulcan Mesa loads
  from the Demo Data menu with tract tabs, cards, document chips, and no
  console/page errors.
- Captured a broader main-tab smoke artifact across Desk Map, Leasehold,
  Flowchart, Runsheet, Documents, Owners, Curative, Maps, Sales Deck, Federal
  Leasing, and Research. All tabs rendered recognizable content; Flowchart
  emitted current React DOM-prop warnings from `OwnershipEdge`.
- Captured a lane-detail/export smoke artifact for Documents, Leasehold,
  Owners, Runsheet, Federal Leasing, and Research. The run confirmed the Vulcan
  Mesa load guard, recorded key lane signals, and downloaded a `.landroid`
  export with checksum as smoke evidence.
- Captured a Runsheet CSV export smoke artifact from the browser UI. The export
  downloaded cleanly, but its checksum does not match the committed generated
  W1 runsheet golden because the UI export appears globally chronological while
  the current golden begins tract-grouped.
- Recorded the Runsheet ordering product decision: LANDroid must support
  user-controlled global instrument-date, global file-date, single-tract,
  grouped-by-tract, and later manual/custom package order. Future Runsheet
  goldens must name the ordering mode they protect.
- Captured document preview smoke evidence showing both Documents registry PDF
  actions and Desk Map document chips open blob-backed iframe previews with
  `sandbox="allow-downloads"` and no console/page errors.
- Captured packet manifest smoke evidence for `Packet: Runsheet`. The browser
  manifest downloaded and parsed cleanly, but it contains 32 runsheet-source
  items versus 64 full-registry items in the committed packet manifest golden,
  so future packet goldens must be named by packet source mode.
- Captured AI panel smoke evidence showing the panel opens on W1, defaults to
  local Ollama (`gpt-oss:20b`), exposes Ollama/OpenAI/Anthropic settings, and
  keeps Send disabled while input is empty. Mutating approval boundaries were
  validated with targeted AI tests rather than a live LLM call.
- Captured Flowchart/print surface smoke evidence showing Desk Map import
  produces React Flow nodes/edges, page-size controls, tool controls, and a
  Print action, while preserving the current `OwnershipEdge` DOM-prop console
  warnings as Phase 0 evidence.
- Captured `.landroid` round-trip smoke evidence showing the readiness-gated
  UI export contains the v8 package shape, side-store keys, 64 documents, 64
  attachments, and no legacy `pdfData` key, then re-imports behind the typed
  `LOAD WORKSPACE` destructive confirmation. A prior immediate-export attempt
  before the Documents registry was visibly ready produced zero exported
  documents, so export timing is now a named Phase 0 risk.
- Captured Curative/Maps/Sales Deck smoke evidence showing Curative empty-state
  filters, Maps present/edit/upload controls, and the native 10-slide Sales
  Deck plus legacy PDF/PowerPoint actions without attempting mutations.
- Captured future-version rejection smoke evidence showing a version `999`
  `.landroid` probe fails visibly after `LOAD WORKSPACE` confirmation and
  leaves Vulcan Mesa intact.
- Captured multi-tab boundary smoke evidence showing a second same-context tab
  opens the same workspace with no visible lock, read-only banner, conflict
  prompt, or editing-elsewhere warning.
- Captured v7 orphan import smoke evidence showing W3 replaces the prior W1
  document side store, preserves both legacy PDFs, and surfaces the orphan PDF
  as linked to `node legacy-orphan-node`.
- Added a reproducible Phase 0 closeout browser capture script and recorded
  PERF-01 through PERF-06 plus PERF-08 under
  `fixtures/phase-0/perf/2026-05-24-codex-closeout/`. The run captured W2
  Desk Map, Documents, packet preview, `.landroid` export/import, Flowchart
  print screenshots, W1 autosave debounce, and W2 Leasehold timing.
- Added the deterministic PERF-07 import-stress CSV fixture, checksum, expected
  parse-shape metadata, fixture test coverage, and a `--perf07-only` capture
  path. The browser evidence under
  `fixtures/phase-0/perf/2026-05-25-codex-perf07/` records the Import wizard
  parsing 5,000 data rows before Analyze, Stage, or Apply.
- Added a print visual-review artifact for the W2 Flowchart screenshots. The
  review confirms the pages are nonblank print proof while keeping print
  fidelity open because sparse/clipped tiles still need an explicit later
  visual-diff or layout decision.

## 2026-05-23

- Reconciled the Phase 0 planning track around `docs/phase-0-inventory.md` as
  the draft master behavior inventory, with cross-links from the rebuild plan,
  testing policy, roadmap, architecture, security notes, docs map, ADRs, and
  continuation handoff.
- Recorded the backend decision for rebuild planning: backend architecture is
  approved in principle, implementation is deferred until OCR/search/sync scale
  or another hard trigger, and Phase 0.5 through Phase 6 must stay local-first
  while using backend-ready record shapes.
- Added Phase 0.5 planning gates for sharded Dexie storage, multi-tab
  protection, autosave timing, canvas viewport persistence, PWA/iPad persistent
  storage, lazy PDF loading, and Raven Forest-scale validation on iPad-class
  hardware or a documented equivalent.
- Renamed the internal-only second demo fixture to Vulcan Mesa, updated current
  docs and tests to the new name, and archived the Phase 0 ultrareview prompt
  under `docs/archive/prompts/`.
- Added the first Phase 0 frozen fixture set under `fixtures/phase-0/`:
  deterministic Vulcan Mesa `.landroid`, checksum, runsheet CSV, packet
  manifest, leasehold decimals, coverage summary, fixture manifest, and a
  regeneration script.
- Added a Phase 0 golden-master test that consumes the committed Vulcan Mesa
  fixture files and verifies checksum, export counts, runsheet CSV, packet
  manifest, leasehold decimal output, Desk Map coverage summaries, and the W3
  v7 orphaned-PDF migration fixture.
- Documented W2 Raven Forest as a generated rebuild stress-test recipe instead
  of committing today's exact large seed as the permanent fixture.

## 2026-05-20

- Started audit remediation Phase 0: AI undo snapshot capture now fails closed
  if document workspace export fails, so approvals do not create empty document
  undo snapshots.
- Hardened `.landroid` import by rejecting files from future schema versions
  and applying side-store replacement before core workspace swap with rollback
  to the previous active side stores on replacement failure.
- Fixed focused Leasehold transfer-order rows so unit-scoped ORRI and WI
  records only appear for the focused tract's unit and only when included in
  math.
- Changed CSV row staging so ambiguous NPRI rows keep unknown fixed/floating or
  fixed-basis answers, show a `needs answer` state, and cannot create title
  nodes until the user answers.
- Added the next AI safety-foundation chunk: approved proposal results now land
  in an in-memory action/result journal, future local AI turns receive a concise
  journal context with exact created IDs and validation state, approval cards
  show structured tool-input details, and workspace replacement clears the
  transient journal.
- Added typed AI approval previews: proposed local AI edits now show
  before/after effects and graph-validation preview results before approval,
  and blocked previews cannot be approved or take rollback snapshots.
- Tightened the hosted AI proxy request policy so client-supplied OpenAI
  `tools` / `tool_choice` fields are rejected before usage charging or upstream
  forwarding. This keeps hosted chat read-only until a hosted approval/undo path
  is deliberately designed.
- Hardened map asset uploads with an explicit passive-file allowlist and PDF
  magic-byte validation before map PDFs are saved or previewed.

## 2026-05-19

- Replaced the signed-in PDF-only `Pitch Deck` tab with a native `Sales Deck`
  view: ten in-app status/sales slides, slide navigation, build-time Markdown
  status bullets from repo docs, and the existing bundled PDF/PPTX retained as a
  legacy reference section.
- Centralized workspace side-store replacement so demo loads, `.landroid`
  imports, and CSV imports consistently reset missing owner, document,
  curative, map, research, and transient AI approval/undo state instead of
  carrying stale side-section data forward.
- Tightened Desk Map cleanup so `Clear Map` and branch deletes remove owner and
  lease records only when those records were linked exclusively to deleted
  nodes, while preserving records still used by other tracts.
- Added a hosted AI read-only app context packet so signed-in hosted chat
  requests include the active view, project, unit/tract, visible Desk Map
  cards, linked lease summaries, and deterministic mineral coverage totals.
  This lets hosted chat answer questions about the current Desk Map without
  exposing local edit tools.
- Retired the stale tracked Vite asset `dist/assets/xlsx-CkFp8p6R.js`. That
  chunk was leftover generated output from the old `xlsx` parser path; the
  active CSV-only spreadsheet worker now builds without it, and `dist/` is not
  a source-of-truth directory.

## 2026-05-18

- Merged PR #72 into `main`, moved Amplify production to `main`, updated the
  existing Lambda AI proxy to Node.js 22, uploaded the fresh proxy bundle, and
  mapped `landroid.abstractmapping.com` to the `main` Amplify branch.
- Fixed hosted AI token recovery in PR #73 so the AI client can recover the
  Cognito ID token from OIDC storage and no longer sends anonymous proxy
  requests when the in-memory auth bridge is empty.
- Made the Demo Data menu visible in hosted mode for the signed-in POC so the
  Vulcan Mesa and Raven Forest fixtures can be loaded online.
- Added `DEPLOYMENT_STATE.md` and refreshed deployment docs so the current AWS
  setup is explicit: Amplify deploys frontend changes from `main`, while Lambda
  AI proxy changes still require a bundle/upload until deployment automation is
  added.
- Manual hosted browser verification confirmed the signed-in POC still loads
  Vulcan Mesa from the hosted Demo Data menu after PR #74. Hosted AI
  still accepted a `hello` request but stalled without an assistant response, so
  the current branch tightens hosted AI display/timeout behavior while leaving
  Lambda/CloudWatch follow-up open.
- Reworked the hosted AI frontend path to post directly to
  `/api/ai/chat/completions` with the Cognito ID token and parse the OpenAI SSE
  stream in-browser, bypassing the generic provider shim that hid stalled
  hosted requests. Added hosted-path tests for bearer headers, streamed deltas,
  missing tokens, and 401 session recovery.
- Fixed `Attach Related Document` so the Desk Map `ATTACH` action can create a
  related record and upload a PDF into the existing document registry in one
  flow.
- Moved formula popovers to fixed viewport positioning to avoid clipping and
  added a Desk Map `Formula Tray`: hover remains temporary, while clicking a
  formula pins it into a right-side comparison rail.
- Added the Desk Map unit-map reference panel idea to `ROADMAP.md`, anchored on
  uploading the main unit map through `Maps` before any true coordinate underlay
  work.
- Added a signed-in `Pitch Deck` tab with an inline PDF preview of
  `LANDroid-Features.pptx` and a PowerPoint download link. The original deck is
  bundled with a generated PDF companion because browser-native Office preview
  is not reliable without an external viewer or backend conversion service.
- Reworked Desk Map `Fit` so it measures the rendered visible tree/chain rather
  than the padded pan container, keeping the actual card layout centered when
  fitting a tract.
- Added a Leasehold `Overview` override review strip so NPRI branches, ORRI
  overrides, WI assignments, retained WI, and included/tracked record counts are
  visible before switching into Map or Deck mode.
- Added a Desk Map `Unit Map Reference` rail that previews the unit-linked or
  featured `Maps` asset as a collapsible side reference without attempting
  coordinate underlay. The rail labels whether the displayed map is unit-linked
  or a fallback asset.

## 2026-05-17

- Ran the main-readiness housecleaning audit on
  `claude/epic-hoover-48f4d0`, covering UX, landman workflow usefulness,
  engine correctness, architecture/persistence, hosted security, dependency
  audit state, AI behavior, and browser runtime smoke.
- Added `docs/archive/audits/MAIN_READINESS_AUDIT_2026-05-17.md` with
  prioritized blockers and cleanup sequence before treating the branch as a
  main candidate.
- Tightened one Playwright export/import workflow locator so the `Owners`
  navigation click remains exact after formula badges expose "Linked Owners" as
  role-button elements.
- Updated `CONTINUATION-PROMPT.md` to point at the actual current branch,
  latest validation, audit report, and next cleanup priorities.
- Began the main-readiness security cleanup by validating and normalizing stored
  PDF document blobs, rejecting hostile `.landroid` document payloads that do
  not contain PDF bytes, sandboxing PDF iframe previews, and applying shared
  upload allowlists/size limits to owner documents and Research imports.
- Removed the vulnerable production `xlsx` dependency by narrowing AI
  spreadsheet parsing to CSV, converting Runsheet export to CSV, and updating
  the related tests and docs.
- Updated the backend AWS SDK lockfile to clear the `fast-xml-builder`
  production audit issue, moved Lambda/local guidance to Node.js 22, and added
  GitHub Actions CI for root and AI-proxy install, audit, tests, and build.
- Scoped document attachment rows by `workspaceId`, added a Dexie v9 migration
  for existing attachment links, and made branch/tract document cascade cleanup
  use one storage transaction with visible `lastError` reporting on failure.
- Split document detach from global document delete: node-level remove actions
  now detach only the selected attachment link, and node/tract deletion only
  deletes document blobs that have no surviving attachment links.
- Tightened persisted data validation so malformed/negative `.landroid` node
  fraction fields and explicit unknown lease jurisdictions fail fast instead of
  being normalized into zero or Texas-fee math.
- Added an app-level AI approval queue: mutating AI tools now create pending
  proposals, user approval applies each batch, and every approved batch gets one
  undo snapshot.
- Labeled spreadsheet prompt rows as untrusted CSV data and added hostile-cell
  coverage so prompt-injection-like cells are treated as values.
- Added Desk Map auto-fit and a `Fit` canvas control so large trees recenter
  after load/import/tract switch or manual panning.

## 2026-05-16

- Added `IDEAS.md` as a lightweight brainstorming inbox and archived stale
  audit/prompt files under `docs/archive/` so the repo root stays focused on
  active guidance.
- Hardened the macOS ZIP launcher so `LANDroid.command` checks for Node/npm,
  installs npm dependencies on the first run from a fresh GitHub download, and
  keeps the Terminal window open with a clear error if startup fails.
- Built the Phase 7A document registry MVP on
  `codex/document-registry-build-2026-05-16`: added a `Documents` navigation
  surface, flat saved-view filters, editable document metadata, linked-node
  display, duplicate surfacing by `contentHash`, and a packet manifest preview
  from the current filter, selected/highlighted rows, or the
  `Runsheet / Mineral Title` view.
- Added `docs/document-database-roadmap.md` to pivot the next workstream from
  ArcGIS mapping toward a first-class LANDroid document registry, with Dropbox
  or local folders treated as optional raw-file vaults rather than the only
  database.
- Updated roadmap, security notes, docs map, README, and continuation handoff
  for Phase 7A: document library/index, metadata, duplicate surfacing, entity
  links, import manifests, OCR/text indexing, and cited read-only AI document
  query.

## 2026-05-15

- Completed Phase 5 document/PDF persistence on
  `claude/phase-5-document-refactor-2026-05-15`: Dexie v8 `documents` and
  `document_attachments`, node attachment summaries, workspace-store document
  actions, v8 `.landroid` export/import, v7 import migration, and a one-shot
  legacy-PDF backup hook.
- Replaced the old single-PDF Desk Map badge model with multi-document chips
  and a shared node-modal attachments section for add, open, rename, remove,
  and reorder.
- Seeded Raven Forest with realistic Texas multi-document examples on selected
  conveying nodes (deed, obituary, and affidavit of heirship), so the chip UI
  and browser tests exercise the new v8 path.
- Restored Phase 5 Playwright coverage: multi-document chip opening by
  `attachmentId`, v8 `.landroid` round-trip, branch-scoped lease deletion,
  curative linkage, research linkage, and the retargeted combinatorial demo
  chip workflow.
- Began Phase 6A UX cleanup by replacing app-level native `confirm()` /
  `alert()` calls with a shared LANDroid confirmation/alert modal, including
  Desk Map deletes, Clear Map, tract-tab deletes, owner deletes, map deletes,
  curative deletes, research deletes, federal leasing deletes, upload errors,
  and import errors.
- Continued Phase 6 UX/accessibility cleanup: workspace-replacing demo,
  `.landroid`, and CSV loads now require a typed confirmation phrase; Flowchart
  `Clear` uses the shared confirmation modal; and primary navigation, Desk Map
  tract tabs, owner tabs, Research sections, Federal Leasing tabs, and shared
  form controls expose clearer labels or active-state ARIA.
- Switched newly generated workspace IDs to `crypto.randomUUID()` while keeping
  the existing `ws-` prefix and a legacy fallback for runtimes without
  `randomUUID`.
- Hardened hosted IndexedDB keying so signed-out hosted state no longer falls
  back to the local `default` workspace/canvas rows; persistence unlocks only
  after a real Cognito `sub` is available.
- Removed the recurring AI settings unit-test local-storage warning by avoiding
  Node's warning-prone `globalThis.localStorage` probe outside browser contexts.
- Added `ARC_REVIEW_PROMPT.md` and expanded `docs/gis-data-catalog.md` with a
  design-only ArcGIS review scope for canonical layer mapping, stable IDs,
  attachment relationships, and import warnings.
- Tightened workspace persistence validation so warning-only title review states
  that LANDroid itself supports, such as temporary over/under allocation and
  orphan-style missing-parent review nodes, can round-trip through autosave and
  `.landroid` import while hard-invalid graphs still fail.

## 2026-05-14

- Deployed the trusted test POC to `https://landroid.abstractmapping.com` via
  Amplify, Lambda Function URL rewrites, Cognito, and DynamoDB-backed AI usage
  tracking; hosted smoke checks passed after custom-domain activation.
- Added parallel full-audit coordination docs and paste-ready prompts for Codex
  and Claude Code so both tools can audit the same baseline independently and
  write comparison-ready reports.
- Began hosted hardening implementation: frontend Cognito auth now derives the
  user-pool issuer/metadata from `VITE_COGNITO_USER_POOL_ID` while keeping
  Hosted UI auth endpoints, CSP allows the Cognito issuer host, hosted smoke
  checks verify metadata plus JWKS, and the AI proxy now caps request bodies,
  parses JSON before usage tracking, allowlists forwarded OpenAI-compatible
  fields, and maps upstream provider auth failures to proxy errors.
- Continued hosted hardening: hosted mode now hides the Demo Data loader, and AI
  tool policy now separates undo-mutating tools from hosted-blocked tools so
  `setActiveDeskMap` remains undo-neutral locally but is not exposed in hosted
  read-only mode.
- Continued the hosted hardening track with leasehold strict parsing: imported
  or legacy malformed lease royalty, ORRI burden, and WI assignment fractions
  now surface as leasehold input warnings and are treated as 0 instead of being
  silently coerced or clamped.
- Began Phase 4 browser coverage restoration by retargeting the leasehold/PDF
  branch-awareness Playwright workflow to the current 10-tract Raven Forest
  combinatorial fixture.
- Deferred the remaining four skipped PDF/export/import/fixture-heavy Playwright
  workflows until after the document/PDF persistence refactor and fixture
  retargeting, so the hosted-hardening branch can be checkpointed cleanly.
- Expanded the audit brief to capture improvement ideas, additions, fixes,
  redundancies, mapping/document database readiness, AI PDF-to-ArcGIS-traverse
  workflow planning, and possible 3D Desk Map exploration as a separate
  opportunity backlog.

## 2026-05-10

- Added the second-opinion audit verification report for the pre-AWS remediation
  branch, with per-finding verdicts and deployment-risk caveats.
- Hardened the follow-up audit fixes: added attach-invariant edge coverage,
  persistence DB-key coverage for Cognito-sub namespacing, and Lambda proxy
  handler tests for Cognito JWT rejection plus streamed OpenAI forwarding.
- Updated hosted deployment docs so `npm run bundle` is the supported Lambda
  packaging path, stale zips are called out as crash-prone, DynamoDB usage
  tracking is required before invited hosted use, and legacy `default` IndexedDB
  data requires manual export/import instead of automatic migration.
- Made the AI proxy fail fast when `USAGE_TABLE_NAME` is missing unless the
  explicit local-only `ALLOW_IN_MEMORY_USAGE_STORE=true` escape hatch is set.
- Added `DEPLOY_TEST_CHECKLIST.md`, `npm run deploy:check`, and rewrite-render
  helper scripts so the pre-AWS branch can be checked locally before touching
  AWS console settings.
- Corrected the hosted smoke test to check Cognito JWKS at the user-pool issuer
  URL instead of the Hosted UI domain.

## 2026-04-21

- Added `DEPLOYMENT_PLAN.md`, a staged AWS-hosted rollout plan covering secure
  frontend hosting, Cognito auth, App Runner backend, S3/RDS persistence,
  server-side AI proxying, provider strategy (OpenAI / Anthropic / Bedrock),
  and go-live security controls.

## 2026-04-20

- Added project-scale unit focus for Raven Forest Unit A/B and future units:
  Leasehold and Owners now switch by active unit, new units can be created from
  the selector, and unit-wide ORRI/WI records carry a unit code so A/B math
  stays separated.
- Added a confirmed `Clear Map` Desk Map action that empties the active tract,
  removes cleared node artifacts, preserves other tracts, and avoids deleting
  node records still shared with another Desk Map.
- Improved spreadsheet row staging against the Elmore DOTO workbook format:
  tract-tab detection, gross-acre extraction, safer Grantor/Grantee header
  mapping, DOTO ownership-row inheritance, and simple title-interest expression
  parsing.
- Added per-sheet Desk Map targeting in workbook row review, including a
  `Create missing tracts` action before root-node creation.
- Reused the workspace Instrument dropdown in workbook row review so imported
  instrument types can be added to the persisted type list.

## 2026-04-19

- Created `AUDIT_REPORT.md` and `PATCH_PLAN.md`.
- Hardened AI rollback snapshots so mutating AI tool activity snapshots before
  live changes and includes node PDF workspace data.
- Added AI cancel/status UX and provider timeouts.
- Made OpenAI/Anthropic keys session-only and stripped old persisted cloud-key
  fields from AI settings.
- Enforced Texas-only active lease math gates for Desk Map/Leasehold consumers
  and lease attachment paths.
- Tightened AI lease creation with strict royalty/leased-interest parsing and
  `tx_fee` / `tx_state` jurisdiction limits.
- Improved Desk Map over-100 mineral coverage visibility by listing current
  mineral contributors.
- Added first-pass spreadsheet `Review rows` workflow for row-by-row editable
  node staging, parent suggestions, create-root, attach, and skip.
- Added professional docs rails: architecture, testing, security, roadmap,
  changelog, docs map, and core ADRs.
