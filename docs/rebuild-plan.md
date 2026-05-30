# LANDroid Incremental Rebuild Plan

Status: planning source of truth.
Last updated: 2026-05-26.

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
- Phase 0.75 now starts a minimal backend-spine phase before Phase 0.5 storage
  work: shared record contracts, adapter boundaries, auth/session proof, and
  validation endpoints come now so sharded Dexie rows are backend-shaped from
  the start
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
- full backend storage/sync/OCR/search/collaboration before the minimal
  Phase 0.75 spine proves the record and deployment contract
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

Packet manifest goldens must be named by packet source mode. `Packet: Filter`,
`Packet: Selected`, and `Packet: Runsheet` can legitimately produce different
item sets from the same workspace, so a full-registry packet manifest golden
does not prove the runsheet packet contract. Phase 1/2 document-vault tests
should add source-mode-specific manifest fixtures before export behavior is
changed.

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

### Phase 0.75: Minimal Backend Spine

Goal: add the smallest backend spine and backend-shaped record contract before
Phase 0.5 storage sharding, so Dexie sharding does not have to be redesigned
around server records later.

Decision:

- start Phase 0.75 now as a backend-spine planning and implementation phase
- do not build the full collaboration/OCR/search/multi-user backend yet
- keep LANDroid local-first; core title, math, document review, project work,
  and `.landroid` package export remain usable without the network
- make Phase 0.5 Dexie sharding mirror backend-shaped records from the start

This gate occurs immediately after Phase 0 and before Phase 0.5 because the
record envelope, IDs, version metadata, document-object references, and audit
shape must be known before splitting the monolithic `workspaces.data` payload.

Minimal backend spine to add now:

- shared TypeScript/Zod contract for backend-shaped records and API payloads
- versioned `RecordEnvelope` carrying `recordId`, `recordType`, `workspaceId`,
  `projectId`, `schemaVersion`, `lastModified`, `revision`, `deletedAt`,
  `source`, and optional `syncState`
- minimal server package separate from `backend/ai-proxy` unless reuse is
  explicitly cheaper; the current AI proxy remains an AI gateway, not the
  project-record backend
- Cognito-authenticated health/session endpoint so the app can prove auth,
  tenant/user identity, server contract version, and deployment wiring
- project manifest and record-validation endpoints before durable server
  project storage; these prove the contract without making the backend the
  source of truth
- local adapter boundary so the frontend can talk to `local-only`, `mock`, or
  hosted backend modes without changing domain code
- CI validation for the shared contract, backend handler, auth/session policy,
  and no-secrets/no-generated-artifact boundaries

Remain local-first:

- active workspace editing and autosave source of truth during Phase 0.75 and
  Phase 0.5
- Desk Map, Leasehold, Runsheet, Documents, Owners, Curative, Maps, Research,
  Federal Leasing, Flowchart, and AI approval UI behavior
- document preview from local IndexedDB / local package state
- `.landroid` import/export, future-version rejection, rollback-safe side-store
  replacement, and complete package export
- local AI/Ollama and approval-gated mutation flow
- Texas math engine and `MathInputView` parity contracts

Full backend responsibilities remain later gates:

- durable shared project storage as source of truth
- object storage for originals, derivatives, OCR text, and packet artifacts
- signed document access URLs
- OCR, extraction, indexing, and packet-export background jobs
- exact/keyword search and later vector recall
- server-controlled AI/RAG retrieval over document text
- backup and multi-device sync
- sharing, multi-user permissions, and collaboration conflict resolution
- cross-project party identity indexes

Record models that must be defined before Phase 0.5 sharding:

- `Project`
- `WorkspaceManifest`
- `RecordEnvelope`
- `Party`
- `PartyAlias`
- `Document`
- `DocumentVersion`
- `VaultObject`
- `DocumentLink`
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

Dexie/backend compatibility rules:

- every sharded Dexie row must be representable as a backend record or a
  declared local-only projection/cache row
- all project records carry stable IDs and `workspaceId`/`projectId` scoping
- records that can later sync carry `lastModified`, `revision`, and optional
  `deletedAt` tombstone metadata
- document bytes stay content-hash addressed; Dexie blobs, `.landroid` package
  files, and later object-storage objects refer to the same hash identity
- `.landroid` export includes complete local state even when sync metadata
  exists or the backend is unreachable
- import/export adapters preserve v8 read compatibility and introduce any new
  write format with explicit version dispatch and rollback tests
- actions/audit records describe intentional changes; snapshots remain backup
  and migration artifacts, not the only durable story

Security/deployment/test gates before coding beyond the first slice:

- threat-model note for the minimal spine covering Cognito auth, user/project
  boundaries, API body caps, logging, document metadata, record validation, and
  `.landroid` export/backups
- deployment note deciding whether the spine is a new Lambda, an extension of
  existing hosted infrastructure, or a local/mock-only contract until the first
  hosted test
- tests proving unauthenticated requests fail, authenticated session shape is
  stable, client-supplied tenant/user IDs are not trusted, request bodies are
  size-limited, and record validation rejects unknown/future schemas safely
- root validation plus backend-package tests/build for any server code
- no deploy claim unless `DEPLOYMENT_STATE.md` is updated and hosted smoke
  evidence exists

Smallest safe first implementation slice:

1. Update source-of-truth docs and ADRs with this decision.
2. Add shared contract types/schemas for `RecordEnvelope`, `Project`,
   `WorkspaceManifest`, `Document`, `DocumentLink`, `VaultObject`, `Party`,
   `SourceAttestation`, `ImportSession`, `ActionPlan`, `ActionRecord`, and
   `AuditEvent`; add serialization tests only.
3. Add a local backend adapter interface with `local-only` and `mock` modes so
   Phase 0.5 can call the same boundary without network dependency.
4. Add a minimal backend service package with health/session and
   record-validation endpoints; reuse Cognito verification patterns, but do not
   add project storage or document upload yet.
5. Wire a non-user-facing contract check from the app to the adapter only after
   tests prove no behavior changes.

Token/time tradeoff:

- doing the contract and minimal spine now costs one extra planning pass and a
  small implementation slice before sharding
- it avoids reworking every Phase 0.5 Dexie table, `.landroid` version, record
  ID, action/audit path, and document-hash rule after the fact
- it also keeps the expensive parts out of scope: no database migration, no
  object storage custody, no OCR/search workers, no collaboration semantics,
  and no full sync conflict UI yet
- given limited work windows, this is the lower total-context path: spend more
  upfront on the record/server contract, then let Phase 0.5 and Phase 1 reuse it
  instead of repeatedly reopening the backend question

Exit gate:

- written backend decision updated: minimal spine now, full backend later
- backend responsibilities and non-responsibilities documented
- local-first/export contract reaffirmed
- record-envelope and core record requirements added to Phase 0.5 and Phase 1
  acceptance criteria
- security, deployment, and testing gates documented before server coding
- smallest first implementation slice is limited to shared contracts, adapter
  boundary, and health/session/validation endpoints

Implementation checkpoint, 2026-05-25:

- shared contract schemas live in `src/backend-spine/contracts.ts`
- every declared `recordType` is represented in the validation union. Record
  types whose full body schema is not defined yet use strict envelope-only
  stubs so Phase 0.5 can shard against a canonical envelope without accepting
  arbitrary payloads.
- local-only, mock, and hosted adapter boundaries live in
  `src/backend-spine/adapter.ts`
- the non-user-facing app startup contract check lives in
  `src/backend-spine/app-contract-check.ts`; it runs from `src/main.tsx` in
  local mode and from `src/auth/AuthProvider.tsx` after hosted auth. It sends
  health, session, and a synthetic project-record validation probe only
- the minimal backend proof package lives in `backend/spine`
- the package currently exposes pure health, session, and record-validation
  handler logic plus a Lambda wrapper at `backend/spine/src/lambda.ts`; it does
  not persist project records, upload document bytes, run OCR/search, sync
  projects, or provide collaboration
- repo-side hosted wiring now includes a `/api/spine/<*>` Amplify rewrite
  template, render helper support, deployment guide/checklist updates, and
  smoke-test coverage for public health plus unauthenticated session/
  validation rejection
- live hosted wiring was deployed on 2026-05-26: the separate
  `landroid-backend-spine` Lambda Function URL is routed through Amplify
  `/api/spine/<*>`, and hosted smoke passed for health, unauthenticated
  rejection, oversized-body rejection, SPA fallback, and Cognito metadata
- the initial threat-model note is `docs/backend-spine-threat-model.md`

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

Kickoff inventory, 2026-05-26:

| Area | Current path | Phase 0.5 treatment |
| --- | --- | --- |
| Core workspace | `workspaces.data` stores one JSON string for `WorkspaceData`: `workspaceId`, `projectName`, `nodes`, `deskMaps`, leasehold arrays, active IDs, and `instrumentTypes`. It is written by the debounced autosave in `src/main.tsx` through `saveWorkspaceToDb`. | Shard first. This is the main scale risk and the reason Phase 0.5 exists. |
| Canvas | `canvases.data` stores one JSON string for React Flow nodes, edges, viewport, grid, page, spacing, snap, and tool-adjacent layout state. | Keep behavior, but split enough metadata to prove viewport persistence and avoid coupling every viewport move to the full workspace shard. |
| Documents | `documents` stores PDF blobs plus metadata; `document_attachments` stores workspace-scoped entity links. Registry reads already omit blobs, while export/import and single-document preview read blobs intentionally. | Preserve the table shape at first, add envelope-compatible metadata/projection rows later, and add tests proving project open does not bulk-read all blobs. |
| Owner side store | `owners`, `leases`, `contactLogs`, and `ownerDocs`; `ownerDocs` still embeds blobs. Store actions write these tables directly. | Leave table-by-table behavior intact in the first shard, then add envelope metadata and lazy owner-document blob loading only where needed. |
| Map side store | `mapAssets`, `mapRegions`, and `mapExternalReferences`; `mapAssets` embeds blobs. | Preserve current map UX and link cleanup; treat map blobs as lazy-load candidates after primary Documents PDFs are guarded. |
| Research side store | `researchImports`, `researchSources`, `researchFormulas`, `researchProjectRecords`, and `researchQuestions`; imports embed blobs. | Preserve current reference workspace behavior; do not promote Research imports into OCR/search or backend jobs in Phase 0.5. |
| Curative side store | `titleIssues` rows loaded by workspace and sorted in memory. | Already sharded enough for Phase 0.5 scale; keep it as a side-store table and map it to backend `curative_issue` later. |
| Legacy PDFs | `pdfs` is read-only rollback/migration support for v7 one-PDF-per-node workspaces. | Keep until the sharded migration has a proven backup/export path; do not write new rows. |
| Workspace keys | Local mode uses `default` / `active-canvas`; hosted mode waits for Cognito `sub` and uses `user-{sub}` scoped keys. | Preserve exactly. Sharding must not reintroduce signed-out hosted reads of local default rows. |

Initial shard order:

1. Add a `WorkspaceManifest` / project metadata row that carries the Phase 0.75
   envelope fields, `LANDROID_FILE_VERSION`, saved time, record counts, and a
   pointer to any legacy monolith backup.
2. Split `deskMaps` into sharded tract/desk-map rows, including unit fields,
   acreage fields, external refs, and ordered node membership.
3. Split `nodes` into one row per current `OwnershipNode`. These rows are
   Phase 0.5 compatibility rows over current title-card state, not the final
   Phase 1 semantic split into `InstrumentRecord` / `InterestReference`.
   Where a backend record body is not defined yet, validate/send only the
   strict envelope stub and declare the Dexie payload local-only.
4. Split leasehold state from the workspace JSON: `leaseholdUnit`,
   `leaseholdAssignments`, `leaseholdOrris`, and
   `leaseholdTransferOrderEntries`. Keep the current math projections and
   ordering contracts unchanged.
5. Split active workspace UI state (`activeDeskMapId`, `activeUnitCode`, and
   `instrumentTypes`) into a small local-only workspace-state row so changing
   focus does not rewrite every title node.
6. Handle canvas persistence separately from the core workspace shard. Viewport
   persistence is part of Phase 0.5 acceptance, but broad Flowchart print/layout
   behavior remains a parity target, not a redesign.
7. Leave already-sharded side stores in place for the first implementation
   slice. Add envelope adapters/projections around them only when the core
   workspace split is stable.

Migration and rollback strategy:

- Use a Dexie schema bump after v9 for the shard tables; do not bump
  `LANDROID_FILE_VERSION` merely because local IndexedDB is sharded.
- During upgrade, parse every existing `workspaces.data` row with the same
  `parsePersistedWorkspaceData` normalization used today, then write the new
  shard rows in a single migration transaction where Dexie permits it.
- Keep the pre-shard monolithic workspace row as a rollback/diagnostic backup
  until sharded load, autosave, `.landroid` export, and side-store reset are
  proven. Do not keep rewriting the monolith on every autosave, because that
  would preserve the scale bottleneck.
- Make sharded load idempotent and recency-aware: prefer complete shard rows
  only when they are at least as fresh as the monolith, fall back to the legacy
  monolith if shard rows are absent, incomplete, stale, or fail validation, and
  surface a startup warning rather than silently dropping data. This recency
  check is now implemented in `readWorkspaceFromShardRows` and was the gate that
  made the shard-first read safe to pair with the shard writer. (History: while
  the read path was shard-first but autosave still wrote only the monolith, the
  monolith was the newer copy after any edit, so preferring shards
  unconditionally stranded every post-migration edit on reload. The shard writer
  plus the recency check close that window.)
- Keep `.landroid` import/export assembled through compatibility adapters.
  Existing v7/v8 reads, `version > 8` rejection, v7 PDF migration, and
  rollback-safe side-store replacement remain required. A future package-format
  bump needs explicit version dispatch and round-trip tests before it writes
  anything other than the current v8 package shape.
- Preserve CSV and demo loaders by routing replacement through the same shard
  writer and existing `replaceWorkspaceSideStores` boundary.
- Treat AI undo snapshots as compatibility snapshots during Phase 0.5. Do not
  convert them into durable audit/action records in this phase.

Local-first and offline plan:

- Dexie remains the active source of truth for core workflows during Phase 0.5.
  The Phase 0.75 backend spine is a contract check, not storage, sync, or an
  online dependency for editing.
- Sharded load, edit, autosave, document preview, `.landroid` import/export,
  and AI approval/undo must work without network access where they work today.
- Hosted mode keeps Cognito-based local key scoping, but project data still
  lives in browser IndexedDB unless a later backend-storage gate is approved.
- Request `navigator.storage.persist()` where supported and record whether it
  was granted or refused. A refusal is a durability warning, not a reason to
  disable local-first workflows.
- `.landroid` export remains the permanent escape hatch and must be available
  even when the backend spine is unreachable.

Multi-tab single-writer plan:

- Add a workspace-scoped write lease before shard writes are considered
  production-safe. The intended contract is pessimistic: one writable tab per
  workspace, later tabs open read-only with a visible "editing elsewhere"
  warning and an explicit takeover confirmation.
- Store the lease in Dexie with `workspaceId`, `ownerTabId`, heartbeat time,
  expiry, and a fencing/revision token. Use `BroadcastChannel` for fast tab
  notice and a timer/expiry fallback for browsers that miss broadcasts.
- Gate workspace autosave, canvas autosave, and direct side-store mutation
  helpers behind the same writable-tab assertion. Last-write-wins remains only
  a documented Phase 0 dev boundary until this gate lands.
- Do not implement optimistic merge/conflict UI in Phase 0.5. That belongs with
  later sync/collaboration scope if a real multi-user requirement appears.

Lazy document/blob loading plan:

- Opening a project must load document metadata and links, not every PDF/blob.
  `listDocumentRegistryData`, `listDocsForEntity`, and `listAttachmentsForNodes`
  follow this pattern for the main `documents` table, and that behavior is now
  locked by `document-store-lazy.test.ts`: every project-open listing reader
  returns blob-free metadata (`Omit<DocumentRecord, 'blob'>` / attachment
  summaries), the workspace store never retains blob bytes, and `getDocBlob` is
  the only explicit byte path. A future reader change that leaks a blob into
  project open now fails the contract test.
- Single-document preview, `.landroid` export, package export, and explicit
  backup flows are allowed to read blobs because the user asked for the bytes.
- Blob-bearing side stores (`ownerDocs`, `mapAssets`, and `researchImports`)
  remain the next lazy-load candidates and are deliberately deferred. Their
  views (`MapsView`, `DeskMapView`, `OwnerDocsTab`, `ResearchView`) read
  `asset.blob` / `doc.blob` synchronously, so a metadata-first conversion means
  an async preview/parse refactor across those views — explicitly out of scope
  for Phase 0.5 ("do not redesign their UI"). The stores currently retain the
  Dexie Blob objects, which are lazy IndexedDB references (no bytes are read
  until preview/export), so there is no measured project-open memory regression
  forcing the conversion yet. Revisit when memory evidence requires it, ideally
  by denormalizing `fileName`/`kind` onto attachment-style rows so open never
  reads the blob-bearing tables at all.
- Blob content hashes remain the identity bridge across Dexie blobs,
  `.landroid` package files, and later object storage.

Targeted tests and performance gates before implementation:

- First implemented guardrails now cover pure shard-building/round-trip,
  active UI-state isolation, multi-tab write-lease decisions, autosave debounce
  naming, and lazy document-registry metadata reads. These are scaffolding only
  and are not yet wired into live Dexie shard writes.
- The next slice performs the explicit IndexedDB gate: Dexie v10 now creates
  shard/write-lease tables and backfills them from existing monolithic
  `WorkspaceRecord` rows. The monolithic row is preserved and remains the live
  load/save source until the shard reader/writer and write-lock gate are proven.
- The shard reader is now implemented as a pure adapter. Complete shard rows
  reconstruct `WorkspaceData`; incomplete/corrupt shard rows fall back to the
  preserved monolith; missing or corrupt fallback rows report corruption. The
  runtime load path uses this reader shard-first and surfaces fallback warnings
  through the startup warning channel.
- The shard writer slice is now landed and the edit-stranding regression is
  resolved. Autosave (`src/main.tsx`) calls `saveWorkspaceShardsToDb`, which
  rebuilds the shard set with `buildWorkspaceShards` and writes all five shard
  tables in one `db.transaction('rw', …)` so a mid-write failure cannot leave a
  partial set. The monolith is no longer rewritten on autosave; it stays a
  frozen migration backup the reader falls back to with a loud warning. The
  reader is recency-aware — a strictly newer monolith wins over stale shards —
  and resolves shards by the active per-user DB key (`getWorkspaceDbKey()`)
  stamped on the manifest. That key scoping plus a refusal to adopt a foreign
  manifest when the current user's monolith is absent closes the cross-user
  shard leak (Bug 001). Shard writes are gated by the single-writer lease
  (`workspace-write-lease.ts`, `BroadcastChannel` + Dexie expiry); a non-writer
  tab returns `blocked` and writes nothing. `replaceWorkspaceSideStores` clears
  the active key's shard rows on workspace replacement / sign-out.
- The single-writer lease now has a runtime UI. The controller in
  `workspace-write-lease.ts` engages the lease at startup and after a workspace
  swap (`src/main.tsx`), tracks a writer/reader/idle role, and pushes role
  transitions to `store/write-lease-store.ts`. A second tab opens read-only with
  a visible "editing elsewhere" banner (`WriteLeaseBanner`) and an explicit
  takeover confirmation; a writer steps down to read-only on a peer's claim
  broadcast and a reader auto-promotes when the writer releases. Canvas autosave
  shares the same lease gate. The banner is signalling plus a write gate — it
  does not yet disable individual edit controls across every view (deferred).
- Follow-up hardening landed: the monolithic backup is re-anchored when the
  active workspace changes (import / CSV / fresh install) so a corruption
  fallback lands on the current workspace, not the stale pre-import one; a
  two-tab Playwright e2e exercises the lease/banner/takeover end to end; and the
  sharded autosave was re-measured at 1476-node scale — 2276 ms to persist after
  an edit (2000 ms debounce + ~276 ms shard write) versus a 2062 ms monolith
  baseline, ~210 ms slower and off the debounced interaction path. Evidence:
  `fixtures/phase-0/perf/2026-05-30-shard-autosave/`. Still deferred:
  `navigator.storage.persist()` and the side-store metadata-first conversion.
- Add storage tests for monolith-to-shard migration, corrupt-shard fallback,
  idempotent rerun, v7/v8 `.landroid` import compatibility, future-version
  rejection, and rollback-safe side-store replacement.
- Add autosave tests for the extracted debounce constant, reference-change
  detection against the new shard writer, and separate active-focus writes.
- Add lock tests for first-tab writable, second-tab read-only, stale lease
  takeover, explicit takeover confirmation, and blocked writes from a
  non-writable tab.
- Add lazy-load tests that project open and registry listing do not fetch every
  document blob, while preview/export still fetch the requested bytes.
- Run the existing storage/document target set before broad validation:
  `npm test -- src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts src/storage/__tests__/document-store.test.ts src/storage/__tests__/document-migration.test.ts src/storage/__tests__/autosave-change-detection.test.ts src/storage/__tests__/active-workspace-key.test.ts src/storage/__tests__/persistence-db-key.test.ts src/phase0/__tests__/vulcan-mesa-fixtures.test.ts`.
- Re-run `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`, and
  `npm run deploy:check` before declaring Phase 0.5 implementation complete.
- Compare autosave, project-open, document-registry, `.landroid` round-trip,
  and Raven Forest-scale captures against Phase 0 baselines. The target remains
  1,000-3,000 title nodes and 200-1,000 document records/PDFs on iPad
  Pro-class hardware or a documented equivalent, without full-blob workspace
  rewrites.

Token/time tradeoff:

- The higher-total-value path is to spend planning and test-design effort now:
  table inventory, envelope mapping, migration gates, lock gates, and lazy-load
  contracts before implementation.
- This costs more up front than simply splitting `nodes` into a table, but it
  avoids repeatedly reopening Dexie versions, `.landroid` compatibility,
  backend record IDs, document hash identity, side-store reset behavior, and
  multi-tab safety during Phase 1 and later backend work.
- Scope stays tight by refusing the expensive parts now: no durable backend
  project storage, object storage, OCR/search, sync, collaboration,
  multi-user permissions, or new product workflows.

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
- design records against the Phase 0.75 backend-spine contract: stable IDs,
  `workspaceId`, `projectId`, `lastModified` / version fields where needed,
  revisions/tombstones for future sync, and content-hash references for
  blob-backed records
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
