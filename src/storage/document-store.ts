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
import Dexie from 'dexie';
import { sha256HexOfBlob } from './blob-hash';
import {
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
  stripStorageScopedId,
} from './db-key-scope';
import {
  PDF_MIME_TYPE,
  normalizePdfBlob,
} from '../utils/pdf-validation';
import {
  DEFAULT_DOCUMENT_KIND,
  normalizeDocumentArea,
  normalizeDocumentKind,
  normalizeDocumentOcrStatus,
  type DocumentAttachment,
  type DocumentArea,
  type DocumentEntityKind,
  type DocumentKind,
  type DocumentRecord,
} from '../types/document';

export type {
  DocumentAttachment,
  DocumentArea,
  DocumentEntityKind,
  DocumentKind,
  DocumentRecord,
} from '../types/document';

type StoredDocumentRecord = DocumentRecord & { dbKey?: string };
type StoredDocumentAttachment = DocumentAttachment & { dbKey?: string };

function stripStoredDocId<T extends { docId: string; dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'docId');
}

function stripStoredAttachmentId<
  T extends { attachmentId: string; dbKey?: string },
>(row: T): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'attachmentId');
}

function logicalDocId(doc: { docId: string; dbKey?: string }): string {
  return stripStorageScopedId(doc.docId, doc.dbKey);
}

function logicalAttachmentId(
  attachment: { attachmentId: string; dbKey?: string }
): string {
  return stripStorageScopedId(attachment.attachmentId, attachment.dbKey);
}

async function getDocumentRow(docId: string) {
  return (
    (await db.documents.get(activeStorageScopedId(docId)))
    ?? db.documents.get(docId)
  );
}

async function getAttachmentRows(
  attachmentIds: ReadonlyArray<string>
): Promise<StoredDocumentAttachment[]> {
  const requested = [...new Set(attachmentIds)].filter(Boolean);
  if (requested.length === 0) return [];
  const scopedIds = requested.map(activeStorageScopedId);
  const rows = await db.document_attachments.bulkGet(scopedIds);
  const missingIds = requested.filter((_, index) => !rows[index]);
  const fallbackRows = missingIds.length > 0
    ? await db.document_attachments.bulkGet(missingIds)
    : [];
  return [...rows, ...fallbackRows].filter(
    (row): row is StoredDocumentAttachment => Boolean(row)
  );
}

async function getDocumentRows(
  docIds: ReadonlyArray<string>
): Promise<StoredDocumentRecord[]> {
  const requested = [...new Set(docIds)].filter(Boolean);
  if (requested.length === 0) return [];
  const scopedIds = requested.map(activeStorageScopedId);
  const rows = await db.documents.bulkGet(scopedIds);
  const missingIds = requested.filter((_, index) => !rows[index]);
  const fallbackRows = missingIds.length > 0
    ? await db.documents.bulkGet(missingIds)
    : [];
  return [...rows, ...fallbackRows].filter(
    (row): row is StoredDocumentRecord => Boolean(row)
  );
}

export type DocumentMetadataPatch = Partial<
  Pick<
    DocumentRecord,
    | 'displayTitle'
    | 'documentArea'
    | 'instrumentType'
    | 'county'
    | 'instrumentNumber'
    | 'volume'
    | 'page'
    | 'effectiveDate'
    | 'recordingDate'
    | 'grantor'
    | 'grantee'
    | 'notes'
    | 'sourceReference'
    | 'ocrStatus'
    | 'kind'
  >
>;

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

function cleanText(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.trim();
}

function defaultAreaForKind(kind: DocumentKind): DocumentArea {
  if (kind === 'lease') return 'leasehold';
  if (
    kind === 'deed'
    || kind === 'obit'
    || kind === 'affidavit'
    || kind === 'probate'
    || kind === 'related'
  ) {
    return 'runsheet_mineral_title';
  }
  return 'inbox';
}

function normalizeMetadataPatch(
  patch: DocumentMetadataPatch
): DocumentMetadataPatch {
  const normalized: DocumentMetadataPatch = {};

  if (patch.displayTitle !== undefined) {
    normalized.displayTitle = cleanText(patch.displayTitle);
  }
  if (patch.documentArea !== undefined) {
    normalized.documentArea = normalizeDocumentArea(patch.documentArea);
  }
  if (patch.instrumentType !== undefined) {
    normalized.instrumentType = cleanText(patch.instrumentType);
  }
  if (patch.county !== undefined) {
    normalized.county = cleanText(patch.county);
  }
  if (patch.instrumentNumber !== undefined) {
    normalized.instrumentNumber = cleanText(patch.instrumentNumber);
  }
  if (patch.volume !== undefined) {
    normalized.volume = cleanText(patch.volume);
  }
  if (patch.page !== undefined) {
    normalized.page = cleanText(patch.page);
  }
  if (patch.effectiveDate !== undefined) {
    normalized.effectiveDate = cleanText(patch.effectiveDate);
  }
  if (patch.recordingDate !== undefined) {
    normalized.recordingDate = cleanText(patch.recordingDate);
  }
  if (patch.grantor !== undefined) {
    normalized.grantor = cleanText(patch.grantor);
  }
  if (patch.grantee !== undefined) {
    normalized.grantee = cleanText(patch.grantee);
  }
  if (patch.notes !== undefined) {
    normalized.notes = cleanText(patch.notes);
  }
  if (patch.sourceReference !== undefined) {
    normalized.sourceReference = cleanText(patch.sourceReference);
  }
  if (patch.ocrStatus !== undefined) {
    normalized.ocrStatus = normalizeDocumentOcrStatus(patch.ocrStatus);
  }
  if (patch.kind !== undefined) {
    normalized.kind = normalizeDocumentKind(patch.kind);
  }

  return normalized;
}

/**
 * Save a new document + create the first attachment for it on `entityId`.
 * Position is appended to the end of any existing attachments for that
 * entity.
 */
export async function saveDoc(
  input: SaveDocumentInput
): Promise<SaveDocumentResult> {
  const fileName =
    input.fileName
    || (input.file instanceof File ? input.file.name : 'document');
  const blob = await normalizePdfBlob(input.file, fileName);
  const mimeType = PDF_MIME_TYPE;
  const contentHash = await sha256HexOfBlob(blob);
  const docId = newId();
  const attachmentId = newId();
  const createdAt = nowIso();
  const kind = normalizeDocumentKind(input.kind ?? DEFAULT_DOCUMENT_KIND);

  const document: DocumentRecord = {
    docId,
    workspaceId: input.workspaceId,
    fileName,
    mimeType,
    byteLength: blob.size,
    contentHash,
    blob,
    kind,
    documentArea: defaultAreaForKind(kind),
    ocrStatus: 'not_started',
    createdAt,
    updatedAt: createdAt,
  };

  return db.transaction(
    'rw',
    db.documents,
    db.document_attachments,
    async (): Promise<SaveDocumentResult> => {
      const existingCount = await db.document_attachments
        .where('[dbKey+workspaceId+entityKind+entityId]')
        .equals([...activeWorkspaceScope(input.workspaceId), input.entityKind, input.entityId])
        .count();
      const attachment: DocumentAttachment = {
        attachmentId,
        workspaceId: input.workspaceId,
        docId,
        entityKind: input.entityKind,
        entityId: input.entityId,
        position: existingCount,
        createdAt,
      };
      await db.documents.add(stampActiveDbKeyWithStorageId(document, 'docId'));
      await db.document_attachments.add(
        stampActiveDbKeyWithStorageId(attachment, 'attachmentId')
      );
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
    const doc = await getDocumentRow(docId);
    if (!doc) {
      throw new Error(`attachDocToEntity: document ${docId} not found`);
    }
    if (doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) {
      throw new Error(`attachDocToEntity: document ${docId} not found`);
    }
    const existingCount = await db.document_attachments
      .where('[dbKey+workspaceId+entityKind+entityId]')
      .equals([...activeWorkspaceScope(doc.workspaceId), entityKind, entityId])
      .count();
    const attachment: DocumentAttachment = {
      attachmentId: newId(),
      workspaceId: doc.workspaceId,
      docId: logicalDocId(doc),
      entityKind,
      entityId,
      position: existingCount,
      createdAt: nowIso(),
    };
    await db.document_attachments.add(
      stampActiveDbKeyWithStorageId(attachment, 'attachmentId')
    );
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
    const existingRows = await getAttachmentRows([attachmentId]);
    const existing = existingRows[0];
    if (!existing) return;
    if (existing.dbKey !== activeWorkspaceScope(existing.workspaceId)[0]) return;
    await db.document_attachments.delete(existing.attachmentId);
    await compactAttachmentPositions(
      existing.workspaceId,
      existing.entityKind,
      existing.entityId
    );
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
  await db.transaction('rw', db.documents, async () => {
    const doc = await getDocumentRow(docId);
    if (!doc || doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return;
    await db.documents.update(doc.docId, {
      fileName: trimmed,
      updatedAt: nowIso(),
    });
  });
}

/**
 * Update the `kind` tag on a document. The user can re-tag a default-
 * `'other'` migrated row to its true type (deed/obit/affidavit/probate)
 * after the v8 upgrade lands.
 */
export async function setDocKind(docId: string, kind: DocumentKind): Promise<void> {
  await db.transaction('rw', db.documents, async () => {
    const doc = await getDocumentRow(docId);
    if (!doc || doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return;
    await db.documents.update(doc.docId, {
      kind: normalizeDocumentKind(kind),
      updatedAt: nowIso(),
    });
  });
}

/**
 * Update Phase 7A registry metadata. The blob, workspace scope, hash, and
 * byte length stay immutable; this only changes human-reviewed fields.
 */
export async function updateDocMetadata(
  docId: string,
  patch: DocumentMetadataPatch
): Promise<void> {
  const updates = normalizeMetadataPatch(patch);
  if (Object.keys(updates).length === 0) return;
  await db.transaction('rw', db.documents, async () => {
    const doc = await getDocumentRow(docId);
    if (!doc || doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return;
    await db.documents.update(doc.docId, {
      ...updates,
      updatedAt: nowIso(),
    });
  });
}

/**
 * Read every document in a workspace plus any attachment links that point
 * at those docs. Blob payloads are omitted so the registry can scan quickly.
 */
export async function listDocumentRegistryData(
  workspaceId: string
): Promise<{
  documents: Array<Omit<DocumentRecord, 'blob'>>;
  attachments: DocumentAttachment[];
}> {
  const docs = await db.documents
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .toArray();
  const documents = docs.map((doc) => {
    const { blob: _blob, ...meta } = stripStoredDocId(doc);
    return meta;
  });
  if (documents.length === 0) {
    return { documents, attachments: [] };
  }

  const docIds = documents.map((doc) => doc.docId);
  const attachments = await db.document_attachments
    .where('[dbKey+workspaceId+docId]')
    .anyOf(docIds.map((docId) => [...activeWorkspaceScope(workspaceId), docId]))
    .toArray();

  return {
    documents,
    attachments: attachments.map(stripStoredAttachmentId),
  };
}

/**
 * Delete a document and cascade-delete every attachment that references
 * it. Use this when the underlying file is wrong/unwanted everywhere, not
 * when one entity just wants to drop a reference.
 */
export async function deleteDoc(docId: string): Promise<void> {
  await db.transaction('rw', db.documents, db.document_attachments, async () => {
    const doc = await getDocumentRow(docId);
    if (!doc || doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return;
    const logicalId = logicalDocId(doc);
    await db.document_attachments
      .where('[dbKey+workspaceId+docId]')
      .equals([...activeWorkspaceScope(doc.workspaceId), logicalId])
      .delete();
    await db.documents.delete(doc.docId);
  });
}

/**
 * Delete multiple documents in one transaction. Used for branch/tract cascades
 * so storage either removes every affected document link/blob or none of them.
 */
export async function deleteDocs(docIds: ReadonlyArray<string>): Promise<void> {
  const uniqueDocIds = [...new Set(docIds)].filter(Boolean);
  if (uniqueDocIds.length === 0) return;
  await db.transaction('rw', db.documents, db.document_attachments, async () => {
    const docs = (await getDocumentRows(uniqueDocIds))
      .filter((doc): doc is StoredDocumentRecord =>
        Boolean(doc && doc.dbKey === activeWorkspaceScope(doc.workspaceId)[0])
      );
    const scopedDocIds = docs.map((doc) => doc.docId);
    if (scopedDocIds.length === 0) return;
    const scopedAttachmentKeys = docs.map((doc) =>
      [...activeWorkspaceScope(doc.workspaceId), logicalDocId(doc)] as [
        string,
        string,
        string,
      ]
    );
    const attachmentIds = await db.document_attachments
      .where('[dbKey+workspaceId+docId]')
      .anyOf(scopedAttachmentKeys)
      .primaryKeys();
    if (attachmentIds.length > 0) {
      await db.document_attachments.bulkDelete(attachmentIds);
    }
    await db.documents.bulkDelete(scopedDocIds);
  });
}

/**
 * Remove a set of attachment links and delete only the documents that become
 * attachmentless because of that same removal. Used when ownership nodes are
 * deleted: docs shared with surviving nodes stay in the registry.
 */
export async function deleteDocsForAttachments(
  attachmentIds: ReadonlyArray<string>
): Promise<void> {
  const uniqueAttachmentIds = [...new Set(attachmentIds)].filter(Boolean);
  if (uniqueAttachmentIds.length === 0) return;

  await db.transaction('rw', db.documents, db.document_attachments, async () => {
    const removedAttachments = (await getAttachmentRows(uniqueAttachmentIds)).filter(
      (attachment): attachment is StoredDocumentAttachment =>
        Boolean(
          attachment
          && attachment.dbKey === activeWorkspaceScope(attachment.workspaceId)[0]
        )
    );
    if (removedAttachments.length === 0) return;

    const removedAttachmentSet = new Set(
      removedAttachments.map((attachment) => attachment.attachmentId)
    );
    const docIds = [...new Set(removedAttachments.map((attachment) => attachment.docId))];
    const workspaceId = removedAttachments[0].workspaceId;
    const allAttachmentsForDocs = await db.document_attachments
      .where('[dbKey+workspaceId+docId]')
      .anyOf(docIds.map((docId) => [...activeWorkspaceScope(workspaceId), docId]))
      .toArray();
    const attachmentsByDoc = new Map<string, DocumentAttachment[]>();
    for (const attachment of allAttachmentsForDocs) {
      const existing = attachmentsByDoc.get(attachment.docId) ?? [];
      existing.push(attachment);
      attachmentsByDoc.set(attachment.docId, existing);
    }

    const docIdsToDelete = docIds.filter((docId) => {
      const attachments = attachmentsByDoc.get(docId) ?? [];
      return (
        attachments.length > 0
        && attachments.every((attachment) =>
          removedAttachmentSet.has(attachment.attachmentId)
        )
      );
    });

    await db.document_attachments.bulkDelete(
      removedAttachments.map((attachment) => attachment.attachmentId)
    );
    if (docIdsToDelete.length > 0) {
      const docsToDelete = await getDocumentRows(docIdsToDelete);
      await db.documents.bulkDelete(
        docsToDelete
          .filter((doc) => doc.dbKey === activeWorkspaceScope(doc.workspaceId)[0])
          .map((doc) => doc.docId)
      );
    }
  });
}

export async function getDocBlob(docId: string): Promise<Blob | undefined> {
  const doc = await getDocumentRow(docId);
  if (!doc || doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return undefined;
  return doc?.blob;
}

export async function getDocMeta(
  docId: string
): Promise<Omit<DocumentRecord, 'blob'> | undefined> {
  const doc = await getDocumentRow(docId);
  if (!doc) return undefined;
  if (doc.dbKey !== activeWorkspaceScope(doc.workspaceId)[0]) return undefined;
  const { blob: _blob, ...meta } = stripStoredDocId(doc);
  return meta;
}

/**
 * Return every attachment on `entityKind`/`entityId`, ordered by
 * `position`, paired with its document metadata (blob omitted).
 */
export async function listDocsForEntity(
  workspaceId: string,
  entityKind: DocumentEntityKind,
  entityId: string
): Promise<
  Array<{
    attachment: DocumentAttachment;
    document: Omit<DocumentRecord, 'blob'>;
  }>
> {
  const attachments = await db.document_attachments
    .where('[dbKey+workspaceId+entityKind+entityId]')
    .equals([...activeWorkspaceScope(workspaceId), entityKind, entityId])
    .toArray();
  attachments.sort((a, b) => a.position - b.position);
  if (attachments.length === 0) return [];
  const docIds = [...new Set(attachments.map((a) => a.docId))];
  const docs = await getDocumentRows(docIds);
  const docById = new Map<string, DocumentRecord>();
  for (const doc of docs) {
    if (doc && doc.dbKey === activeWorkspaceScope(doc.workspaceId)[0]) {
      docById.set(logicalDocId(doc), stripStoredDocId(doc));
    }
  }
  return attachments.flatMap((attachment) => {
    const doc = docById.get(attachment.docId);
    if (!doc) return [];
    const { blob: _blob, ...meta } = doc;
    return [{ attachment: stripStoredAttachmentId(attachment), document: meta }];
  });
}

/** Convenience: every doc attached to a single ownership node. */
export async function listDocsForNode(
  workspaceId: string,
  nodeId: string
): Promise<
  Array<{
    attachment: DocumentAttachment;
    document: Omit<DocumentRecord, 'blob'>;
  }>
> {
  return listDocsForEntity(workspaceId, 'node', nodeId);
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
    .where('[dbKey+workspaceId+entityKind+entityId]')
    .between(
      [...activeWorkspaceScope(workspaceId), 'node', Dexie.minKey],
      [...activeWorkspaceScope(workspaceId), 'node', Dexie.maxKey]
    )
    .and((a) => nodeIds.includes(a.entityId))
    .toArray();
  if (attachments.length === 0) return result;

  const docIds = [...new Set(attachments.map((a) => a.docId))];
  const docs = await getDocumentRows(docIds);
  const docById = new Map<string, DocumentRecord>();
  for (const doc of docs) {
    if (
      doc
      && doc.workspaceId === workspaceId
      && doc.dbKey === activeWorkspaceScope(workspaceId)[0]
    ) {
      docById.set(logicalDocId(doc), stripStoredDocId(doc));
    }
  }

  for (const a of attachments) {
    const doc = docById.get(a.docId);
    if (!doc) continue;
    const list = result.get(a.entityId) ?? [];
    list.push({
      attachmentId: logicalAttachmentId(a),
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
  workspaceId: string,
  entityKind: DocumentEntityKind,
  entityId: string,
  orderedAttachmentIds: ReadonlyArray<string>
): Promise<void> {
  await db.transaction('rw', db.document_attachments, async () => {
    const existing = await db.document_attachments
      .where('[dbKey+workspaceId+entityKind+entityId]')
    .equals([...activeWorkspaceScope(workspaceId), entityKind, entityId])
    .toArray();
    const byId = new Map(existing.map((a) => [logicalAttachmentId(a), a] as const));
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
      if (!seen.has(logicalAttachmentId(a))) {
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
  workspaceId: string,
  entityKind: DocumentEntityKind,
  entityId: string
): Promise<void> {
  const remaining = await db.document_attachments
    .where('[dbKey+workspaceId+entityKind+entityId]')
    .equals([...activeWorkspaceScope(workspaceId), entityKind, entityId])
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
