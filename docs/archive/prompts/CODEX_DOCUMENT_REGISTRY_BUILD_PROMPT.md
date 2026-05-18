# Codex Prompt — LANDroid Document Registry Build

Resume in `/Users/abstractmapping/projects/landroid`.

Use branch `codex/document-registry-build-2026-05-16`, created from
`codex/document-database-roadmap-2026-05-16`. Do not branch from `main`.
PR target remains `codex/hosted-hardening-2026-05-14`.

Before coding, read:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `docs/README.md`
- `CONTINUATION-PROMPT.md`
- `docs/document-database-roadmap.md`
- `docs/adr/0004-multi-doc-per-entity-persistence.md`
- `docs/phase-5-document-refactor.md`
- `docs/gis-data-catalog.md`

## Goal

Build the first usable document-management surface for LANDroid. Treat the
current Runsheet/Documents discussion as the product direction:

- LANDroid becomes the queryable document registry and working evidence vault.
- Dropbox/local folders remain the master/raw vault options, but LANDroid keeps
  its own document copy plus structured metadata, entity links, hashes, and
  packet-export state.
- Runsheet is a saved/document-view lens over the registry, not a separate
  competing storage model.

## Research Patterns To Borrow

- M-Files: views are saved metadata searches; browsing views can feel like
  folders, but the document appears because metadata matches the view.
- SharePoint: libraries rely on metadata columns, filters, grouping, sorting,
  and configured views.
- iManage/legal DMS: matter/client/project context and metadata make documents
  searchable and governable.
- eDiscovery: exports include native files plus metadata/load files,
  extracted text, errors, and summaries.
- Dropbox: use stable file metadata such as file ID/revision/content hash for
  future mapping; do not depend on paths alone.

## Scope For This Branch

Build a pragmatic MVP inside the existing app:

1. Add a document registry view reachable from the existing navigation.
   Prefer a `Documents` tab or a clear `Runsheet` sub-view if that matches the
   existing layout better. Keep the UI dense, operational, and non-marketing.
2. Show one row per `DocumentRecord`, using the existing Dexie v8
   `documents` and `document_attachments` tables.
3. Add saved-view style filters:
   - All
   - Inbox / Needs review
   - Runsheet / Mineral Title
   - Leasehold
   - Curative
   - Research
   - GIS / Map Support
   - Federal Reference
   - Unlinked
   - Missing metadata
   - Duplicates
   - Needs OCR
4. Add document metadata editing with the smallest useful model. Good starting
   fields:
   - display title
   - document area
   - instrument type
   - county
   - instrument number
   - volume/page
   - effective date
   - recording date
   - grantor
   - grantee / lessor / lessee
   - notes
   - source reference
5. Show linked entities from `document_attachments`, at least node links now.
   Do not build owner/lease/curative/research attachment UI unless it stays
   small and naturally extends the existing store.
6. Surface duplicates by `contentHash`.
7. Add a packet-builder preview, not a full production-grade export system:
   - current filter
   - selected/highlighted rows
   - current runsheet/mineral-title view
   - show counts, total size, missing metadata warnings, and duplicate warnings
   - if implementing actual export is low-risk, export a ZIP or fallback
     package containing PDFs plus `manifest.csv` / `manifest.json`

## UX Direction

Make it feel like a run-flat document room:

- flat registry, many saved views
- compact table/list in the center
- right-side inspector for preview, metadata, links, duplicate/hash status, and
  packet inclusion
- document chips remain available in context elsewhere
- no card-heavy landing page
- no giant empty hero
- avoid visual overlap and keep row scanning fast

## Explicit Non-Goals

- No OCR implementation yet.
- No AI document query yet.
- No automatic title updates from documents.
- No Dropbox API integration yet; future Dropbox mapping can be represented as
  `externalRefs` or metadata only.
- No ArcGIS import or attachment BLOB import.
- No federal/private math.
- No edits to math-engine, leasehold summary math, or desk-map coverage logic.

## Acceptance Criteria

- A user can open the registry and understand all documents known to LANDroid.
- A user can filter document views so project/admin/GIS/federal/reference docs
  remain separate from mineral title/runsheet documents.
- A user can edit useful metadata without leaving the registry.
- A user can identify unlinked, duplicate, and missing-metadata documents.
- A user can select/highlight or filter a set of documents and see a packet
  preview suitable for a title-opinion export workflow.
- Existing Desk Map document chips and v8 `.landroid` import/export keep
  working.

## Validation

Run focused tests for changed code, then:

- `npm run lint`
- relevant `npm test -- ...`
- `npm run build`

Run Playwright only if the navigation or user-facing document flow is changed
enough to need browser coverage.

Update docs after behavior changes:

- `README.md`
- `USER_MANUAL.md`
- `TESTING.md`
- `CHANGELOG.md`
- `CONTINUATION-PROMPT.md`

At handoff, summarize:

- what model and UI you chose
- how Runsheet and Documents relate
- what works now
- what remains for OCR, Dropbox mapping, packet export hardening, and AI query

