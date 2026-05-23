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

- Incremental rebuild target: current behavior inventory, Phase 0.5 workspace
  sharding, project record schema, evidence-grade vault, action/event audit
  layer, then workflow cutovers. Current UI/workflows stay preserved until
  inventory, parity tests, and migration gates exist. The working source of
  truth is `docs/rebuild-plan.md`.
- Phase 0 ultra-review: a dedicated review that designs the current-behavior
  inventory, lane structure, fixture plan, performance baselines, and exit gate
  before implementation starts.
- Phase 0.75 backend architecture decision: after Phase 0 evidence, decide
  whether to add a backend spine for durable records, object storage, jobs,
  search, AI/RAG policy, audit, backup/sync, and future permissions before
  Phase 1 schema work.
- Evidence Vault package shape: immutable originals, SHA-256 checksums,
  document versions, extraction runs, derivative OCR/text sidecars, and
  deterministic packet manifests modeled after legal DMS/eDiscovery custody
  patterns.
- Source-attestation start workflows: title opinion, division order, probate
  inventory, prior chain, working assumption, patent, and Spanish grant as
  explicit starting-source options for a tract or project.
- Title-opinion-as-root import: upload an opinion PDF, extract or manually enter
  listed owners/fractions/effective date/exceptions, create a visible opinion
  root, and convert exceptions into cited curative issues.
- Runsheet package import/export: recurring Excel workbook plus
  `TitleDocuments` folder, relative hyperlinks, manifests, staged row review,
  and optional `LANDroid Target` / `LANDroid Action` helper columns.
- eDiscovery-compatible attorney packet sidecar: generated
  Concordance/Opticon-style load files, checksums, source citations, text
  folder, family relationships, and unresolved issues from the same packet
  manifest as the human workbook.
- Registry packet export that distinguishes link-bookkeeping manifests from
  deduped recipient packets.
- Entity document linking beyond Desk Map nodes: owners, leases, curative
  issues, research records, and GIS/map assets.
- Review-first OCR/text indexing with citations, kept separate from title math
  mutation paths.
- Local OCR/PDF toolchain for the Mac: `ocrmypdf`, `ocrmypdf-apple`,
  `tesseract`, `ghostscript`, `qpdf`, `poppler`, `mupdf`, `exiftool`,
  `sqlite-utils`, and `duckdb`.
- Hybrid AI search: exact/keyword search, vector recall, record traversal,
  deterministic math tools, rank fusion, and a `CitationVerifier` that rejects
  unsupported claims before display.
- Opinion-shaped deliverables: `OpinionDraft`, `ObligationCalendar`,
  `LeaseObligation`, and `AbstractorPackage` projections once the record schema
  and vault contracts are explicit.
- Tokenized DMS-style search such as `area:leasehold`, party names, instrument
  numbers, volume/page, quoted phrases, and saved filters over the unified
  document registry.
- Saved named packet selections.
- Import ledger for spreadsheet and document-source staging.
- Template-driven communication generation: workspace `.docx` templates with
  `{{variable}}` placeholders, variable manifest sidecars, manual fill fallback,
  AI-assisted fill through approval previews, and generated output saved back to
  the Evidence Vault. Candidate templates include lease forms, offer letters,
  extensions, ratifications, releases, affidavits of heirship, memoranda,
  division-order recommendations, stipulations, curative letters, mineral deeds,
  probate inquiries, and demand letters.
- Professional three-pane Documents workflow inspired by legal/eDiscovery DMS
  patterns: filter tree, dense document list, metadata/preview panel, saved
  views, bulk operations, history/links/packet tabs, and required metadata at
  ingestion once the vault model can enforce it.
- Universal command/search palette: cross-surface search over owners,
  documents, instruments, leases, curative issues, maps, research records, and
  project records, with eventual tokenized filters and navigation actions.
- Inline AI entry points: contextual "Ask AI about this" on Desk Map cards,
  document rows/chips, fractional values, leasehold rows, curative issues, and
  research records. Entity context should be preloaded and citation-verified
  before answers are displayed.
- Persistent workspace chat history: local IndexedDB storage first, exportable
  with the workspace when intended, and still governed by provider/security
  policy.
- Field/iPad mode: PWA-first, offline-capable, read-heavy/light-edit workflows
  for courthouse and field use, with Ollama/local AI as the offline path.
- Rolling auto-export and storage health UX: user-selected backup folder where
  the File System Access API supports it, timestamped `.landroid` snapshots,
  manual Backup Now, last saved / last exported / browser storage status, and
  warnings when export is overdue.

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

- 3D Desk Map exploration after 2D document/GIS traceability is stable.
- Cross-project party canonical identity after per-project `externalPartyId`
  hooks and review-gated deduplication are field-tested.
- Tauri 2 desktop shell if browser storage, local OCR process spawning, native
  filesystem packaging, or Raven Forest corpus size forces the pivot.

## Not Now

- OCR engine implementation.
- Dropbox API sync.
- ArcGIS import.
- AI document query.
- Federal/private math.
- Automatic title updates from document metadata.
