# ADR 0004: Multi-Document Per Entity Persistence

## Status

Proposed for Phase 5 (document/PDF persistence refactor). Pending implementation
on `codex/hosted-hardening-2026-05-14` (or the next active hardening branch)
after design sign-off.

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
audit (`AUDIT_REPORT_CODEX_FULL_2026-05-14.md`, finding F5) called out the
node-only PDF key as a persistence risk before durable-backend work.

The fixture refactor (PRs 2 + 3 — the two-unit Raven Forest rebuild) is built
around heavy multi-document coverage. That fixture cannot land cleanly until
the schema supports multi-doc attachments. This ADR is therefore the design
gate for that follow-on work.

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
   `attachments: { docId; fileName; kind }[]` lives on the node for fast Desk
   Map badge render; the source of truth remains Dexie.
4. `.landroid` export bumps to **v8**. Import dispatches on `version`:
   v7 migrates inline (synthesize `docId`s, generate node attachments at
   `position: 0`); v8 loads directly. This also closes the open
   `CONTINUATION-PROMPT.md` gap that v7 export writes a version field but
   import does not dispatch on it.
5. Dexie migration synthesizes a `docId` for every existing `pdfs` row, writes
   `documents` and `document_attachments`, and triggers an auto-`.landroid`
   v7 export download as the first step of the upgrade. The old `pdfs` table
   is retained read-only for one rollback version, then removed in a follow-on
   schema version.
6. Hosted-mode AI tools that mutate document state (`saveDoc`, `deleteDoc`,
   `renameDoc`, `attachDocToEntity`, `detachDocFromEntity`) join
   `HOSTED_BLOCKED_TOOL_NAMES` from day one.
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

**UI.** Desk Map badge becomes a row of chips (4 visible + `+N more`
overflow). Node-edit, lease, and NPRI modals get an attachments section.
`PdfViewerModal` keys on `docId` instead of `nodeId`. Phase 6 modal
focus-trap work consolidates into these modal edits when it is cheap, to
avoid touching the same modals twice.

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
