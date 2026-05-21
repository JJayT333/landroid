# LANDroid Roadmap

This is a short priority map. Detailed remediation work lives in `PATCH_PLAN.md`;
session handoff lives in `CONTINUATION-PROMPT.md`.

## Now

- Treat `docs/rebuild-plan.md` as the planning source of truth for any rebuild
  work: current behavior inventory first, then project record graph, document
  vault, source attestations, import/action layers, and only then workflow
  cutovers. Preserve dual decimal plus fraction display as a rebuild contract.
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
  packaging, CSV load file, and stricter packet-readiness checks.
- Expand entity document links beyond Desk Map nodes: owners, leases, curative
  issues, and research records.
- Add import-manifest previews for large document sources such as ArcGIS
  attachment tables, Dropbox/local folders, and selected source packets.
- Design OCR/text indexing after the document registry exists; AI document
  query should return citations and stay read-only by default.
- Execute Phase 0/1 of `DEPLOYMENT_PLAN.md`: hosted frontend, backend boundary,
  auth, cloud save path, and server-side AI proxy before any broad internet
  exposure.
- Design the project picker landing page after adding a real multi-workspace
  saved-project index instead of the current single autosave slot.
- Promote unit metadata to first-class records if future units need separate
  operator/effective-date settings beyond current Desk Map unit tags.
- Continue polishing AI mutation approval/proposal UX without losing the user's
  desired single-user local workflow speed.
- Add a persistent import ledger for staged spreadsheet rows.
- Add title-opinion-as-root and other `SourceAttestation` starting-source
  workflows after the document vault and import-session foundations are ready.

## Later

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
