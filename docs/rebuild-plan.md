# LANDroid Incremental Rebuild Plan

Status: planning source of truth.
Last updated: 2026-05-22.

This document consolidates the current rebuild direction. It is not approval to
rewrite the app in one pass. It is the working plan for rebuilding LANDroid
professionally, incrementally, and without breaking existing Desk Map,
Runsheet, Leasehold, Flowchart, Documents, Curative, Maps, Research, Federal
Leasing, AI approval, import/export, or print workflows.

## Reconciled Plan Summary

This plan combines the useful parts of the outside rebuild proposal with the
repo-grounded architecture review.

Accepted from the outside proposal:

- one source of truth is the correct direction
- mutation history, provenance, and approval records matter
- migration must be incremental, with the old app running while new foundations
  are added beside it
- parity checks and golden-master tests come before cutover
- the math engine must be preserved until a specific math phase is approved
- the title-opinion starting workflow is a real product requirement
- dual decimal plus fraction display is a product contract

Changed from the outside proposal:

- the domain model is a project record schema, not an event log; the
  ownership-tree subset is graph-shaped, but the implementation target is
  records, foreign keys, projections, and typed actions
- events/actions are the audit and mutation layer over records
- `.landroid` should become a hybrid package/snapshot plus action records,
  provenance, and a content-addressed evidence vault, not a pure event-log-only
  file
- documents live in the Document Vault as stable entities, not inside events
- storage scale must be addressed before broad rebuild work: current browser
  storage can remain the runtime path, but the plan needs Phase 0.5 workspace
  sharding before Phase 1 record foundations start
- project boundary and party identity come before store-by-store cutover
- workbook import is a deterministic template workflow first, with AI helping
  only when mapping, remarks, or attachment targets are ambiguous

Added from the repo-grounded analysis:

- `SourceAttestation` as the general model for title opinions, division orders,
  probate inventories, prior chains, patents, Spanish grants, and working
  assumptions
- title-opinion-as-root as a first-class starting workflow
- side-by-side source review as the shared UX for title opinions, documents,
  workbook rows, and future OCR/text extraction
- attorney packet export built from the Document Vault: native files, workbook,
  manifest JSON, manifest CSV, eDiscovery sidecars, checksums, and
  unresolved-issue list
- evidence-grade vault contract: immutable originals, SHA-256 hashes,
  document versions, extraction runs, page/text/span anchors, derivative files,
  audit events, and packet manifests
- AI answer contract: answer, reasoning summary, cited sources, discrete
  confidence / limits, open issues tied to records, and suggested next action
  tied to an `ActionPlan` or navigation target
- a named `CitationVerifier` structural gate before AI answers are displayed
- a `MathInputView` projection so rebuild records do not quietly change
  existing math-engine semantics
- Phase 0 must produce a frozen reference workspace, atomic behavior catalog,
  measured performance baselines, and CI-running golden masters
- the next deep review is a Phase 0 ultra-review, not another broad rebuild
  audit; Phase 0 should be fully captured before the rebuild direction is
  revisited
- Phase 0 work is sectioned and consolidated by one lead thread; parallel agents
  may perform read-only lane reviews, but they do not edit competing master
  plans
- Phase 0.75 is a backend architecture decision gate: if future-proofing still
  points to a backend after Phase 0 evidence, LANDroid adds a backend spine
  before Phase 0.5 storage work or Phase 1 schema implementation
- federal/private and horizontal-well project records without turning on
  federal/private math until an explicit gate

Deferred or left out for now:

- whole-app rewrite in one pass
- pure event-sourced `.landroid` files
- putting PDF/document blobs in events
- automatic AI mutation without user approval
- automatic owner deduplication without user review
- broad shadcn/Storybook migration as a standalone phase
- document-citing AI answers before the OCR/text/citation-anchor pipeline exists
- cloud OCR as a default path; cloud OCR must be per-document opt-in after a
  provider/security decision
- SQLite/Tauri/object-storage cutover before explicit storage and runtime gates
- backend implementation before Phase 0 evidence and the Phase 0.75 backend
  architecture decision
- federal/private calculation math before the explicit Phase 2 math gate in
  `PROJECT_CONTEXT.md`
- detailed Texas math-engine expansion until the dedicated math pass

## Core Decision

LANDroid should be rebuilt around a project record schema, not around an event
log as the domain model.

The domain truth is made of records:

- `Project`
- `Party`
- `PartyAlias`
- `Document`
- `DocumentVersion`
- `VaultObject`
- `DocumentLink`
- `DocumentPage`
- `DocumentTextSpan`
- `ExtractionRun`
- `SourceCitation`
- `CitationAnchor`
- `SourceAttestation`
- `InstrumentRecord`
- `Tract`
- `DeskMap`
- `Lease`
- `Unit`
- `Wellbore`
- `InterestReference`
- `CurativeIssue`
- `LeaseObligation`
- `ObligationEvent`
- `ImportSession`
- `ActionPlan`
- `ActionRecord`
- `AuditEvent`
- `Packet`
- `PacketItem`
- `PacketExport`

Events and actions still matter, but they are the mutation/audit layer over the
records. They are not the primary shape of the business data.

The ownership tree and title-flow projections are graph-shaped views over this
schema. Do not interpret "record graph" as approval to adopt a graph database
or to collapse the domain into generic nodes and edges.

## Non-Negotiable Contract

The rebuild must preserve the full observable product, not only the arithmetic.

Before replacing any existing workflow, LANDroid must inventory and protect:

- current math behavior and precision boundaries
- Desk Map cards, tabs, document chips, leases, NPRIs, fit behavior, and clear
  behavior
- Runsheet display and export behavior
- Leasehold summaries, unit focus, ORRI/WI filtering, payout review, and formula
  explanations
- Flowchart import-from-Desk-Map, layout, canvas editing, and print output
- Documents registry, metadata editing, saved views, packet preview, document
  links, and PDF preview
- Owners, owner contacts, owner documents, owner leases, and Desk Map link
  options
- Curative issue tracking and entity links
- Maps assets, map regions, featured map behavior, and passive-file validation
- Research sources, formulas, project records, imports, and readable RRC text
  previews
- Federal Leasing reference records, lease targets, map evidence, and the rule
  that these records do not affect Texas math yet
- AI approval proposals, deterministic previews, undo snapshots, blocked
  proposals, and the action/result journal
- `.landroid` import/export, side-store reset, autosave, and future-version
  rejection
- print fidelity for runsheets, flowcharts, packets, and attorney-facing review
  artifacts
- in-flight project migration: every phase must preserve loadability of
  pre-rebuild workspaces or provide a documented one-way migration with backup
- multi-tab safety for the same workspace: either prevent concurrent writers or
  surface conflicts before silent overwrite
- dual decimal plus fraction display anywhere a fractional interest is shown in
  UI, print output, export output, AI previews, approval diffs, and generated
  review artifacts

If a future phase changes any user-visible behavior, the change must be named
and approved.

### Fraction Display Contract

Every fractional interest shown to the user must display both decimal and
rational forms.

Preferred display shape:

```text
0.500000000 | 1/2
```

The decimal side keeps LANDroid's fixed display precision. The rational side
uses the continued-fraction / exact finite-decimal helper in
`src/engine/fraction-display.ts`.

Rules:

- use `dualDisplay()` or a UI equivalent derived from it when showing a
  fractional interest
- do not add new fraction displays that show only a decimal
- do not add new fraction displays that show only a rational fraction
- exports and print surfaces must preserve both forms when practical
- AI extraction previews and approval diffs must show both forms when a
  proposed value changes title, leasehold, NMA, DI, NPRI, ORRI, WI, or payout
  math

Existing places that still use fraction-only helpers are inventory targets for
Phase 0. They are not automatically bugs in the current app, but the rebuild
must not expand that pattern.

## Architecture Target

The target architecture is:

```text
Project
  Record schema
    Parties and aliases
    Evidence vault, documents, and source citations
    Instruments and source attestations
    Tracts, Desk Maps, leases, units, wellbores
    Interest references, lease obligations, and curative issues
  Action layer
    Typed commands
    Approval previews
    Action records
    Audit events with hash continuity
    Undo / rollback boundary
  Projections
    Desk Map tree
    Runsheet view
    Leasehold view
    MathInputView
    Document packet view
    Owner index
    OpinionDraft
    ObligationCalendar
    AbstractorPackage
    AI cited-answer context
  Verification layer
    CitationVerifier
    package manifests and checksums
```

This keeps the app local-first and project-contained while giving AI, export,
and future hosted workflows a clean structure.

## Project Boundary

Each LANDroid project is self-contained. Raven Forest, Springhill, and future
projects should not bleed records into each other accidentally.

Within a project, the same person or company should be represented once as a
`Party`, with aliases and roles attached as needed. This matters for large
projects where one owner may appear across many tracts, leases, units, or
documents.

Cross-project search can be designed later, but the default rebuild assumption
is:

- one project file/package contains one project record schema
- documents are stored once per project and linked many times
- parties can be linked across the whole project
- `Party` gets a nullable `externalPartyId` / future cross-project identity
  hook, but no automatic cross-project deduplication happens now
- packet export can include the workbook, manifests, document folder, and
  source evidence needed by a title attorney

## Storage Trajectory And Project Package

LANDroid stays local-first for the rebuild. The browser/Dexie runtime can
remain the short-term execution environment, but IndexedDB should not be the
only professional durability story for large title projects.

Storage changes are staged:

1. Current: browser IndexedDB/Dexie stores, with the main workspace still
   serialized as a large workspace payload.
2. Phase 0.5: shard workspace data into per-record or per-table Dexie rows so
   Raven Forest scale does not depend on repeatedly parsing and writing one
   large JSON string.
3. Later decision gate: evaluate SQLite WASM in OPFS only when query/search
   needs justify it.
4. Future inflection: consider a Tauri 2 desktop shell only when native
   filesystem access, native SQLite, local OCR process spawning, or corpus size
   makes the browser shell the bottleneck.

Target project-package shape:

```text
ProjectName.landroidpkg/
  project.json or project.sqlite
  manifest.json
  manifest.csv
  checksums-sha256.txt
  documents/
    originals/
      <documentId>_<sha256>.pdf
    derivatives/
      <documentId>_ocr.pdf
      <documentId>_page-001.png
    text/
      <documentId>.txt
      <documentId>.json
      <documentId>.hocr
  exports/
    Runsheet.xlsx
    TitleDocuments/
    eDiscoverySidecar/
  indexes/
    rebuildable-search-index-files
```

Rules:

- originals and checksums are canonical; search indexes and packet exports are
  rebuildable
- document bytes are content-addressed by hash where practical
- OCR PDFs, page images, hOCR/text JSON, embeddings, and FTS rows are
  derivatives, not replacements for originals
- cloud object storage is an adapter boundary, not the Phase 1 source of truth
- `.landroid` zip/package export must include enough manifest and checksum data
  to prove what was sent

## Document Vault

Documents are first-class records, not event payloads. The word "vault" means
durability, provenance, and chain-of-custody, not merely a table of document
links.

A document should have one stable `Document` record and many `DocumentLink`
records. A single PDF may link to a node, owner, lease, tract, unit, curative
issue, research record, import row, source attestation, or packet.

The vault must support:

- stable document IDs
- immutable original-file retention
- content hashes and MIME/magic validation
- `DocumentVersion` records for metadata revisions and derivative relationships
- `VaultObject` records for original bytes, OCR PDFs, page images, text, hOCR,
  extracted JSON, and packet copies
- source metadata
- document-to-entity links
- OCR/text extraction status and `ExtractionRun` lineage
- page, region, text span, quoted text, and quoted-text-hash citations
- packet export with native files, manifests, checksums, and eDiscovery sidecars
- side-by-side document review later
- append-only `AuditEvent` records for meaningful vault changes

Deletion semantics:

- detaching a `DocumentLink` does not delete the shared document
- deleting a derivative does not delete the original
- deleting an original requires an explicit user-approved destructive action and
  should leave a durable audit record
- re-importing identical bytes should reuse or point to the same content hash

## Citation Anchor Contract

`SourceCitation` must be strong enough for AI answers, title opinions, attorney
packets, and later side-by-side PDF review.

Minimum citation shape:

```text
SourceCitation
  id
  projectId
  documentId
  documentVersionId
  extractionRunId
  citedRecordId
  pageNumber
  bboxOrPolygon
  charSpan
  quotedText
  quotedTextHash
  confidence
  createdBy
  createdAt
```

For structured records without document text, the citation may point to a
record ID, source attestation, import row, workbook cell, deterministic math
result, or explicit curative issue. For document-text claims, citations are
off-limits until extraction/OCR has produced page and span anchors.

## Source Attestations

LANDroid needs a first-class way to say where a title chain starts.

A root does not always come from an original patent or Spanish grant. Many real
projects start from a prior title opinion, division order, probate inventory,
prior runsheet, or working assumption.

Add a general `SourceAttestation` concept:

```text
SourceAttestation
  id
  projectId
  sourceType
  documentId
  effectiveDate
  attestor
  scope
  declaredOwners
  exceptions
  qualifications
  citations
  status
```

Initial `sourceType` values:

- `patent`
- `spanish_grant`
- `title_opinion`
- `division_order`
- `probate_inventory`
- `prior_chain`
- `working_assumption`
- `other`

The title-tree root can reference a `SourceAttestation`. The math engine should
still see a normal root with children whose shares sum to the scoped interest.
The difference is provenance and review clarity, not arithmetic.

### Title Opinion As Starting Root

The title-opinion workflow is a core rebuild requirement.

Target workflow:

1. User starts a new project or tract.
2. LANDroid asks where the chain starts:
   `Original patent`, `Title opinion`, `Division order`, `Probate inventory`,
   `Prior LANDroid chain`, or `Working assumption`.
3. User chooses `Title opinion` and uploads the PDF.
4. The PDF enters the Document Vault.
5. LANDroid extracts or lets the user manually enter:
   effective date, attorney/attestor, covered tract/scope, listed present
   owners, fractions, and exceptions.
6. User reviews in a side-by-side source view when available.
7. LANDroid creates a `SourceAttestation`, a root node, and child owner nodes
   for the opinion's listed ownership.
8. Each exception becomes a `CurativeIssue` with a citation back to the title
   opinion.
9. Post-opinion research is attached downstream from the relevant owner branch.

The flowchart should visibly distinguish a title-opinion root from a patent
root. It should show source type, effective date, attestor, and a link to the
source document.

If later research proves the opinion was wrong, LANDroid should not overwrite
history. It should record a correction action that departs from the opinion and
cites the new source.

## Runsheet Package Workflow

The Springhill-style workbook is a template workflow, not a generic AI parsing
problem.

LANDroid should support a runsheet package made of:

```text
Runsheet.xlsx
TitleDocuments/
  instrument-1.pdf
  instrument-2.pdf
manifest.json
manifest.csv
checksums-sha256.txt
source-citations.csv
unresolved-issues.csv
eDiscoverySidecar/
  production.dat
  production.opt
  TEXT/
```

Legacy folder names such as `TORS_Documents` should remain import-compatible.
Exports should prefer a clear folder name such as `TitleDocuments`.

The importer should:

- recognize the recurring workbook headers and sheet naming patterns
- preserve workbook, sheet, row, and column provenance
- read instrument number, volume/page, file date, instrument date, grantor,
  grantee, land description, remarks, decimal/ownership fields, and document
  path
- distinguish instrument rows, baseline-owner rows, section rows, subtotal
  rows, and skip rows
- resolve documents by explicit helper column, image path, or instrument number
- ask mapping questions only when the format or attachment target is ambiguous
- create staged candidates, not immediate mutations
- require user approval before graph, owner, lease, document, or curative
  records are changed

Preferred optional helper columns:

- `LANDroid Row Type`
- `LANDroid Action`
- `LANDroid Target`
- `LANDroid Document File`
- `LANDroid Status`

The exporter should generate the same practical attorney-facing pattern:

- Excel workbook with familiar columns
- relative hyperlinks to the document folder
- native document files
- manifest JSON
- manifest CSV
- checksum manifest
- source-citation sidecar
- Concordance/Opticon-style eDiscovery sidecar when requested
- unresolved issue list when relevant

Runsheet ordering is user-controlled. The rebuild must not hardcode one
permanent export order. At minimum, Runsheet review and export should support:

- global instrument/effective-date order
- global file/recording-date order
- individual tract filtering with sortable rows
- whole-project grouped-by-tract review
- later manual/custom package order for attorney-facing delivery
- saved runsheet views when the workflow matures

Golden masters must name the order/filter they represent, for example
`global-instrument-date`, `global-file-date`, `vm1-instrument-date`, and
`grouped-by-tract`. A generic `demo.runsheet.csv` is too ambiguous to be the
long-term rebuild contract.

The attorney-facing package and the eDiscovery sidecar should be generated from
the same `Packet` / `PacketItem` manifest so the human workbook and machine
load files cannot drift.

## AI Answer Contract

AI should be able to analyze the project, answer questions, and propose
mutations, but every answer must prove itself.

AI project answers should be shaped as:

```text
Answer
Reasoning summary
Cited sources
Confidence / limits
Open issues
Suggested next action
```

If LANDroid cannot cite the answer to a project record, source citation,
document excerpt, deterministic calculation, or explicit open issue, it should
say the answer is unresolved instead of pretending to know.

Structural rules:

- `CitationVerifier` reviews every answer before display
- every material claim must trace to a stored citation, record ID,
  deterministic math result, or approved action record
- confidence is a discrete enum such as `supported`, `partial`, `conflicting`,
  or `insufficient`, not a free-form probability
- open issues must point to existing `CurativeIssue` records or a typed
  proposed issue awaiting approval
- suggested next action must be a typed `ActionPlan` proposal or a navigation
  hint
- pre-OCR AI may cite structured records, source attestations, import rows,
  explicit open issues, and deterministic calculations, but may not cite
  document text spans that do not exist yet

AI should use:

- structured project records
- source citations
- OCR/text chunks when available and citation-anchored
- document metadata
- deterministic math tools
- action records
- open curative issues

Search/retrieval should be hybrid:

- exact and keyword search for instrument numbers, volume/page, party names,
  legal descriptions, and quoted phrases
- vector search for semantic recall after exact search
- graph/schema traversal tools for chains, tracts, parties, leases, wells,
  units, and curative issues
- deterministic math tools for ownership, leasehold, payout, and warning
  explanations
- a rank combiner before the answer step, with citation verification after the
  answer step

AI should not be the primary parser for stable workbook templates. It should
help with unfamiliar formats, remarks interpretation, extraction review,
target suggestions, and cited project Q&A.

## Rebuild Phases

Every phase must end with the app working.

## Phase 0 Operating Plan

The next deep review should be a Phase 0 ultra-review, not another broad
rebuild architecture audit.

Purpose:

- turn Phase 0 into an executable inventory/testing plan
- define inventory row shape, fixtures, baselines, commands, and exit gates
- decide exactly which current behaviors must be preserved before rebuild
  implementation starts
- capture surprising current behavior before the rebuild plan is revisited

Professional process:

1. One lead thread owns the master Phase 0 inventory and source-of-truth docs.
2. Work proceeds lane by lane, not as competing parallel rewrites.
3. Secondary agents may do read-only reviews for specific lanes and return
   findings.
4. The lead thread reconciles findings into the master inventory, tests, and
   plan.
5. Each lane ends with documented behavior, missing coverage, proposed golden
   masters, migration risks, and validation commands.
6. After all lanes are captured, revisit the rebuild plan before Phase 0.5,
   because Phase 0 may reveal better sequencing.

Suggested Phase 0 lanes:

- Desk Map, title-tree actions, invariants, fit/clear behavior, and graph/math
  warnings
- Leasehold, unit focus, ORRI/WI, payout review, formulas, and transfer-order
  behavior
- Documents, packet preview/export, document chips, imports, metadata, and PDF
  preview
- AI approval, undo, blocked previews, action journal, and proposal lifecycle
- Persistence, `.landroid`, side stores, autosave, import/export, and
  multi-tab risk
- Runsheet, spreadsheet staging, package assumptions, source rows, and export
  expectations
- Flowchart, print fidelity, canvas layout, and import-from-Desk-Map behavior
- Maps, Research, Federal Leasing reference data, GIS evidence, and no-effect
  Texas math boundaries
- Performance and scale fixtures for Raven Forest-like projects

The Phase 0 output should be a checked-in behavior catalog and fixture plan,
not an implementation branch.

Current Phase 0 master draft:

- `docs/phase-0-inventory.md`

That inventory was produced as a read-only review artifact on `main` and is the
working catalog for Phase 0. It should be treated as a draft master inventory
until the lead thread verifies the highest-risk rows against code and marks
uncertain rows as `needs verification`. Secondary review agents may contribute
lane findings, but this file remains the single consolidation target.

### Phase 0: Current Behavior Inventory And Golden Masters

Goal: freeze the current observable behavior before rebuilding foundations.

Required work:

- inventory every page and major workflow with atomic, testable behavior rows
- reconcile the `docs/phase-0-inventory.md` draft into the checked-in master
  catalog, preserving stable lane IDs and explicit coverage status
- define acceptance checks for each page
- freeze at least one reference workspace per major demo/project shape, export
  it, checksum it, and capture expected outputs as JSON where practical
- capture current performance baselines for large Desk Map, document registry,
  packet preview, import/export, `.landroid` round trip, and print workflows
- add or strengthen golden-master tests for math, import/export, document
  chips, Leasehold summaries, Flowchart print, `.landroid` round trip, AI
  approvals, and the current Playwright workflows
- record implicit behavior such as sort orders, default filters, warning
  thresholds, autosave timing, destructive confirmations, and print/page layout
- record known gaps instead of pretending they are covered
- verify the highest-risk current-behavior claims before treating them as
  binding: monolithic workspace storage, multi-tab overwrite risk, canvas
  viewport persistence, lease-allocation tie-breaks, AI mutating-tool undo
  coverage, legacy document migration/orphan handling, federal math isolation,
  unit-focus transfer-order behavior, packet manifest behavior, and performance
  baseline gaps

Exit gate:

- current branch has a documented page/workflow inventory
- frozen reference workspaces and expected outputs are checked in or explicitly
  documented if too large to check in
- performance baselines are recorded with the command, fixture, machine, and
  acceptable drift
- full relevant tests pass
- missing coverage is listed in this document or `TESTING.md`

### Phase 0.75: Backend Architecture Decision

Goal: record the backend architecture decision with Phase 0 evidence in hand,
without starting backend implementation prematurely.

Decision:

- backend architecture is approved in principle
- backend implementation is deferred until OCR/search/sync scale forces it,
  expected no earlier than Phase 2.5 unless a hard trigger appears first
- Phase 0.5 and Phase 1 must be built local-first and backend-ready so the
  later backend is a sync/job/search layer, not a rewrite

This gate occurs immediately after Phase 0 and before Phase 0.5 storage work
because the backend-ready decision changes what storage sharding needs to
preserve.

Default assumption:

- local-first project semantics and `.landroid` package export remain mandatory
- LANDroid is a hosted web app first, with PWA/iPad support as a product
  target; native iOS and desktop installers are deferred unless a later decision
  gate proves they are necessary
- the backend supports sync, backup, jobs, search, AI/RAG, sharing, and future
  collaboration; it does not erase the local project package model
- the app must remain functional without network access for core title, math,
  document, and project workflows

Backend responsibilities when implementation is triggered:

- durable project-record storage
- object storage for original documents, derivatives, and packet artifacts
- signed document access URLs
- OCR, extraction, indexing, and packet-export background jobs
- search indexes for exact/keyword search and later vector recall
- server-controlled AI/RAG retrieval and provider access
- durable action/audit records
- backup and multi-device sync
- future multi-user permission boundaries
- future cross-project party identity indexes

Backend-ready requirements for Phase 0.5 through Phase 6:

- stable record IDs across stores and exports
- `workspaceId` scoping on every persisted project record
- `lastModified` / version metadata where records can sync later
- content-hash addressing for document blobs and vault objects
- sharded per-record or per-table local storage instead of one workspace JSON
  payload
- local mutation/action records where practical so later sync can send
  intentional changes instead of opaque snapshots
- `.landroid` export remains complete regardless of sync status

Implementation trigger questions:

- does Phase 0 show browser-only persistence is already too fragile for the
  expected project size?
- does OCR/search/export need background jobs earlier than expected?
- does the user need multi-device sync or backup soon enough to justify the
  added complexity?
- should the hosted AWS POC evolve into the backend spine, or should a cleaner
  backend be designed separately?
- what stays available offline, and what requires network access?
- how will `.landroid` package export remain complete and attorney-defensible?

Likely backend shape when triggered:

```text
Frontend: React/Vite LANDroid
Local cache: Dexie
Backend API: Node/Fastify or similar
Database: Postgres
Object storage: S3/R2-compatible
Jobs: OCR, indexing, packet export
Search: Postgres FTS first, vector later
Auth: Cognito or replacement auth provider
AI gateway: server-controlled provider access and policy
Export: .landroid package remains mandatory
```

Tradeoff:

- a backend is more future-proof for document-heavy, OCR-heavy,
  multi-project, multi-device, AI/RAG-heavy growth
- a backend also adds API contracts, schema migrations, auth, deployment,
  cloud cost, job monitoring, backup/security responsibility, and more failure
  modes

Exit gate:

- written backend decision: approved in principle, build deferred until a hard
  trigger
- backend responsibilities and non-responsibilities documented
- local-first/export contract reaffirmed
- backend-ready record requirements added to Phase 0.5 and Phase 1 acceptance
  criteria
- security, deployment, and testing docs updated before any backend
  implementation starts

### Phase 0.5: Workspace Storage Sharding

Goal: remove the scale risk of one large workspace payload before rebuilding
domain foundations and prove Raven Forest scale on iPad-class hardware.

Required work:

- document the current workspace persistence shape and its size/performance
  limits
- shard workspace records into per-row or per-table Dexie storage without
  changing user-visible behavior
- keep `.landroid` import/export compatible with existing v7/v8/v9-style
  snapshots where supported
- preserve side-store replacement, future-version rejection, and rollback-safe
  import behavior
- add migration/backup handling for in-flight projects
- add multi-tab detection or a workspace write lock before concurrent writes can
  silently overwrite each other
- extract the autosave debounce timing into a named constant before changing
  persistence topology
- persist canvas viewport state across reload if Phase 0 confirms the current
  behavior is memory-only
- request persistent browser storage for PWA/iPad use when the platform allows
  it
- lazy-load document/PDF blobs from IndexedDB; never load a full document set
  into memory merely to open a workspace

Exit gate:

- existing workspaces still load
- `.landroid` round trip and side-store reset tests pass
- autosave performance is measured against the Phase 0 baseline
- multi-tab conflict behavior is tested or explicitly blocked
- Raven Forest-scale fixture target is exercised on iPad Pro-class hardware or
  an explicitly documented equivalent: 1,000-3,000 title nodes and 200-1,000
  document records/PDFs without full-blob workspace rewrites
- `.landroid` export remains usable as the backup/escape hatch after sharding

### Phase 1: Project Record Schema Foundations

Goal: define durable records beside the existing app without changing behavior.

Required work:

- define `Project`, `Party`, `PartyAlias`, `Document`, `DocumentVersion`,
  `VaultObject`, `DocumentLink`, `SourceCitation`, `CitationAnchor`,
  `SourceAttestation`, `InstrumentRecord`, `Tract`, `Unit`, `Wellbore`,
  `InterestReference`, `CurativeIssue`, `LeaseObligation`,
  `ObligationEvent`, `ImportSession`, `ActionPlan`, `ActionRecord`,
  `AuditEvent`, `Packet`, `PacketItem`, and `PacketExport` types
- define projection contracts for `MathInputView`, `OpinionDraft`,
  `ObligationCalendar`, `AbstractorPackage`, packet export, and AI context
- define `CitationVerifier` inputs/outputs and failure behavior before AI
  document Q&A expands
- keep current Zustand stores operational
- add adapter/projection helpers instead of forcing a UI migration
- add Zod schemas at import/export boundaries
- design records as backend-ready even though the backend is deferred: stable
  IDs, `workspaceId`, `lastModified` / version fields where needed, and
  content-hash references for blob-backed records
- add a guard so every mutating AI tool that can change project state is covered
  by the approval/undo policy
- make Texas/federal/private isolation a `MathInputView` projection
  precondition instead of relying on scattered per-surface filters

Exit gate:

- no UI behavior changes
- type-level tests and serialization tests pass
- `.landroid` migration strategy is documented before format changes
- `MathInputView` preserves Phase 0 display/math contracts, including dual
  decimal plus fraction display, lease allocation order, warning-only states,
  and jurisdiction isolation

### Planned Product Lanes Outside Phase 0

These are accepted rebuild-planning lanes, not Phase 0 blockers and not
approval to implement them immediately:

- template and communication generation: a workspace template library using
  `.docx` templates with `{{variable}}` placeholders, a variable manifest
  sidecar, manual fill fallback, AI-assisted fill through approval previews, and
  generated output saved back to the Evidence Vault
- field/iPad mode: read-heavy, light-edit PWA workflows optimized for courthouse
  and field use, with offline operation and Ollama/local AI as the offline path
- universal search / command palette: cross-surface search over owners,
  documents, instruments, leases, curative issues, research records, maps, and
  project records
- inline AI entry points: right-click or contextual "Ask AI about this" on
  cards, rows, chips, documents, and fractional values, using the selected
  entity as grounded context
- persistent workspace chat history, stored locally and exportable with the
  project when intended
- three-pane Documents workflow: filter tree, dense document list, metadata and
  preview panel, with professional document-management patterns rather than
  modal-heavy review
- rolling auto-export and storage health surfaces: user-selected backup folder
  where supported, timestamped `.landroid` snapshots, last-saved / last-exported
  status, and visible IndexedDB/storage warnings

### Phase 2: Document Vault And Packet Model

Goal: make documents and packet export the stable evidence layer.

Required work:

- unify side stores first: collapse owner documents, PDF map assets, research
  file imports, and registry documents into the shared document/entity-link
  model where practical
- promote documents as shared project entities linked many times
- ensure attachment ordering and workspace scoping are correct
- support links to nodes, owners, leases, curative issues, research records,
  source attestations, tracts, and imports
- add immutable original files, hashes, document versions, vault objects, and
  derivative tracking
- design attorney packet export around native files, manifests, checksums,
  source-citation sidecars, unresolved issues, and optional eDiscovery sidecars

Exit gate:

- existing Documents, Desk Map chips, and packet preview still work
- link deletion does not delete shared documents incorrectly
- exported manifests are deterministic
- hash preservation, packet round trip, and shared-document deletion semantics
  are tested

### Phase 2.5: OCR, Text Extraction, And Citation Anchors

Goal: make document-text evidence citeable without sending project documents to
cloud services by default.

Required work:

- keep local OCR/text extraction as the default design path
- support selectable-PDF text extraction separately from scanned-PDF OCR
- model `ExtractionRun` lineage: engine, engine version, parameters, timestamps,
  status, confidence summary, input document version, and output vault objects
- preserve originals and write OCR/searchable PDFs, hOCR/text JSON, text files,
  and page images as derivatives
- connect extracted text to `SourceCitation` page, bbox/polygon, and character
  span anchors
- make cloud OCR a per-document opt-in provider decision, not an ambient default
- identify local Mac tooling needed for the development pipeline before coding

Exit gate:

- extracted text can be traced back to the original document, document version,
  extraction run, page, and span
- OCR failure leaves the original document usable and reviewable
- AI document-text answers remain disabled until citations can be verified
- cloud OCR data residency and retention risks are documented before any upload

### Phase 3: ImportSession, Source Review, And ActionPlan

Goal: turn uploads into reviewable staged work, not blind mutation.

Required work:

- support recurring runsheet packages
- support title-opinion-as-root import
- support immutable source rows and source excerpts
- support staged candidates with confidence and questions
- support side-by-side source review when OCR/text is available
- support batch approval into typed actions
- use Phase 1 `ActionPlan` schema for dry-run previews before any staged import
  can mutate records

Exit gate:

- user can preview what LANDroid intends to create
- ambiguous rows become questions
- rejected candidates leave no mutation behind
- approved candidates cite their source rows/documents

### Phase 4: Action Layer As Canonical Mutation Path

Goal: route meaningful changes through typed actions and durable records while
the current app remains the reference.

Required work:

- define typed commands for title-tree/record mutations, document links, owner
  edits, lease edits, curative edits, imports, and AI proposals
- write `ActionRecord`s for approved changes
- write append-only `AuditEvent`s with hash continuity for durable audit trails
- compare action-derived projections against current store output
- cut over one workflow at a time only after parity

Exit gate:

- undo/rollback boundary is clear
- action records survive reload/export when intended
- parity warnings are treated as bugs

### Phase 5: Project-Wide Party Identity

Goal: represent one owner once across a large project.

Required work:

- add party aliases and roles
- add a nullable external/canonical party identity hook, but keep cross-project
  deduplication review-gated and out of scope
- link owners across tracts and units inside a project
- preserve per-tract/per-instrument provenance
- support AI questions such as "where does this party appear?" with citations

Exit gate:

- no duplicate-owner collapse without user review
- owner records still work in the current Owners page
- party links are reversible or explicitly auditable

### Phase 6: Wells, Units, And Federal/Private Reference Structure

Goal: model the project facts needed for Raven Forest without turning on
federal/private math prematurely.

Required work:

- add wellbore records with surface hole, bottom hole, lateral, measured depth,
  formation/depth metadata when available, and source citations
- add unit/CA/allocation records as project records
- add lease obligation and obligation-event records for expirations, options,
  rentals, shut-in, Pugh, continuous-development, and review reminders when
  supported by source documents
- connect wells, tracts, maps, leases, units, and documents
- keep federal/private data reference-only until the explicit math gate

Exit gate:

- Texas Desk Map and Leasehold math remain unchanged
- federal/private records are queryable and packetable
- no federal/private calculation affects active Texas outputs

### Phase 7: Math Engine Expansion

Goal: expand Texas title math only after the record schema and provenance layer
can support it.

Candidate order:

1. Net mineral acres and decimal interest as first-class outputs.
2. Pooled-unit allocation engine.
3. Substance severance.
4. Depth severance.
5. Term, defeasible, and life-estate interests.
6. Probate cascade assistant.
7. Estate-vector decomposition.
8. Recording date and priority conflicts.
9. Hysaw/Luckel/Bath ambiguity flags.
10. Spanish/Mexican grant rule pack.
11. Vacancy, gap, strip-and-gore, accretion, and contested-state markers.
12. Deeds as first-class reversible source entities.
13. Working-interest flow-through.
14. JOA structures.

This phase must be revisited in detail before implementation. The math engine
is still preserved until a specific math phase is approved.

## Page Inventory Gate

Before changing a page, create or update an inventory row with:

- page/view name
- current purpose
- major user workflows
- backing stores/helpers
- documents/attachments involved
- current tests
- missing tests
- migration risk
- manual smoke checklist

Current pages to inventory:

| Page | Current role | Must protect |
| --- | --- | --- |
| Desk Map | Primary title-tree work surface | cards, tract tabs, convey/predecessor/NPRI/lease actions, document chips, fit, clear behavior, math validation |
| Leasehold | Lease and payout review | unit focus, lease summaries, ORRI/WI filtering, formulas, included-in-math behavior |
| Flowchart | Canvas/print surface | import from Desk Map, layout, editing, page grid, print overlay |
| Runsheet | Chronological title view/export | row ordering, CSV/XLSX package direction, document references |
| Documents | Document registry | metadata editing, saved views, packet preview, links, PDF preview |
| Owners | Owner database | contacts, docs, leases, Desk Map link options |
| Curative | Title issues | issue lifecycle, entity links, source notes |
| Maps | Map/GIS evidence | uploads, passive validation, regions, featured map, source links |
| Research | Sources/project records/imports | RRC previews, formulas, project records, question tracking |
| Federal Leasing | Reference lease workspace | inventory, targets, map evidence, no Texas math effects |
| Sales Deck | In-app status deck | signed-in visibility, markdown snapshot behavior |
| AI Panel | Approval and assistance layer | approval previews, blocked proposals, undo, action journal |
| Navbar/File Actions | Workspace lifecycle | save/load, demo load, `.landroid` import/export, side-store reset |

## Documentation Coordination

Use these files as the rebuild source set:

- `AGENTS.md`: operating rules
- `PROJECT_CONTEXT.md`: domain boundaries and Texas/federal scope
- `docs/rebuild-plan.md`: rebuild source of truth
- `ARCHITECTURE.md`: current implementation map
- `ROADMAP.md`: current priority map
- `IDEAS.md`: parked ideas and future math/product expansions
- `LANDMAN-MATH-REFERENCE.md`: current formulas and user-facing math
- `TESTING.md`: validation commands and known gaps
- `SECURITY.md`: import, AI, upload, key, and hosted-security posture
- `DEPLOYMENT_STATE.md`: hosted deployment truth
- `CONTINUATION-PROMPT.md`: current handoff

Before a rebuild phase starts, update the relevant source-of-truth file instead
of burying decisions in chat.

## What Is Explicitly Not Approved Yet

- whole-app rewrite in one pass
- replacing current stores without parity checks
- making `.landroid` pure event-log only
- federal/private calculation math
- document-citing AI before OCR/text/citation anchors exist
- OCR engine implementation without a local-first security plan
- cloud OCR as a default or silent fallback
- broad cloud/backend rewrite
- SQLite/Tauri/object-storage source-of-truth migration before the relevant
  decision gate
- UI-library migration for its own sake
- automatic owner deduplication without review
- automatic AI mutation without approval
