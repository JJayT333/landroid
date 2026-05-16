# Document Database Roadmap

Status: Phase 7A registry MVP implemented on
`codex/document-registry-build-2026-05-16`; Phase 7A.5 reconciliation is
implemented on `codex/document-storage-reconciliation-2026-05-16`; Phase 7A.6
packet ZIP export is in progress on `codex/document-packet-export-2026-05-16`.
Later OCR, import manifests, Dropbox/API mapping, ArcGIS import, and AI query
remain future phases.

## Decision

LANDroid should grow into the queryable document registry. Dropbox, a local
folder, or later cloud object storage can still be a raw-file vault, but it
should not be the only system of record for title documents.

Dropbox is good at sync, backup, and manual file browsing. It is weak at the
things LANDroid needs to know:

- which tract, owner, lease, curative issue, research record, or GIS feature a
  document supports
- whether two uploaded PDFs are duplicates
- what instrument type, recording reference, parties, dates, county, and source
  package belong to the document
- whether OCR/text extraction is complete, stale, reviewed, or failed
- which exact page or passage supports an AI answer

The durable target is a hybrid:

- raw document bytes live in a controlled storage backend or user-selected
  file vault
- LANDroid stores stable document IDs, hashes, metadata, entity links, OCR
  text/index records, extraction status, and citations
- AI search reads from the indexed text and returns cited answers; it does not
  silently mutate title, math, or documents

## Current Foundation

Phase 5 already created the right base:

- Dexie v8 `documents`
- Dexie v8 `document_attachments`
- stable `docId` and `attachmentId`
- SHA-256 `contentHash`
- document `kind`
- workspace scoping
- `.landroid` v8 import/export
- multi-document Desk Map chips
- shared attachment UI in the node edit modal

Phase 7A added the first document-registry surface:

- `Documents` navigation view
- saved-view filters for document areas and review states
- editable registry metadata on `DocumentRecord`
- linked-node display from `document_attachments`
- duplicate surfacing from `contentHash`
- packet manifest preview from the current filter, selected/highlighted rows,
  or the `Runsheet / Mineral Title` saved view

Phase 7A.5 reconciles the Codex MVP with the reference schema direction:

- canonical `DocumentRecord` metadata fields are `area`, `sourceRef`, and
  `parties`
- legacy Phase 7A field names still import and read correctly:
  `documentArea`, `sourceReference`, `effectiveDate`, `grantor`, and `grantee`
- `externalRefs` preserve supported external IDs, URLs, and file paths as
  metadata hooks only
- `Needs OCR` is honest: only documents explicitly marked `not_started` or
  `failed` are counted as needing OCR
- the registry uses a left saved-view rail and a richer packet preview
- Phase 7A.6 adds a local packet ZIP export with native stored files,
  `manifest.json`, and `manifest.csv`; missing stored blobs fail the export
  rather than producing an incomplete packet

This is enough for local document-backed title review before OCR. It is still
not the durable backend or full text/AI document database.

## Target Model

### Source Document

Each document should eventually carry:

- stable `docId`
- workspace/project scope
- original filename and display title
- MIME type, byte length, page count, content hash, and storage location
- document kind / instrument type
- county, recording reference, book/volume/page, instrument number, and
  recording date when known
- effective date or execution date when known
- grantor/grantee/lessor/lessee/record-title/operating-rights parties when
  known
- source package references such as ArcGIS layer, GlobalID, ObjectID
  convenience value, attachment table, or Dropbox/local path
- OCR/index status
- extraction/review status only after the review workflow is designed

### Entity Links

The existing `document_attachments` table is the right shape for attaching a
single document to multiple LANDroid entities. The UI should expand in phases:

- nodes first, already implemented
- owner records
- lease records
- curative issues
- research records
- future GIS tract / interest rows after the canonical Arc layer map exists

The important rule is that the same document should not be copied just because
it supports more than one thing. Link the same `docId` to more entities.

### Text And Search

OCR/search should be additive:

- keep the original document immutable
- store extracted text separately from the binary document
- track OCR engine, run date, status, warnings, and page count
- support keyword/filter search before semantic AI search
- make AI answers cite document IDs and page/passage references

## Dropbox Position

Dropbox can remain useful as a vault or sync layer, especially while the app is
local-first. It should be treated as external storage, not as the database.

A Dropbox-only structure would still leave LANDroid unable to reliably answer:

- "Show every document supporting this tract."
- "Find every affidavit tied to this owner."
- "Which documents mention this lease serial, recording number, or party?"
- "Which PDFs are duplicates of the same recorded instrument?"
- "Which AI answer came from which source page?"

If Dropbox integration happens later, LANDroid should store Dropbox file IDs or
paths as `externalRefs`, then index the selected files into the document
registry. Do not make title review depend on folder names alone.

## Phase Plan

### Phase 7A — Document Registry

Goal: make documents first-class records before OCR.

In scope:

- document library/index view — implemented as `Documents`
- metadata editing for instrument type, recording fields, dates, county,
  parties, notes, and source refs — implemented locally with canonical
  `area`, `sourceRef`, and `parties` names
- duplicate surfacing from `contentHash` — implemented
- filters by document area, kind, node link, tract, date, text, missing
  metadata, unlinked docs, duplicate docs, and OCR-needed marker — implemented
- packet manifest preview — implemented with JSON manifest download; Phase
  7A.5 adds unique hash, warning, area, and source-ref preview detail; Phase
  7A.6 adds native-file ZIP export with JSON/CSV manifests, but not PDF assembly
  or saved packet sets
- no OCR or AI mutation

### Phase 7B — Entity-Link Expansion

Goal: connect the registry to the rest of the app.

In scope:

- attach existing documents to owners, leases, curative issues, and research
  records
- show linked documents on those surfaces
- add `SourceCitation[]` only when the first real consumer needs page/passage
  support

### Phase 7C — Import Manifests

Goal: prepare for large outside sources without blindly importing everything.

In scope:

- manifest format for ArcGIS attachment tables, Dropbox/local folders, and
  selected source packets
- preview counts, sizes, duplicate hashes, missing metadata, and rejected file
  warnings before import
- selected import/link flow, not bulk BLOB ingestion

### Phase 7D — OCR/Text Index

Goal: make documents searchable by text.

In scope:

- OCR/text extraction status table
- page-level text storage
- keyword search and metadata filters
- review queue for failed/stale OCR

Out of scope until explicitly designed:

- automatic title updates from OCR
- AI-created ownership changes
- cloud OCR of sensitive files without an explicit provider/security decision

### Phase 7E — AI Document Query

Goal: ask questions across the indexed corpus with citations.

In scope:

- retrieval over document metadata and OCR text
- cited answers that point back to `docId`, page, and entity link
- read-only AI behavior by default

Out of scope:

- AI document mutation in hosted mode unless the tool is blocked from day one
  and an approval workflow exists
- attorney review packets, comments/redlines, or portal workflows

## Guardrails

- Keep Texas-only active math.
- Do not let federal/private reference documents affect Texas math until that
  explicit phase opens.
- Do not bulk-import the Raven Forest ArcGIS package or its attachment BLOBs by
  default.
- Do not send OCR text or full documents to cloud AI without an explicit
  security/provider decision.
- Keep document-mutating AI tools out of hosted read-only mode from the first
  commit that introduces them.
