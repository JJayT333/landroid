# LANDroid Incremental Rebuild Plan

Status: planning source of truth.
Last updated: 2026-05-21.

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

- the domain model is a project record graph, not an event log
- events/actions are the audit and mutation layer over records
- `.landroid` should become a hybrid package/snapshot plus action records and
  provenance, not a pure event-log-only file
- documents live in the Document Vault as stable entities, not inside events
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
  manifest JSON, manifest CSV, and unresolved-issue list
- AI answer contract: answer, reasoning summary, cited sources, confidence /
  limits, open issues, and suggested next action
- federal/private and horizontal-well project records without turning on
  federal/private math until an explicit gate

Deferred or left out for now:

- whole-app rewrite in one pass
- pure event-sourced `.landroid` files
- putting PDF/document blobs in events
- automatic AI mutation without user approval
- automatic owner deduplication without user review
- broad shadcn/Storybook migration as a standalone phase
- OCR engine implementation before the document vault and source-review flow
  are ready
- federal/private calculation math before the explicit Phase 2 math gate in
  `PROJECT_CONTEXT.md`
- detailed Texas math-engine expansion until the dedicated math pass

## Core Decision

LANDroid should be rebuilt around a project record graph, not around an event
log as the domain model.

The domain truth is made of records:

- `Project`
- `Party`
- `PartyAlias`
- `Document`
- `DocumentLink`
- `SourceCitation`
- `SourceAttestation`
- `InstrumentRecord`
- `Tract`
- `DeskMap`
- `Lease`
- `Unit`
- `Wellbore`
- `InterestReference`
- `CurativeIssue`
- `ImportSession`
- `ActionPlan`
- `ActionRecord`

Events and actions still matter, but they are the mutation/audit layer over the
records. They are not the primary shape of the business data.

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
  Record graph
    Parties and aliases
    Documents and source citations
    Instruments and source attestations
    Tracts, Desk Maps, leases, units, wellbores
    Interest references and curative issues
  Action layer
    Typed commands
    Approval previews
    Action records
    Undo / rollback boundary
  Projections
    Desk Map tree
    Runsheet view
    Leasehold view
    Document packet view
    Owner index
    AI cited-answer context
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

- one project file/package contains one project record graph
- documents are stored once per project and linked many times
- parties can be linked across the whole project
- packet export can include the workbook, manifests, document folder, and
  source evidence needed by a title attorney

## Document Vault

Documents are first-class records, not event payloads.

A document should have one stable `Document` record and many `DocumentLink`
records. A single PDF may link to a node, owner, lease, tract, unit, curative
issue, research record, import row, source attestation, or packet.

The vault must support:

- native file retention
- stable document IDs
- source metadata
- document-to-entity links
- OCR/text extraction status
- citations to page/region/text spans when available
- packet export with native files and manifests
- side-by-side document review later

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
- unresolved issue list when relevant

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

AI should use:

- structured project records
- source citations
- OCR/text chunks when available
- document metadata
- deterministic math tools
- action records
- open curative issues

AI should not be the primary parser for stable workbook templates. It should
help with unfamiliar formats, remarks interpretation, extraction review,
target suggestions, and cited project Q&A.

## Rebuild Phases

Every phase must end with the app working.

### Phase 0: Current Behavior Inventory And Golden Masters

Goal: freeze the current observable behavior before rebuilding foundations.

Required work:

- inventory every page and major workflow
- define acceptance checks for each page
- add or strengthen golden-master tests for math, import/export, document
  chips, Leasehold summaries, Flowchart print, `.landroid` round trip, AI
  approvals, and the current Playwright workflows
- record known gaps instead of pretending they are covered

Exit gate:

- current branch has a documented page/workflow inventory
- full relevant tests pass
- missing coverage is listed in this document or `TESTING.md`

### Phase 1: Project Record Graph Foundations

Goal: define durable records beside the existing app without changing behavior.

Required work:

- define `Project`, `Party`, `PartyAlias`, `DocumentLink`, `SourceCitation`,
  `SourceAttestation`, `InstrumentRecord`, `Tract`, `Unit`, `Wellbore`,
  `InterestReference`, `CurativeIssue`, `ImportSession`, `ActionPlan`, and
  `ActionRecord` types
- keep current Zustand stores operational
- add adapter/projection helpers instead of forcing a UI migration
- add Zod schemas at import/export boundaries

Exit gate:

- no UI behavior changes
- type-level tests and serialization tests pass
- `.landroid` migration strategy is documented before format changes

### Phase 2: Document Vault And Packet Model

Goal: make documents and packet export the stable evidence layer.

Required work:

- promote documents as shared project entities linked many times
- ensure attachment ordering and workspace scoping are correct
- support links to nodes, owners, leases, curative issues, research records,
  source attestations, tracts, and imports
- design attorney packet export around native files plus manifests

Exit gate:

- existing Documents, Desk Map chips, and packet preview still work
- link deletion does not delete shared documents incorrectly
- exported manifests are deterministic

### Phase 3: ImportSession, Source Review, And ActionPlan

Goal: turn uploads into reviewable staged work, not blind mutation.

Required work:

- support recurring runsheet packages
- support title-opinion-as-root import
- support immutable source rows and source excerpts
- support staged candidates with confidence and questions
- support side-by-side source review when OCR/text is available
- support batch approval into typed actions

Exit gate:

- user can preview what LANDroid intends to create
- ambiguous rows become questions
- rejected candidates leave no mutation behind
- approved candidates cite their source rows/documents

### Phase 4: Action Layer As Canonical Mutation Path

Goal: route meaningful changes through typed actions and durable records while
the current app remains the reference.

Required work:

- define typed commands for graph mutations, document links, owner edits,
  lease edits, curative edits, imports, and AI proposals
- write `ActionRecord`s for approved changes
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
- connect wells, tracts, maps, leases, units, and documents
- keep federal/private data reference-only until the explicit math gate

Exit gate:

- Texas Desk Map and Leasehold math remain unchanged
- federal/private records are queryable and packetable
- no federal/private calculation affects active Texas outputs

### Phase 7: Math Engine Expansion

Goal: expand Texas title math only after the record graph and provenance layer
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
- OCR engine implementation
- broad cloud/backend rewrite
- UI-library migration for its own sake
- automatic owner deduplication without review
- automatic AI mutation without approval
