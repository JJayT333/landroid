# Phase 5 — Document/PDF Persistence Refactor

Companion to `docs/adr/0004-multi-doc-per-entity-persistence.md`. This doc
captures the implementation plan, schema shape, phase order, validation, and
the depth-range ride-along.

## Implementation Status

Implemented on `claude/phase-5-document-refactor-2026-05-15`, targeting
`codex/hosted-hardening-2026-05-14`. Phases A-C delivered the v8 document
tables, node attachment summaries, workspace-store actions, UI chips, modal
attachments section, v7/v8 `.landroid` handling, and post-v8 backup hook.
Phases D-E added realistic multi-document Raven Forest seed data and restored
the deferred Playwright workflows against the v8 schema. Phase F is the docs
rail that keeps this file, ADR 0004, the manual, testing, security, changelog,
and continuation handoff aligned.

## Goal

Any node can carry zero, one, or many document attachments, each independently
named, clickable, type-tagged, and round-trippable through `.landroid`
import/export. PDF chips on Desk Map cards show one chip per document, all
clickable. Schema is forward-compatible with future owner-side, lease-side,
curative, and research document attachments — no further migration needed
when those surfaces land.

## Strict Non-Goals

The following do **not** ship in this PR. If any of them creeps in, stop and
split:

- Content-hash deduplication logic (hash is stored; dedup is deferred).
- Owner-side, lease-side, curative, or research attachment UI (schema
  supports it; UI does not surface it this pass).
- AI tool integration with documents.
- Document search, OCR, or text extraction.
- Hosted backend changes (S3 / Lambda / DynamoDB).
- Non-PDF MIME types.
- Depth-severance math, UI, or fixture scenarios.

## Defaults (Locked In)

| # | Decision | Value |
| --- | --- | --- |
| 1 | Hosted-mode blocking on `saveDoc` / `deleteDoc` / `renameDoc` / `attachDocToEntity` / `detachDocFromEntity` | Block from day one (`HOSTED_BLOCKED_TOOL_NAMES`) when those tools are introduced. Phase 5 added no AI doc-mutating tools. |
| 2 | `kind` enum tagging on every attachment | `deed \| lease \| obit \| affidavit \| probate \| related \| other`. |
| 3 | Owner-side doc UI unification | Deferred. Schema supports `entityKind: 'owner'`; no UI this pass. |
| 4 | Chip overflow limit on Desk Map cards | 4 visible + `+N more` inline expand. |
| 5 | Auto-export v7 `.landroid` safety copy | Yes — one-shot post-v8-open backup hook for workspaces that had legacy PDFs. |

## Schema

### New table: `documents`

| Field | Type | Notes |
| --- | --- | --- |
| `docId` | string (UUID) | Primary key. `crypto.randomUUID()`. |
| `workspaceId` | string | Indexed. Fixes audit F5 (workspace-scoped storage). |
| `fileName` | string | User-visible. |
| `mimeType` | string | `application/pdf` for now. |
| `byteLength` | number | For future quota / display. |
| `contentHash` | string | sha-256 of blob. Set, but dedup logic deferred. |
| `blob` | Blob | The file. |
| `kind` | enum | `deed \| lease \| obit \| affidavit \| probate \| related \| other`. |
| `createdAt` | ISO string | |
| `updatedAt` | ISO string | |

Dexie index string:
`docId, workspaceId, contentHash, [workspaceId+kind], [workspaceId+createdAt]`.

### New table: `document_attachments`

| Field | Type | Notes |
| --- | --- | --- |
| `attachmentId` | string (UUID) | Primary key. |
| `docId` | string | Indexed. FK to `documents`. |
| `entityKind` | enum | `node \| owner \| lease \| curative \| research`. |
| `entityId` | string | Indexed. |
| `position` | number | Display order within entity (chip ordering). |
| `createdAt` | ISO string | |

Dexie index string:
`attachmentId, docId, [entityKind+entityId], [docId+entityKind+entityId]`.

This pass only writes `entityKind: 'node'` rows.

### `OwnershipNode` change

- Drop `hasDoc: boolean` and `docFileName: string`
  ([src/types/node.ts:66-67](../src/types/node.ts)).
- Add `attachments: { docId: string; attachmentId: string; fileName: string; kind: string }[]` —
  denormalized for fast chip render. Source of truth remains Dexie.
- `createBlankNode` initializes `attachments: []`.
- `normalizeOwnershipNode` migrates legacy `hasDoc/docFileName` rows by
  reading the new Dexie tables (or leaving `attachments` empty if the Dexie
  migration has not yet run — it will fill in on first read).

## Phase Order

### Phase A — Schema & storage (~1 day, riskiest)

1. Dexie version bump (v7 → v8). Add `documents` and `document_attachments`
   tables alongside the existing `pdfs` (which stays read-only).
2. Auto-export hook: after v8 open, trigger one v7-shape `.landroid` download
   per workspace that had legacy PDFs so a rollback path exists.
3. Migration: for every `pdfs` row, generate a `docId`, write a `documents`
   row with `kind: 'other'` (best default with no source signal),
   `contentHash` computed, and a `document_attachments` row with
   `entityKind: 'node'`, `position: 0`. Set `createdAt` from the old row.
4. New `src/storage/document-store.ts` with:
   - `listDocsForEntity(entityKind, entityId)`
   - `listDocsForNode(nodeId)` (convenience over the above)
   - `saveDoc(file, kind, workspaceId)`
   - `attachDocToEntity(docId, entityKind, entityId)`
   - `detachDocFromEntity(attachmentId)`
   - `renameDoc(docId, newFileName)`
   - `deleteDoc(docId)` (cascades to attachments)
   - `getDocBlob(docId)`
   - `getDocMeta(docId)`
   - `reorderAttachments(entityKind, entityId, orderedAttachmentIds)`
5. Retire `src/storage/pdf-store.ts` once all callers use `document-store`.
6. `src/types/node.ts`: drop `hasDoc` / `docFileName`, add `attachments[]`.
   Update `createBlankNode` and `normalizeOwnershipNode`.
7. Apply the depth-range hook (§ Depth-Range Schema Hook below) inside this
   phase, in the same migration pass.

### Phase B — UI (~0.5 day)

- Rename `DeskMapDocumentBadge` to `DeskMapDocumentChips`. Render a row of
  chips, 4 visible + `+N more` inline expansion. Each chip click opens the
  corresponding doc in `PdfViewerModal`.
- `PdfViewerModal` keys on `docId` instead of `nodeId`.
- `DeskMapView.handleViewPdf` becomes `handleViewDoc(docId)`;
  `pdfViewNodeId` state becomes `pdfViewDocId`.
- The node edit modal gets a shared attachments section: list + add + rename +
  remove + reorder. The same UI primitive is reusable when owner/curative/
  research surfaces light up.
- If Phase 6 modal focus-trap is cheap on the modals touched in this phase,
  do it here so the modals are only edited once.

### Phase C — Workspace store + persistence (~1 day)

- `workspace-store.ts`: add `attachDoc`, `detachDoc`, `renameDoc`,
  `reorderAttachments` actions. Keep `attachments[]` denorm in sync with
  Dexie writes.
- `landroid-export.ts` → bump to **v8**. Serialize `documents` (blob as
  base64) and `document_attachments`. Include depth-range fields.
- `landroid-import.ts` → dispatch on `version`:
  - v7 → migrate inline to v8 (synthesize `docId`s, generate
    `document_attachments` rows with `entityKind: 'node'`, `position: 0`).
  - v8 → load directly.
  - Closed the old `CONTINUATION-PROMPT.md` gap where legacy `.landroid`
    handling lacked version-aware import dispatch.

### Phase D — Seed migration (~0.5 day)

- Update `src/storage/seed-test-data.ts` so Combinatorial — Raven Forest
  seeds through the v8 workspace-store document actions and writes
  `attachments[]`.
- Add realistic Texas multi-document examples on representative conveying
  nodes: deed + obituary + affidavit of heirship.

### Phase E — Tests (interleaved, ~0.5 day net)

- Dexie migration unit test: v7 `pdfs` → v8 `documents` +
  `document_attachments`, including the auto-export side effect.
- `document-store` unit tests: multi-doc add / list / delete / rename /
  attach-many / detach-one / reorder, ordering stability, denorm sync,
  cascade-on-delete.
- `.landroid` v7 import round-trip test against a captured v7 fixture;
  verify v8 shape after import.
- `.landroid` v8 round-trip test.
- New Playwright coverage: click the seeded deed / obituary / affidavit chips
  by `attachmentId` and verify each opens the right PDF in `PdfViewerModal`.
- Existing Playwright `combinatorial demo loads with desk-map cards and PDF
  chips` is retargeted to `DeskMapDocumentChips`.
- Previously deferred `.landroid` round-trip, branch-scoped lease delete,
  curative linkage, and research linkage workflows are active against v8.
- Depth-range tests: see § Depth-Range Schema Hook acceptance below.

### Phase F — Docs (~0.25 day)

- Keep this doc, ADR 0004, `CHANGELOG.md`, `USER_MANUAL.md` (Desk Map PDF
  chip section), `SECURITY.md`, `TESTING.md`, and `CONTINUATION-PROMPT.md`
  aligned with the implemented v8 behavior.

## Depth-Range Schema Hook

Optional `depthRange` field added to every record class where ownership math
reads. Default value `'all_depths'`. No UI, no math change. Same precedent as
`LeaseJurisdiction` at [src/types/owner.ts:42-104](../src/types/owner.ts).

### Type shape

```ts
// Minimal today, expand when Phase 8 depth-severance feature ships.
type DepthRange = 'all_depths';
```

The object shape `{ topFt; bottomFt }` is **not** part of the type today.
Adding it before the math exists invites two-ways-to-say-the-same-thing
ambiguity. Phase 8 expands the union when the real feature lands.

### Records that get the field

- Every `OwnershipNode` (conveyance, mineral, NPRI carve, related, lease)
  at [src/types/node.ts:30-86](../src/types/node.ts).
- Every `Lease` at [src/types/owner.ts:136-156](../src/types/owner.ts).
- Every `LeaseholdOrri` at [src/types/leasehold.ts:46-58](../src/types/leasehold.ts).
- Every `LeaseholdAssignment` (WI assignment) at
  [src/types/leasehold.ts:60-72](../src/types/leasehold.ts).

If only conveyances and leases get the field now, Phase 8 needs a second
migration for NPRI / ORRI / WI. Same cost to add now (one optional default-
value field per type). Lock the door open everywhere math reads.

### Behavior

- Default value applied at record creation.
- Phase 5 Dexie migration writes `'all_depths'` to every existing record in
  those four classes, in the same pass as the document migration.
- Validator rejects any value other than `'all_depths'` for math purposes.
- Import-time policy: a `.landroid` file carrying a non-`'all_depths'` value
  (e.g., from a future Phase 8+ build) is **normalized to `'all_depths'`
  for math, preserved raw in workspace metadata, and surfaced as a
  leasehold-style warning** ("This file uses depth severance, which is not
  supported by this build. Math has been computed assuming all-depth
  interests."). No data loss, no hard block, matches existing Phase 3
  warning pattern.
- `.landroid` v8 export includes the field as `'all_depths'` for every
  record.
- One short comment near each math entry point: *"depth severance is not
  yet modeled; this function assumes 'all_depths' on every record."* Math
  entry points: `src/engine/math-engine.ts`,
  `src/components/leasehold/leasehold-summary.ts`,
  `src/components/deskmap/deskmap-coverage.ts`.

### Acceptance criteria

- Existing workspaces load with `depthRange: 'all_depths'` on every
  conveyance, lease, NPRI, ORRI, WI assignment.
- New records get `depthRange: 'all_depths'` on creation.
- `.landroid` v8 round-trip preserves the field.
- Non-`'all_depths'` values from external imports are normalized + warned,
  not silently coerced and not hard-blocked.
- No visible UI changes.
- No changes to calculated ownership, leasehold, NPRI, ORRI, WI, or
  transfer-order outputs.
- Defensive unit tests prove malformed/future depth values cannot reach
  math.

### Hard guardrail

If a single change required by the depth hook touches the math engine
(`src/engine/math-engine.ts`), `src/components/leasehold/leasehold-summary.ts`,
the coverage allocator (`src/components/deskmap/deskmap-coverage.ts`), the
fixture builder (`src/storage/seed-test-data.ts`) beyond a defensive
comment, or any view file under `src/views/` beyond a type import — **stop
and split this into a Phase 8 dedicated depth-severance project.**

## PR Sequence

This Phase 5 branch now includes the document refactor, the small
multi-document seed migration, and the retargeted Playwright workflows. Larger
future fixture redesigns should still land as their own reviewable projects.

## Validation Per Phase

After each phase:

- `npm run lint`
- `npm test` — full suite
- `npm run build`
- `npm run test:e2e`
- `npx tsc --noEmit` in `backend/ai-proxy` (only if backend touched)
- `git diff --check`

Manual smoke after Phase B and Phase C: load Combinatorial — Raven Forest,
click every PDF chip on a representative sample of conveyance / lease /
NPRI cards, verify the modal opens with the right PDF. Re-export
`.landroid`, re-import into a fresh workspace, verify PDFs come back
attached.

## Risk Callouts

- **Dexie migration on real laptops.** Lowest risk now, grows with every
  day. Auto-`.landroid` export before upgrade mitigates.
- **v7 `.landroid` files in the wild** are a permanent compatibility
  surface — not a one-time migration. Import must keep dispatching on
  `version` indefinitely.
- **Codex concurrency on the same branch.** Confirmed clear before Phase
  A; re-confirm if a checkpoint happens before any phase.
- **Playwright coverage drift.** The restored workflows now guard v8 document
  chips, export/import, branch-scoped lease delete, curative linkage, and
  research linkage. Keep selectors tied to stable semantics such as
  `attachmentId`.
- **AI hosted read-only filtering** — the new doc-mutating tools must go
  into `HOSTED_BLOCKED_TOOL_NAMES` from day one (audit F2 lineage).
- **Phase 6 modal focus-trap.** Consolidating into Phase 5 modal edits is
  cheap but optional. If it stretches the modal phase past 0.5 day, drop
  it and run Phase 6 as its own pass.

## Timeline

~4 working days end-to-end, plus 0.5 day buffer for the Dexie migration
cliff. Depth-range hook adds ~0.5 day inside Phase A and C. Total: ~5
working days.

## Sign-Off Checklist

- [x] Codex file ownership confirmed clear on the active branch.
- [x] Five defaults confirmed as written.
- [x] Depth-range hook scope confirmed as written.
- [x] ADR 0004 reviewed and signed off.
- [x] This design doc reviewed and signed off.
- [x] Phase A began only after both sign-offs.

## Final Instruction

Historical note: implementation proceeded after sign-off on this design doc and
ADR 0004. Future follow-ons should continue to use AGENTS.md and
PROJECT_CONTEXT.md as the operating baseline.
