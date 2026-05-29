# LANDroid Roadmap

This is a short priority map. Detailed remediation work lives in `PATCH_PLAN.md`;
session handoff lives in `CONTINUATION-PROMPT.md`.

## Now

- Treat `docs/rebuild-plan.md` as the planning source of truth for any rebuild
  work: Phase 0 current-behavior inventory is closed, Phase 0.75 minimal
  backend spine is implemented and deployed, Phase 0.5 workspace sharding
  scaffolding has started, then project record schema, evidence-grade document
  vault, source attestations, import/action
  layers, and only then workflow cutovers. Preserve dual decimal plus fraction
  display, print fidelity, in-flight migration safety, and citation
  verification as rebuild contracts.
- Keep `docs/phase-0-inventory.md` as the closed Phase 0 behavior catalog.
  Future-contract goldens remain parked for the implementation phase that
  creates each behavior, and lane rows should be re-verified before that lane is
  changed.
- Phase 0.75 checkpoint: the minimal backend-spine slice is implemented,
  deployed, committed, and pushed. It covers shared backend-shaped record/API
  contracts, local/mock/hosted adapter boundaries, a backend-spine
  health/session/record-validation package, a non-user-facing app startup
  contract check, hosted `/api/spine/*` Lambda/rewrite packaging, and a
  threat-model note. Keep full backend storage, object storage, OCR/search
  jobs, sync, sharing, collaboration, and multi-user permissions behind later
  gates.
- Phase 0.5 active implementation: shard the monolithic `workspaces.data` JSON
  inside Dexie against the Phase 0.75 record envelope before broad
  record-schema work, while preserving current user-visible behavior. The first
  code slices are still behavior-preserving: backend-spine manifest and Desk
  Map shard builders, local-only compatibility rows, autosave debounce naming,
  write-lease decision logic, lazy document-registry guard tests, and the Dexie
  v10 shard table upgrade. Runtime workspace load is shard-first with monolith
  fallback and startup warnings for shard fallback. The edit-stranding
  regression is now resolved: autosave writes the shard set (gated by the
  single-writer lease) instead of the monolith, the reader is recency-aware
  (a strictly newer monolith wins over stale shards), and shard reads/writes
  are scoped by the active per-user DB key, which also closes the cross-user
  shard leak. The monolithic `workspaces.data` row is now a frozen migration
  backup the reader falls back to with a loud warning. The lease now also has a
  runtime UI: a second tab opens read-only with a visible "editing elsewhere"
  banner and an explicit takeover confirmation, and canvas autosave shares the
  same lease gate. The document-vault lazy-load contract is locked by tests:
  project open and registry listing return blob-free metadata, and blob bytes
  load only on explicit preview/export. Remaining Phase 0.5 work:
  persistent-storage requests, a browser autosave-timing recapture at Raven
  Forest scale, and (deferred, evidence-gated) a metadata-first conversion of
  the blob-bearing side stores (owner docs, map assets, research imports).
- Preserve `.landroid` package export permanently even after sync/backend work.
- Promote the Evidence Vault contract: immutable originals, SHA-256 hashes,
  document versions, extraction runs, citation anchors, hash-continuity audit
  events, and deterministic packet manifests.
- Validate and review the Phase 7A document registry MVP from
  `codex/document-registry-build-2026-05-16`: flat document index, saved
  views, metadata editing, duplicate surfacing, linked-node display, and packet
  manifest preview.
- Keep the native `Sales Deck` current as a lightweight status surface by
  refreshing the build-time Markdown helper from current docs every few days.
- Keep ArcGIS work design-only for now; `docs/gis-data-catalog.md` remains the
  source inventory for a later canonical layer map.
- Test CSV row staging against additional recurring spreadsheet formats.
- Refine column aliases and row-review UX from real import feedback beyond the
  Elmore DOTO sample.
- Evaluate a safe binary Excel parser before re-enabling `.xlsx` / `.xls`
  parsing in AI-guided imports.
- Make batch graft/attach operations atomic.
- Harden `.landroid` and CSV import validation.

## Next

- Harden document packet export after the registry is reviewed: ZIP/PDF
  packaging, CSV load file, checksum manifest, source-citation sidecar,
  unresolved-issues export, and optional Concordance/Opticon-style eDiscovery
  sidecar.
- Expand entity document links beyond Desk Map nodes: owners, leases, curative
  issues, and research records.
- Unify document-like side stores before expanding the vault: owner documents,
  PDF map assets, research file imports, and registry documents should converge
  on shared document/entity-link semantics where practical.
- Add import-manifest previews for large document sources such as ArcGIS
  attachment tables, Dropbox/local folders, and selected source packets.
- Design OCR/text indexing after the document registry exists; AI document
  query should return citations and stay read-only by default. Until OCR/text
  anchors exist, AI may cite structured records and source attestations but not
  unsupported document text spans.
- Design the hybrid retrieval contract for future AI Q&A: exact/keyword search,
  vector recall, graph/schema traversal tools, deterministic math tools, rank
  fusion, and a `CitationVerifier` gate before answers display.
- Keep LANDroid hosted-web/PWA first. Native iOS and desktop installers remain
  deferred; Capacitor is a future option only if app-store distribution becomes
  a product requirement.
- Add safety-oriented storage UX after the inventory gates: rolling auto-export
  to a user-selected local folder where supported, a manual Backup Now path, and
  a visible storage health indicator showing last saved, last exported, and
  browser storage status.
- Design the project picker landing page after adding a real multi-workspace
  saved-project index instead of the current single autosave slot.
- Promote unit metadata to first-class records if future units need separate
  operator/effective-date settings beyond current Desk Map unit tags.
- Continue polishing AI mutation approval/proposal UX without losing the user's
  desired single-user local workflow speed.
- Add a persistent import ledger for staged spreadsheet rows.
- Add title-opinion-as-root and other `SourceAttestation` starting-source
  workflows after the document vault and import-session foundations are ready.
- Design `OpinionDraft`, `ObligationCalendar`, and `AbstractorPackage`
  projections after the record schema and evidence vault are explicit.
- Plan template-driven communication generation as a later product lane:
  workspace `.docx` templates, `{{variable}}` placeholders, variable manifest
  sidecars, manual fill fallback, AI-assisted fill through approval previews,
  and generated output saved back to the Evidence Vault.
- Plan universal command/search and inline AI as later product lanes: cross-app
  Cmd+K search over records/documents and contextual "Ask AI about this" on
  cards, rows, chips, documents, and fractions.
- Plan a professional three-pane Documents workflow after the vault model is
  explicit: filter tree, dense document list, metadata/preview panel, and
  saved views modeled after legal/eDiscovery document-management workflows.

## Later

- Evaluate SQLite WASM in OPFS, cloud object storage, and Tauri 2 desktop shell
  only at documented decision gates; do not make them Phase 1 defaults.
- Expand the backend beyond the Phase 0.75 spine only when a hard trigger
  appears. Later expansion should provide durable project storage, sync,
  backup, object storage, OCR/jobs, search, AI/RAG policy, audit, sharing, and
  future permissions, not a wholesale SaaS rewrite that removes local project
  semantics.
- Federal/private Phase 2 math only after the reference workspace and source
  packet workflow are stable enough for that gate.
- Revisit the Texas math-engine expansion plan in detail before implementation:
  NMA/DI, pooled-unit allocation, depth/substance/time, probate, estate vector,
  priority conflicts, Hysaw flags, Spanish/Mexican grants, contested states,
  deed reversibility, WI flow-through, and JOA structures.
- Hosted/security posture, including CSP and a backend AI proxy if cloud use
  becomes a deployment requirement.
- Deeper RRC decoder coverage only for high-value file families proven by real
  workflow use.

## Not Planned Unless Explicitly Requested

- Tribal lease math.
- Full federal/BLM calculation engine during the current Texas baseline.
- Rewriting the app architecture for its own sake.
- Broad parser support for every legacy RRC format before the high-value paths
  prove useful.
