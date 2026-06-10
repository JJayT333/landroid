# LANDroid Roadmap

This is a short priority map. The open-findings master list is
`docs/audit-backlog.md` (plus `docs/deep-audit-2026-06-10.md` until reconciled);
phase detail lives in `docs/rebuild-plan.md`; session handoff lives in
`CONTINUATION-PROMPT.md`.

Operating posture: rebuild-first (single operator, no production users; safety
through reversibility and validation, not continuous runnability). The full
posture text and its hard contracts live in `AGENTS.md` and
`PROJECT_CONTEXT.md` — they are not duplicated here; if they ever disagree,
those two files win.

## Now

1. Scope B hardening — close the gap between the merged read-flip and its
   claims before any further cutover or record-layer work
   (`docs/deep-audit-2026-06-10.md` §1): journal `clearDeskMapNodes` /
   `deleteDeskMap` + a journal-coverage test (DA-C1); make Undo/`loadWorkspace`
   hydrate-then-append instead of erasing the ledger (DA-H2); rollback-result
   refactor so cascades and return values respect a cutover veto (DA-H3);
   ledger flush ordering + quarantine-instead-of-erase on invalid chains
   (DA-H4); hash ActionRecord payloads into the audit events (DA-H5); fence
   title-ledger writes and project rename/delete behind the write lease
   (DA-M15); add the lease heartbeat loop (DA-M14). Auto-flip stays disabled
   until the coverage test is green. Closes the remaining halves of ACT-H05,
   ACT-M01 (origin threading), and LLA-H02.
2. Evidence integrity — export ALL workspace documents (not just node-attached)
   so import/undo/reset cannot destroy originals (DA-H6); recompute SHA-256 on
   `.landroid` import and verify on export, with a one-time blank-hash backfill
   (DA-H7); quota-error surfacing in storage health (DA-M11); rolling
   auto-export keep-last-N retention (DA-M16).
3. Precision policy — one `display-format` module (9-dp decimal everywhere a
   derived interest shows, percent only as a gloss), mechanical sweep of the
   ad-hoc formatters, ESLint guard; plus the csv-io Decimal parse fix (DA-H10).
   Report §3 is the spec.
4. Display-correctness fixes — live Flowchart fractions or a stale banner
   gating Print (DA-H8); per-tract ORRI on the Map-mode branch card (DA-H9);
   formula tooltips render the summary's own staged intermediates and the
   engine fraction formatter (DA-M6/M7).
5. Research-workspace hardening, before the title-math catalog lands there
   (`docs/deep-audit-2026-06-10-part2.md` §1): rollback-on-failed-save for
   research stores (DA2-R1), `documentId` links on research records +
   `'research'` document attachments (DA2-R2), cross-store unlink cascades
   (DA2-R3/R4). The catalog CSV importer
   (`docs/title-math-research-supplement.md` Addition 3) follows.
6. Fixed-NPRI allocation decision (DA-H1) — attorney review of "fixed NPRI
   comes out of the burdened lessor's royalty to its extent; excess to WI with
   a warning flag," then a deliberate golden-master update. This is a
   correctness decision and precedes any Phase 7 math expansion.
7. Flowchart wiring sprint (F-Phase 1, Part 2 §3 — parallel-safe Codex lane,
   touches no math files): activate the built-but-dead shape tools (DA2-F1),
   fix the select-tool lasso (DA2-F2), merge-import that preserves
   annotations (DA2-F3), restore the saved viewport (DA2-F7), PNG export.
8. Carry-overs still active: make batch graft/attach operations atomic; harden
   `.landroid` and CSV import validation (includes the non-numeric
   future-version gate bypass DA-L8 and the lease-jurisdiction whole-file
   abort DA2-FED5); test CSV row staging against more recurring spreadsheet
   formats; evaluate a safe binary Excel parser before re-enabling
   `.xlsx`/`.xls` in AI imports.
9. Preserve `.landroid` package export permanently, through every change above.

## Next

- Texas math expansion, staged (rebuild-plan Phase 7 + audit §4 gap matrix):
  one design pass over the full list, then one golden-mastered slice at a time —
  over-conveyance stop-and-ask / Duhig suggestion (replaces the silent
  fraction-mode cap, DA-M1) → double-fraction input ("a/b of c/d", verbatim
  deed text preserved) → NPRI pooling-ratification tri-state + transfer-order
  hold → unleased mineral-owner payout rows → then NMA/DI, depth/substance/
  time, probate/estate, priority conflicts, Hysaw flags, reversible deeds,
  WI flow-through, JOA per the Phase 7 order. Also route Desk Map Add Root
  through the validated engine op (DA-M2 / LLA-H03).
- Documents toward professional grade, in this order: document audit events on
  the existing hash-chain pattern (chain of custody + tombstoned deletes);
  registry Upload button + dedup-on-ingest by content hash; wire the dormant
  deterministic packet ZIP (`buildAttorneyPacketArchive`) into the packet
  preview; THEN the three-pane workflow (folders tree, sortable virtualized
  list, persistent preview rail). Bates stamping happens at packet export,
  never on originals.
- Audit Sheet export — printable per-tract derivation sheets built from the
  existing FormulaTooltip `FormulaContent` structures; brief at
  `docs/archive/prompts/audit-sheet-export-brief.md`.
- Curative upgrade (Part 2 §2): open Critical/High issues become transfer-order
  hold reasons + Desk Map warning-dot inputs (DA2-C2, golden-safe); then the
  structural model — requirement numbers, opinion document link, multi-tract
  scope, curative-instrument/evidence document links (DA2-C1, design-first);
  printable requirement report via the Audit-Sheet pattern (DA2-C3); dirty-form
  guard (DA2-C4).
- Flowchart F-Phase 2/3 (Part 2 §3): print-renderer registry for new element
  kinds, edge labels, copy/paste, z-order, frames-as-pages via React Flow
  groups, image nodes routed through the hashed document vault, virtualization
  for 1k+ node trees. Print goldens per new element kind.
- ArcGIS interchange increments (Part 2 §4): hash map assets (DA2-M2); export
  per-tract status/decimal attributes as CSV/GeoJSON keyed `LAND_TRACT_ID` for
  ArcGIS Pro joins (DA2-M3); GeoJSON feature→tract matcher writing the existing
  `ExternalRef` GlobalID hooks (DA2-M4); then bulk-import the Raven Forest
  layer-attached lease PDFs into the vault (after Part 1 DA-H6/H7 land).
- RRC dataset ingestion, staged by workflow value (Part 2 §6): real-excerpt
  goldens for the three live decoders first (DA2-X1); then nightly permits
  w/ lat-long → production query dump (CSV) → statewide API (.dbf parser) →
  P-5/P-4 EBCDIC pilot (CP037 table + byte framing + zoned/packed numerics) →
  district ledgers; one shared streaming/worker/persisted-rows lane sized for
  multi-hundred-MB files; shapefiles route through the GIS lane, not a parser.
- Federal register fields, reference-only ahead of the Phase 2 gate
  (Part 2 §5): persist the lease-document fields (royalty/bonus/rental) and
  stipulations/COAs (DA2-FED1/2), rental tickler schedule, lease↔Unit-CA
  membership links, serial validation + NM-realistic seed (DA2-FED3/4/9).
  Phase 2 math design doc anchored on the real 60k-acre CA documents, with
  worked examples from the research supplement as its golden fixtures.
- Aesthetics consolidation ("lean professional", audit §5): fix the broken
  token references (DA-U1), add the two missing tokens, one shared
  Button/focus/radius standard, numeric typography rule (mono + tabular
  figures for every derived decimal), one pill/tab component, table kit,
  skeleton loading states, SVG icon module.
- AI deepening: deterministic math tools the model must call instead of doing
  fraction arithmetic in prose (`computeOwnerUnitDecimal`, `explainTractBurdens`,
  `traceChain`); origin/provenance threading into the title ledger (DA-M3);
  remarks length cap in hosted-full context; trim chat history to the proxy's
  50-message cap; then exact/keyword retrieval over records with the existing
  `verifyCitationSupport` gate wired into the panel before any document Q&A.
- Maintainability: extract LeaseholdView (4,601 lines) and AttachLeaseModal
  into siblings beside their math (DA-U3); delete dead exports
  (`readOnlyLandroidTools`, `rootOwnershipTotal`, unused `display()`).
- Storage UX: project-picker/multi-workspace index polish; per-view edit-control
  disabling for read-only tabs after the fence work lands.
- Expand entity document links beyond Desk Map nodes (owners, leases, curative,
  research) once DA-H6's full-workspace export makes them round-trip-safe.
- Import-manifest previews for large document sources; persistent import ledger
  for staged spreadsheet rows.
- Local OCR/text extraction after the record foundation; AI document Q&A stays
  disabled until the CitationVerifier is wired through the UI path.
- Title-opinion-as-root / `SourceAttestation` workflows after the document
  vault and import-session foundations are reviewed.
- Keep LANDroid hosted-web/PWA first; native shells stay deferred.

## Later

- Evaluate SQLite WASM in OPFS, cloud object storage, and Tauri 2 only at
  documented decision gates; do not make them defaults.
- Backend expansion beyond the Phase 0.75 spine only on a hard trigger
  (durable storage, sync, OCR jobs, search, sharing) — never a SaaS rewrite
  that removes local project semantics. The hosted AI proxy and spine already
  exist and stay minimal.
- Federal/private Phase 2 math only after the reference workspace and source
  packet workflow are stable enough for that gate.
- Template-driven `.docx` communications; universal Cmd+K search + inline
  "Ask AI about this" (search problem first, AI second).
- Deeper RRC decoder coverage only for workflow-proven file families.

## Not Planned Unless Explicitly Requested

- Tribal lease math.
- Full federal/BLM calculation engine during the current Texas baseline.
- Rewriting the app architecture for its own sake.
- Broad parser support for every legacy RRC format before the high-value paths
  prove useful.
