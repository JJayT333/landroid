import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  DocumentAttachment,
  DocumentRecord,
} from '../../types/document';

function fakeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    docId: 'doc-1',
    workspaceId: 'ws-1',
    fileName: 'doc.pdf',
    mimeType: 'application/pdf',
    byteLength: 12,
    contentHash: 'hash',
    blob: new Blob([new Uint8Array(12)]),
    kind: 'deed',
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  };
}

function fakeAttachment(
  overrides: Partial<DocumentAttachment> = {}
): DocumentAttachment {
  return {
    attachmentId: 'att-1',
    workspaceId: 'ws-1',
    docId: 'doc-1',
    entityKind: 'node',
    entityId: 'node-1',
    position: 0,
    createdAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  };
}

async function loadDocumentStoreWithRows({
  documents,
  attachments,
}: {
  documents: DocumentRecord[];
  attachments: DocumentAttachment[];
}) {
  vi.resetModules();

  const docRows = new Map(documents.map((doc) => [doc.docId, doc]));
  const attachmentRows = new Map(
    attachments.map((attachment) => [attachment.attachmentId, attachment])
  );
  const db = {
    documents: {
      bulkDelete: vi.fn(async (docIds: string[]) => {
        for (const docId of docIds) docRows.delete(docId);
      }),
    },
    document_attachments: {
      bulkGet: vi.fn(async (attachmentIds: string[]) =>
        attachmentIds.map((attachmentId) => attachmentRows.get(attachmentId))
      ),
      bulkDelete: vi.fn(async (attachmentIds: string[]) => {
        for (const attachmentId of attachmentIds) {
          attachmentRows.delete(attachmentId);
        }
      }),
      where: vi.fn((field: string) => ({
        anyOf: vi.fn((docIds: string[]) => ({
          toArray: vi.fn(async () => {
            if (field !== 'docId') return [];
            const docIdSet = new Set(docIds);
            return [...attachmentRows.values()].filter((attachment) =>
              docIdSet.has(attachment.docId)
            );
          }),
        })),
      })),
    },
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') {
        throw new Error('transaction callback missing');
      }
      return callback();
    }),
  };

  vi.doMock('../db', () => ({ default: db }));
  const documentStore = await import('../document-store');
  return { documentStore, docRows, attachmentRows, db };
}

describe('document-store', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.resetModules();
  });

  it('deletes only documents orphaned by removed attachment links', async () => {
    const { documentStore, docRows, attachmentRows } =
      await loadDocumentStoreWithRows({
        documents: [
          fakeDocument({ docId: 'doc-shared' }),
          fakeDocument({ docId: 'doc-orphan' }),
        ],
        attachments: [
          fakeAttachment({
            attachmentId: 'att-shared-removed',
            docId: 'doc-shared',
            entityId: 'removed-node',
          }),
          fakeAttachment({
            attachmentId: 'att-shared-survivor',
            docId: 'doc-shared',
            entityId: 'surviving-node',
          }),
          fakeAttachment({
            attachmentId: 'att-orphan',
            docId: 'doc-orphan',
            entityId: 'removed-node',
          }),
        ],
      });

    await documentStore.deleteDocsForAttachments([
      'att-shared-removed',
      'att-orphan',
    ]);

    expect(attachmentRows.has('att-shared-removed')).toBe(false);
    expect(attachmentRows.has('att-orphan')).toBe(false);
    expect(attachmentRows.has('att-shared-survivor')).toBe(true);
    expect(docRows.has('doc-shared')).toBe(true);
    expect(docRows.has('doc-orphan')).toBe(false);
  });
});
