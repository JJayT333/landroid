# ADR 0004: Multi-Document Per Entity Persistence

## Status

Accepted and implemented for Phase 5 on
`claude/phase-5-document-refactor-2026-05-15`, targeting
`codex/hosted-hardening-2026-05-14`.

## Context

LANDroid's PDF attachment layer was built for a single-PDF-per-node workflow.
The Dexie `pdfs` table is keyed by `nodeId` ([src/storage/db.ts:60-166](../../src/storage/db.ts)),
and `OwnershipNode` carries denormalized `hasDoc` / `docFileName` fields
([src/types/node.ts:66-67](../../src/types/node.ts)). A node cannot hold more
than one document. There is no workspace scoping on PDF rows, no document
identity beyond `nodeId`, no type tag, and no schema room for the same
document to attach to a lease, owner, curative item, or research record in
the future.

Real-world Texas title work routinely attaches multiple documents to a single
conveying node: a deed, an obituary, an affidavit of heirship, a probate
order, and a related curative letter can all sit on the same chain step. The
audit (`docs/archive/audits/AUDIT_REPORT_CODEX_FULL_2026-05-14.md`, finding
F5) called out the node-only PDF key as a persistence risk before
durable-backend work.

The Raven Forest fixture and Playwright workflows now exercise
multi-document coverage on representative conveying nodes. This ADR remains
the source of truth for that persistence shape.

## Decision

Persist documents and attachments separately. Use a polymorphic join so the
schema covers all future attachment targets without another migration.

1. New Dexie table `documents` — one row per uploaded file, with workspace
   scoping, content hash, byte length, MIME type, original filename, `kind`
   enum, and the blob.
2. New Dexie table `document_attachments` — polymorphic join keyed by
   `entityKind` (`node | owner | lease | curative | research`) and `entityId`,
   ordered by `position` for chip ordering. This pass only writes rows with
   `entityKind: 'node'`; the other kinds are reserved for follow-on UI without
   migration.
3. `OwnershipNode` drops `hasDoc` / `docFileName`. A small denormalized
   `attachments: { docId; attachmentId; fileName; kind }[]` lives on the node
   for fast Desk Map chip render; the source of truth remains Dexie.
4. `.landroid` export bumps to **v8**. Import dispatches on `version`:
   v7 migrates inline (synthesize `docId`s, generate node attachments at
   `position: 0`); v8 loads directly. This also closes the open
   `CONTINUATION-PROMPT.md` gap that v7 export writes a version field but
   import does not dispatch on it.
5. Dexie migration synthesizes a `docId` for every existing `pdfs` row and
   writes `documents` plus `document_attachments`. A one-shot post-open backup
   hook downloads v7-shape `.landroid` files for workspaces that had legacy
   PDFs. The old `pdfs` table is retained read-only for one rollback version,
   then removed in a follow-on schema version.
6. Hosted-mode AI tools that mutate document state (`saveDoc`, `deleteDoc`,
   `renameDoc`, `attachDocToEntity`, `detachDocFromEntity`) join
   `HOSTED_BLOCKED_TOOL_NAMES` from day one if and when those tools are
   introduced. Phase 5 added no AI document-mutating tools.
7. Content-hash dedup logic is **not** implemented this pass. `contentHash`
   is computed and stored so dedup can land later without another migration.

A ride-along depth-range schema hook is added inside the same Phase 5
implementation. See `docs/phase-5-document-refactor.md` § Depth-Range Schema
Hook. It is type-shape only — no math, no UI, no fixture content — and
follows the `LeaseJurisdiction` precedent at
[src/types/owner.ts:42-104](../../src/types/owner.ts).

## Consequences

**Schema.** Two new Dexie tables, a node-shape change (drop two fields, add
one denormalized array), one new `.landroid` schema version (v8) with v7
inline migration. The old `pdfs` table sticks around read-only for one
version to preserve a rollback path.

**Registry metadata names.** Phase 7A.5 keeps v8 as the persisted schema
version but standardizes registry metadata on `area`, `sourceRef`, and
`parties`. Import/read paths remain compatible with the first Phase 7A names
(`documentArea`, `sourceReference`, `effectiveDate`, `grantor`, and `grantee`)
so existing `.landroid` files and IndexedDB rows continue to load. `externalRefs`
remain optional metadata hooks and now preserve supported file-path references.
This does not introduce OCR, Dropbox sync, ArcGIS import, AI document query, or
title/math mutation from documents.

**UI.** Desk Map badge became a row of chips (4 visible + `+N more`
overflow). The node edit modal uses the shared `AttachmentsSection` for add,
open, rename, remove, and reorder. `PdfViewerModal` keys on `docId` instead of
`nodeId`. The shared modal focus trap landed with these modal edits.

**Round-trip compatibility.** v7 `.landroid` files in the wild become a
permanent compatibility surface, not a one-time migration. Import must
keep dispatching on `version` indefinitely.

**Hosted safety.** The new doc-mutating tools must be in
`HOSTED_BLOCKED_TOOL_NAMES` from the first commit that introduces them, or
hosted read-only mode regresses (audit finding F2 lineage).

**Forward compatibility.** Owner-side, lease-side, curative, and research
document UI can be added later by writing `document_attachments` rows with
the appropriate `entityKind`. No further schema migration is required for
those surfaces. `OwnerDoc` ([src/types/owner.ts:185-197](../../src/types/owner.ts))
is intentionally **not** subsumed by `documents` in this pass; that
unification is a clean follow-on when the time comes.

**Out of scope (Phase 5).** Content-hash dedup logic, owner/lease/curative/
research attachment UI, AI tool integration with documents, document search /
OCR / text extraction, hosted backend changes, non-PDF MIME types, and
depth-severance math/UI/fixture content. The schema supports all of these;
this pass does not surface them.

## Alternatives Considered

- **Keep `pdfs` keyed by `nodeId`, add an array index.** Rejected. Does not
  fix workspace scoping (audit F5), does not enable attachment to other
  entity kinds, and still requires a migration when those land.
- **One table per entity kind (`node_documents`, `owner_documents`, …).**
  Rejected. Multiplies migration cost, splits the same blob across tables if
  a document attaches in multiple places, and harms `.landroid` round-trip
  shape.
- **Content-hash dedup at write time.** Deferred. Adds a write-path read,
  introduces a delete-coordination problem (which entity owns the blob when
  references go to zero), and is not load-bearing for the fixture refactor.
  Schema records `contentHash` so dedup is additive when needed.
- **Subsume `OwnerDoc` into `documents` in this PR.** Deferred. Doable via
  `entityKind: 'owner'`, but the migration surface area roughly doubles and
  there is no current UI need. Schema supports the future unification.
