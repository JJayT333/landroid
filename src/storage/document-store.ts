/**
 * Document CRUD for Phase 5 (see ADR 0004). Replaces the v7 single-PDF
 * `pdf-store.ts` surface (deleted in A4c). The v7 `pdfs` Dexie table is
 * kept read-only for one rollback version.
 *
 * Conventions:
 *   - Documents and attachments are written together when a doc is saved.
 *   - Attachment ordering is dense, 0-indexed, and reassigned on every
 *     mutation that affects an entity's list so callers never see gaps.
 *   - Deleting a doc cascades to its attachments. Deleting an attachment
 *     leaves the doc alone (it may be attached elsewhere later).
 *   - Hosted-mode AI tools that would mutate this store are blocked from
 *     day one via `HOSTED_BLOCKED_TOOL_NAMES`.
 */

import db from './db';
import { sha256HexOfBlob } from './blob-hash';
import {
  DEFAULT_DOCUMENT_KIND,
  isDocumentArea,
  normalizeDocumentKind,
  type DocumentArea,
  type DocumentAttachment,
  type DocumentEntityKind,
  type DocumentKind,
  type DocumentParties,
  type DocumentRecord,
} from '../types/document';

export type {
  DocumentAttachment,
  DocumentEntityKind,
  DocumentKind,
  DocumentRecord,
} from '../types/document';

/**
 * Fields the registry inspector can edit. `kind` is editable so a
 * migrated `'other'` row can be re-tagged. `parties` is shape-checked
 * but otherwise stored as supplied.
 */
export interface DocumentMetadataPatch {
  kind?: DocumentKind;
  area?: DocumentArea;
  displayTitle?: string;
  instrumentType?: string;
  county?: string;
  state?: string;
  instrumentDate?: string;
  recordingDate?: string;
  volume?: string;
  page?: string;
  instrumentNumber?: string;
  parties?: DocumentParties;
  notes?: string;
  sourceRef?: string;
}

function cleanString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? '' : trimmed;
}

function normalizeParties(value: DocumentParties | undefined): DocumentParties | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const out: DocumentParties = {};
  for (const key of ['grantor', 'grantee', 'lessor', 'lessee', 'notes'] as const) {
    const trimmed = cleanString(value[key]);
    if (trimmed !== undefined && trimmed !== '') out[key] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Inputs for saving a brand-new document attached to an entity. */
export interface SaveDocumentInput {
  workspaceId: string;
  file: File | Blob;
  fileName: string;
  kind?: DocumentKind;
  entityKind: DocumentEntityKind;
  entityId: string;
}

export interface SaveDocumentResult {
  document: DocumentRecord;
  attachment: DocumentAttachment;
}

function newId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Save a new document + create the first attachment for it on `entityId`.
 * Position is appended to the end of any existing attachments for that
 * entity.
 */
export async function saveDoc(
  input: SaveDocumentInput
): Promise<SaveDocumentResult> {
  const blob = input.file instanceof File ? input.file : input.file;
  const fileName =
    input.fileName
    || (input.file instanceof File ? input.file.name : 'document');
  const mimeType =
    (input.file instanceof Blob && input.file.type) || 'application/pdf';
  const contentHash = await sha256HexOfBlob(blob);
  const docId = newId();
  const attachmentId = newId();
  const createdAt = nowIso();

  const document: DocumentRecord = {
    docId,
    workspaceId: input.workspaceId,
    fileName,
    mimeType,
    byteLength: blob.size,
    contentHash,
    blob,
    kind: normalizeDocumentKind(input.kind ?? DEFAULT_DOCUMENT_KIND),
    createdAt,
    updatedAt: createdAt,
  };

  return db.transaction(
    'rw',
    db.documents,
    db.document_attachments,
    async (): Promise<SaveDocumentResult> => {
      const existingCount = await db.document_attachments
        .where('[entityKind+entityId]')
        .equals([input.entityKind, input.entityId])
        .count();
      const attachment: DocumentAttachment = {
        attachmentId,
        docId,
        entityKind: input.entityKind,
        entityId: input.entityId,
        position: existingCount,
        createdAt,
      };
      await db.documents.add(document);
      await db.document_attachments.add(attachment);
      return { document, attachment };
    }
  );
}

/**
 * Attach an existing document to another entity. Useful when the same
 * blob covers multiple title cards (e.g., a single probate order that
 * burdens several heirs).
 */
export async function attachDocToEntity(
  docId: string,
  entityKind: DocumentEntityKind,
  entityId: string
): Promise<DocumentAttachment> {
  return db.transaction('rw', db.documents, db.document_attachments, async () => {
    const doc = await db.documents.get(docId);
    if (!doc) {
      throw new Error(`attachDocToEntity: document ${docId} not found`);
    }
    const existingCount = await db.document_attachments
      .where('[entityKind+entityId]')
      .equals([entityKind, entityId])
      .count();
    const attachment: DocumentAttachment = {
      attachmentId: newId(),
      docId,
      entityKind,
      entityId,
      position: existingCount,
      createdAt: nowIso(),
    };
    await db.document_attachments.add(attachment);
    return attachment;
  });
}

/**
 * Remove an attachment. The underlying document is *not* deleted — call
 * {@link deleteDoc} for that (and only when no attachments remain or the
 * caller intends to cascade-delete).
 */
export async function detachDocFromEntity(
  attachmentId: string
): Promise<void> {
  await db.transaction('rw', db.document_attachments, async () => {
    const existing = await db.document_attachments.get(attachmentId);
    if (!existing) return;
    await db.document_attachments.delete(attachmentId);
    await compactAttachmentPositions(existing.entityKind, existing.entityId);
  });
}

/**
 * Rename a document. The file blob is untouched; only the user-visible
 * filename changes. Updates `updatedAt`.
 */
export async function renameDoc(docId: string, newFileName: string): Promise<void> {
  const trimmed = newFileName.trim();
  if (!trimmed) {
    throw new Error('renameDoc: fileName cannot be empty');
  }
  await db.documents.update(docId, {
    fileName: trimmed,
    updatedAt: nowIso(),
  });
}

/**
 * Update the `kind` tag on a document. The user can re-tag a default-
 * `'other'` migrated row to its true type (deed/obit/affidavit/probate)
 * after the v8 upgrade lands.
 */
export async function setDocKind(docId: string, kind: DocumentKind): Promise<void> {
  await db.documents.update(docId, {
    kind: normalizeDocumentKind(kind),
    updatedAt: nowIso(),
  });
}

/**
 * Apply a metadata patch to a document. Only the keys present in
 * `patch` are written. Empty strings clear the corresponding field;
 * `undefined` leaves it untouched. The blob, hash, and identity fields
 * are never modified by this call.
 *
 * Used by the document registry inspector. Title-math behavior is
 * unaffected — all updated fields are display/filter metadata.
 */
export async function updateDocMetadata(
  docId: string,
  patch: DocumentMetadataPatch
): Promise<void> {
  const next: Partial<DocumentRecord> = { updatedAt: nowIso() };
  if (patch.kind !== undefined) next.kind = normalizeDocumentKind(patch.kind);
  if (patch.area !== undefined) {
    next.area = isDocumentArea(patch.area) ? patch.area : undefined;
  }
  for (const key of [
    'displayTitle',
    'instrumentType',
    'county',
    'state',
    'instrumentDate',
    'recordingDate',
    'volume',
    'page',
    'instrumentNumber',
    'notes',
    'sourceRef',
  ] as const) {
    if (patch[key] !== undefined) next[key] = cleanString(patch[key]);
  }
  if (patch.parties !== undefined) next.parties = normalizeParties(patch.parties);
  await db.documents.update(docId, next);
}

/**
 * Return every document in a workspace, blob omitted, with its
 * attachments joined in. Used by the document registry view.
 *
 * Reading attachments back from `document_attachments` per render lets
 * the registry surface every entity link (node/owner/lease/curative/
 * research) without re-deriving them in the workspace store.
 */
export async function listWorkspaceDocuments(
  workspaceId: string
): Promise<
  Array<{
    document: Omit<DocumentRecord, 'blob'>;
    attachments: DocumentAttachment[];
  }>
> {
  const docs = await db.documents
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();
  if (docs.length === 0) return [];

  const docIds = docs.map((doc) => doc.docId);
  const attachments = await db.document_attachments
    .where('docId')
    .anyOf(docIds)
    .toArray();
  const attachmentsByDocId = new Map<string, DocumentAttachment[]>();
  for (const attachment of attachments) {
    const list = attachmentsByDocId.get(attachment.docId) ?? [];
    list.push(attachment);
    attachmentsByDocId.set(attachment.docId, list);
  }

  return docs.map((doc) => {
    const { blob: _blob, ...meta } = doc;
    const attached = attachmentsByDocId.get(doc.docId) ?? [];
    attached.sort((a, b) => a.position - b.position);
    return { document: meta, attachments: attached };
  });
}

/**
 * Delete a document and cascade-delete every attachment that references
 * it. Use this when the underlying file is wrong/unwanted everywhere, not
 * when one entity just wants to drop a reference.
 */
export async function deleteDoc(docId: string): Promise<void> {
  await db.transaction('rw', db.documents, db.document_attachments, async () => {
    await db.document_attachments.where('docId').equals(docId).delete();
    await db.documents.delete(docId);
  });
}

export async function getDocBlob(docId: string): Promise<Blob | undefined> {
  const doc = await db.documents.get(docId);
  return doc?.blob;
}

export async function getDocMeta(
  docId: string
): Promise<Omit<DocumentRecord, 'blob'> | undefined> {
  const doc = await db.documents.get(docId);
  if (!doc) return undefined;
  const { blob: _blob, ...meta } = doc;
  return meta;
}

/**
 * Return every attachment on `entityKind`/`entityId`, ordered by
 * `position`, paired with its document metadata (blob omitted).
 */
export async function listDocsForEntity(
  entityKind: DocumentEntityKind,
  entityId: string
): Promise<
  Array<{
    attachment: DocumentAttachment;
    document: Omit<DocumentRecord, 'blob'>;
  }>
> {
  const attachments = await db.document_attachments
    .where('[entityKind+entityId]')
    .equals([entityKind, entityId])
    .toArray();
  attachments.sort((a, b) => a.position - b.position);
  if (attachments.length === 0) return [];
  const docIds = [...new Set(attachments.map((a) => a.docId))];
  const docs = await db.documents.bulkGet(docIds);
  const docById = new Map<string, DocumentRecord>();
  for (const doc of docs) {
    if (doc) docById.set(doc.docId, doc);
  }
  return attachments.flatMap((attachment) => {
    const doc = docById.get(attachment.docId);
    if (!doc) return [];
    const { blob: _blob, ...meta } = doc;
    return [{ attachment, document: meta }];
  });
}

/** Convenience: every doc attached to a single ownership node. */
export async function listDocsForNode(
  nodeId: string
): Promise<
  Array<{
    attachment: DocumentAttachment;
    document: Omit<DocumentRecord, 'blob'>;
  }>
> {
  return listDocsForEntity('node', nodeId);
}

/**
 * Bulk-fetch the `(attachmentId, docId, fileName, kind, position)`
 * summaries for every node in `nodeIds`, scoped to a single workspace.
 * Used by the workspace-store to hydrate `node.attachments[]` on load.
 *
 * Returns a `Map` keyed by nodeId. Nodes with no attachments are simply
 * absent from the map (callers should treat missing as empty).
 */
export async function listAttachmentsForNodes(
  workspaceId: string,
  nodeIds: ReadonlyArray<string>
): Promise<
  Map<
    string,
    Array<Pick<DocumentAttachment, 'attachmentId' | 'docId' | 'position'> &
      Pick<DocumentRecord, 'fileName' | 'kind'>>
  >
> {
  const result = new Map<
    string,
    Array<Pick<DocumentAttachment, 'attachmentId' | 'docId' | 'position'> &
      Pick<DocumentRecord, 'fileName' | 'kind'>>
  >();
  if (nodeIds.length === 0) return result;

  // Dexie equalsAnyOf lets us bulk-fetch attachments without N round-trips.
  const attachments = await db.document_attachments
    .where('entityKind')
    .equals('node')
    .and((a) => nodeIds.includes(a.entityId))
    .toArray();
  if (attachments.length === 0) return result;

  const docIds = [...new Set(attachments.map((a) => a.docId))];
  const docs = await db.documents.bulkGet(docIds);
  const docById = new Map<string, DocumentRecord>();
  for (const doc of docs) {
    if (doc && doc.workspaceId === workspaceId) {
      docById.set(doc.docId, doc);
    }
  }

  for (const a of attachments) {
    const doc = docById.get(a.docId);
    if (!doc) continue;
    const list = result.get(a.entityId) ?? [];
    list.push({
      attachmentId: a.attachmentId,
      docId: a.docId,
      position: a.position,
      fileName: doc.fileName,
      kind: doc.kind,
    });
    result.set(a.entityId, list);
  }

  for (const list of result.values()) {
    list.sort((x, y) => x.position - y.position);
  }
  return result;
}

/**
 * Reorder the attachments for one entity to match `orderedAttachmentIds`.
 * IDs not currently attached to this entity are ignored. Missing IDs are
 * appended at the end in their existing order.
 */
export async function reorderAttachments(
  entityKind: DocumentEntityKind,
  entityId: string,
  orderedAttachmentIds: ReadonlyArray<string>
): Promise<void> {
  await db.transaction('rw', db.document_attachments, async () => {
    const existing = await db.document_attachments
      .where('[entityKind+entityId]')
      .equals([entityKind, entityId])
      .toArray();
    const byId = new Map(existing.map((a) => [a.attachmentId, a] as const));
    const seen = new Set<string>();
    const ordered: DocumentAttachment[] = [];

    for (const id of orderedAttachmentIds) {
      const found = byId.get(id);
      if (found && !seen.has(id)) {
        ordered.push(found);
        seen.add(id);
      }
    }
    // Anything that wasn't named in the order list keeps its relative
    // position from `existing` and trails behind.
    for (const a of existing) {
      if (!seen.has(a.attachmentId)) {
        ordered.push(a);
      }
    }

    for (let i = 0; i < ordered.length; i += 1) {
      const target = ordered[i];
      if (target.position !== i) {
        await db.document_attachments.update(target.attachmentId, {
          position: i,
        });
      }
    }
  });
}

/**
 * Internal: compact `position` values to `[0, n)` after a delete so the
 * UI never sees gaps. Called inside an open transaction; do not call
 * outside one.
 */
async function compactAttachmentPositions(
  entityKind: DocumentEntityKind,
  entityId: string
): Promise<void> {
  const remaining = await db.document_attachments
    .where('[entityKind+entityId]')
    .equals([entityKind, entityId])
    .toArray();
  remaining.sort((a, b) => a.position - b.position);
  for (let i = 0; i < remaining.length; i += 1) {
    if (remaining[i].position !== i) {
      await db.document_attachments.update(remaining[i].attachmentId, {
        position: i,
      });
    }
  }
}
