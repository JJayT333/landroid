# LANDroid Review / ArcGIS Handoff Prompt

Paste this into the next checker or ArcGIS-focused agent.

```
Resume in /Users/abstractmapping/projects/landroid. Read AGENTS.md,
PROJECT_CONTEXT.md, docs/README.md, CONTINUATION-PROMPT.md,
docs/gis-data-catalog.md, docs/adr/0004-multi-doc-per-entity-persistence.md,
and docs/phase-5-document-refactor.md before making changes.

Use branch codex/phase-5-doc-storage-wrap-2026-05-15. It was created from
claude/phase-5-document-refactor-2026-05-15, which descends from
codex/hosted-hardening-2026-05-14. Do not branch from main. PR target remains
codex/hosted-hardening-2026-05-14.

What just landed:
- Phase 5 document/PDF persistence foundation: Dexie v8 documents and
  document_attachments, stable docId and attachmentId, content hashes, v8
  .landroid export/import, v7 import migration, one-shot v7 PDF backup hook,
  and node.attachments[] summaries.
- Desk Map document visibility: multi-PDF chips on title/lease/related cards,
  chip opening by attachmentId, and the shared Attached Documents section in the
  node edit modal for add/open/rename/remove/reorder.
- Raven Forest seed now includes realistic multi-document examples on selected
  conveying nodes, including deed + obituary + affidavit of heirship patterns.
- Phase 5 Playwright coverage is restored: chip-to-PDF modal, v8 .landroid
  round-trip, branch-scoped lease delete, curative linkage, research linkage,
  Federal Leasing, and Research home coverage.
- Phase 6 cleanup: shared confirmation/alert modal, typed confirmation for
  demo/.landroid/CSV workspace replacement, modal focus trap, form labels, tab
  ARIA, crypto.randomUUID workspace IDs, hosted null-sub persistence guard, and
  the AI settings test warning cleanup.
- GIS reference inventory: docs/gis-data-catalog.md documents the local Raven
  Forest ArcGIS package, high-value layers, attachment tables, duplicate
  stacked-interest source modeling, projections, and known geometry issues.

Validation already run:
- npm run lint
- npm test
- npm run build
- npm run test:e2e
- git diff --check

Known validation noise:
- npm test intentionally logs one post-v8 backup error-path message.
- build has existing Vite dynamic-import/chunk-size warnings.
- Playwright logs NO_COLOR/FORCE_COLOR warnings.

ArcGIS scope guidance:
- Good next Arc step: add a canonical layer map/design note that chooses source
  layers, stable ID fields, key attributes, attachment relationship tables, and
  import priority.
- Preserve the current guardrails: Texas-only active math; federal/private
  Federal Leasing and Research records stay reference-only until the explicit
  math phase opens.
- Do not import the 4 GB ArcGIS package or copy raw shapefiles/geodatabases into
  the repo. Keep raw GIS material local-only.
- Do not build ArcGIS REST sync, OCR/AI extraction, automatic title updates from
  documents, or federal/private math unless explicitly asked.
- Do not bulk-import ArcGIS BLOB attachments by default. If an import design is
  proposed, use selected/linkable documents and LANDroid document IDs, not a
  blind attachment dump.
- The source map intentionally used stacked duplicate polygons for one
  owner/interest row per tract. LANDroid's likely target shape is normalized:
  one tract geometry, many owner/interest rows, and documents linked to the
  specific tract or interest row they support.

Suggested review questions:
- Are Desk Map document chips and v8 .landroid persistence sufficient for local
  document-backed title review?
- Which ArcGIS layer should be canonical for federal leases, private leases,
  unleased federal tracts, parcels, surveys, and wells?
- What stable identifiers should LANDroid preserve for future ArcGIS click-back
  and export, remembering that ArcGIS ObjectID is convenience-only?
- Which GIS attachment tables are high-value enough to support first, and how
  should their PDFs map onto LANDroid documents/entities?
- What import warnings should be surfaced for invalid geometries, duplicated
  stacked interests, missing IDs, mixed expiration values, and truncated
  shapefile fields?
```
