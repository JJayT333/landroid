# LANDroid Ideas

Use this as the low-friction parking lot for ideas, questions, workflow hunches,
and feature sketches that are not yet committed roadmap work.

Rules:

- Add ideas quickly; refine later.
- Do not treat an item here as approved scope.
- Promote only the best, most timely items into `ROADMAP.md`.
- Move shipped work to `CHANGELOG.md`, not here.

## Inbox

- Phase 7A.5 document registry reconciliation: keep Codex as the validated base,
  port Claude's stronger schema/test ideas, and preserve old field-name imports.
- Document cleanup pass: archive point-in-time audit/prompt files after the
  current branch is checkpointed, then shorten the root doc list.

## Promising

- Incremental rebuild target: project record graph first, action/event audit
  layer second, current UI/workflows preserved until inventory and parity tests
  exist. The working source of truth is `docs/rebuild-plan.md`.
- Source-attestation start workflows: title opinion, division order, probate
  inventory, prior chain, working assumption, patent, and Spanish grant as
  explicit starting-source options for a tract or project.
- Title-opinion-as-root import: upload an opinion PDF, extract or manually enter
  listed owners/fractions/effective date/exceptions, create a visible opinion
  root, and convert exceptions into cited curative issues.
- Runsheet package import/export: recurring Excel workbook plus
  `TitleDocuments` folder, relative hyperlinks, manifests, staged row review,
  and optional `LANDroid Target` / `LANDroid Action` helper columns.
- Registry packet export that distinguishes link-bookkeeping manifests from
  deduped recipient packets.
- Entity document linking beyond Desk Map nodes: owners, leases, curative
  issues, research records, and GIS/map assets.
- Review-first OCR/text indexing with citations, kept separate from title math
  mutation paths.
- Import ledger for spreadsheet and document-source staging.

## Math Engine Revisit

Parked for a dedicated design pass before implementation:

- Net mineral acres and decimal interest as first-class outputs.
- Pooled-unit allocation engine.
- Substance severance.
- Depth severance.
- Term, defeasible, and life-estate interests.
- Probate cascade assistant.
- Estate-vector decomposition: executive right, bonus, delay rental, royalty,
  and working interest.
- Recording date and priority conflicts.
- Hysaw/Luckel/Bath ambiguity flags.
- Spanish/Mexican grant rule pack.
- Vacancy, gap, strip-and-gore, accretion, and contested-state markers.
- Deeds as first-class reversible source entities.
- Working-interest flow-through.
- JOA structures.

## Questions To Revisit

- Should `Inbox` mean unfiled triage only, or should the label become
  `Needs Review` with explicit review criteria?
- When is a document packet "ready enough" to export: metadata complete,
  entity-linked, deduped, or all three?
- What is the smallest useful ArcGIS handoff artifact before native GIS import?

## Parked

- Tokenized DMS-style search such as `area:leasehold` and quoted phrases.
- Saved named packet selections.
- 3D Desk Map exploration after 2D document/GIS traceability is stable.

## Not Now

- OCR engine implementation.
- Dropbox API sync.
- ArcGIS import.
- AI document query.
- Federal/private math.
- Automatic title updates from document metadata.
