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
      get: vi.fn(async (docId: string) => docRows.get(docId)),
      where: vi.fn((field: string) => ({
        equals: vi.fn((workspaceId: string) => ({
          toArray: vi.fn(async () => {
            if (field !== 'workspaceId') return [];
            return [...docRows.values()].filter((doc) => doc.workspaceId === workspaceId);
          }),
        })),
      })),
      add: vi.fn(async (doc: DocumentRecord) => {
        docRows.set(doc.docId, doc);
      }),
      bulkDelete: vi.fn(async (docIds: string[]) => {
        for (const docId of docIds) docRows.delete(docId);
      }),
    },
    document_attachments: {
      get: vi.fn(async (attachmentId: string) => attachmentRows.get(attachmentId)),
      add: vi.fn(async (attachment: DocumentAttachment) => {
        attachmentRows.set(attachment.attachmentId, attachment);
      }),
      update: vi.fn(async (attachmentId: string, patch: Partial<DocumentAttachment>) => {
        const existing = attachmentRows.get(attachmentId);
        if (existing) {
          attachmentRows.set(attachmentId, { ...existing, ...patch });
        }
      }),
      delete: vi.fn(async (attachmentId: string) => {
        attachmentRows.delete(attachmentId);
      }),
      bulkGet: vi.fn(async (attachmentIds: string[]) =>
        attachmentIds.map((attachmentId) => attachmentRows.get(attachmentId))
      ),
      bulkDelete: vi.fn(async (attachmentIds: string[]) => {
        for (const attachmentId of attachmentIds) {
          attachmentRows.delete(attachmentId);
        }
      }),
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: unknown) => {
          const matching = () => [...attachmentRows.values()].filter((attachment) => {
            if (field === '[workspaceId+entityKind+entityId]' && Array.isArray(value)) {
              const [workspaceId, entityKind, entityId] =
                value as [string, string, string];
              return (
                attachment.workspaceId === workspaceId
                && attachment.entityKind === entityKind
                && attachment.entityId === entityId
              );
            }
            return (attachment as unknown as Record<string, unknown>)[field] === value;
          });
          return {
            toArray: vi.fn(async () => matching()),
            count: vi.fn(async () => matching().length),
            delete: vi.fn(async () => {
              for (const attachment of matching()) {
                attachmentRows.delete(attachment.attachmentId);
              }
            }),
          };
        }),
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

  it('lists registry metadata without loading document blobs', async () => {
    const { documentStore } = await loadDocumentStoreWithRows({
      documents: [
        fakeDocument({
          docId: 'doc-1',
          workspaceId: 'ws-1',
          fileName: 'deed.pdf',
        }),
      ],
      attachments: [fakeAttachment({ docId: 'doc-1', workspaceId: 'ws-1' })],
    });

    const registryData = await documentStore.listDocumentRegistryData('ws-1');

    expect(registryData.documents).toEqual([
      expect.objectContaining({
        docId: 'doc-1',
        workspaceId: 'ws-1',
        fileName: 'deed.pdf',
      }),
    ]);
    expect('blob' in registryData.documents[0]!).toBe(false);
    expect(registryData.attachments).toEqual([
      expect.objectContaining({
        attachmentId: 'att-1',
        docId: 'doc-1',
        workspaceId: 'ws-1',
      }),
    ]);
  });

  it('scopes attachment append, reorder, and compaction by workspace and entity', async () => {
    const { documentStore, attachmentRows } = await loadDocumentStoreWithRows({
      documents: [
        fakeDocument({ docId: 'doc-ws1-a', workspaceId: 'ws-1' }),
        fakeDocument({ docId: 'doc-ws1-new', workspaceId: 'ws-1' }),
        fakeDocument({ docId: 'doc-ws2-a', workspaceId: 'ws-2' }),
        fakeDocument({ docId: 'doc-ws2-b', workspaceId: 'ws-2' }),
      ],
      attachments: [
        fakeAttachment({
          attachmentId: 'att-ws1-a',
          workspaceId: 'ws-1',
          docId: 'doc-ws1-a',
          entityId: 'node-shared',
          position: 0,
        }),
        fakeAttachment({
          attachmentId: 'att-ws2-a',
          workspaceId: 'ws-2',
          docId: 'doc-ws2-a',
          entityId: 'node-shared',
          position: 0,
        }),
        fakeAttachment({
          attachmentId: 'att-ws2-b',
          workspaceId: 'ws-2',
          docId: 'doc-ws2-b',
          entityId: 'node-shared',
          position: 1,
        }),
      ],
    });

    const added = await documentStore.attachDocToEntity(
      'doc-ws1-new',
      'node',
      'node-shared'
    );
    expect(added).toMatchObject({
      workspaceId: 'ws-1',
      entityId: 'node-shared',
      position: 1,
    });

    await documentStore.reorderAttachments('ws-2', 'node', 'node-shared', [
      'att-ws2-b',
      'att-ws2-a',
    ]);
    expect(attachmentRows.get('att-ws2-b')?.position).toBe(0);
    expect(attachmentRows.get('att-ws2-a')?.position).toBe(1);
    expect(attachmentRows.get('att-ws1-a')?.position).toBe(0);
    expect(attachmentRows.get(added.attachmentId)?.position).toBe(1);

    await documentStore.detachDocFromEntity('att-ws2-b');
    expect(attachmentRows.has('att-ws2-b')).toBe(false);
    expect(attachmentRows.get('att-ws2-a')?.position).toBe(0);
    expect(attachmentRows.get('att-ws1-a')?.position).toBe(0);
    expect(attachmentRows.get(added.attachmentId)?.position).toBe(1);
  });
});
