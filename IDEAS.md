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

- Registry packet export that distinguishes link-bookkeeping manifests from
  deduped recipient packets.
- Entity document linking beyond Desk Map nodes: owners, leases, curative
  issues, research records, and GIS/map assets.
- Review-first OCR/text indexing with citations, kept separate from title math
  mutation paths.
- Import ledger for spreadsheet and document-source staging.

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
