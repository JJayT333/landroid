import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentAttachment, DocumentRecord } from '../../types/document';
import type { OwnershipNode } from '../../types/node';

type StoredDocumentRecord = DocumentRecord & { dbKey?: string };
type StoredDocumentAttachment = DocumentAttachment & { dbKey?: string };

const ACTIVE_DB_KEY = 'user-alice';

function fakeDocument(
  overrides: Partial<StoredDocumentRecord> = {}
): StoredDocumentRecord {
  return {
    docId: 'doc-1',
    dbKey: ACTIVE_DB_KEY,
    workspaceId: 'ws-1',
    fileName: 'doc.pdf',
    mimeType: 'application/pdf',
    byteLength: 12,
    contentHash: 'hash',
    blob: new Blob([new Uint8Array(12)]),
    kind: 'deed',
    createdAt: '2026-05-25T00:00:00.000Z',
    updatedAt: '2026-05-25T00:00:00.000Z',
    ...overrides,
  };
}

function fakeAttachment(
  overrides: Partial<StoredDocumentAttachment> = {}
): StoredDocumentAttachment {
  return {
    attachmentId: 'att-1',
    dbKey: ACTIVE_DB_KEY,
    workspaceId: 'ws-1',
    docId: 'doc-1',
    entityKind: 'node',
    entityId: 'node-1',
    position: 0,
    createdAt: '2026-05-25T00:00:00.000Z',
    ...overrides,
  };
}

async function loadWorkspacePersistenceWithRows({
  documents,
  attachments,
}: {
  documents: StoredDocumentRecord[];
  attachments: StoredDocumentAttachment[];
}) {
  vi.resetModules();

  const docRows = new Map(documents.map((doc) => [doc.docId, doc]));
  const db = {
    document_attachments: {
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: unknown) => ({
          and: vi.fn((predicate: (row: StoredDocumentAttachment) => boolean) => ({
            toArray: vi.fn(async () =>
              attachments
                .filter((row) => {
                  if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
                    const [dbKey, workspaceId] = value as [string, string];
                    return row.dbKey === dbKey && row.workspaceId === workspaceId;
                  }
                  return row[field as keyof DocumentAttachment] === value;
                })
                .filter(predicate)
            ),
          })),
        })),
      })),
    },
    documents: {
      bulkGet: vi.fn(async (docIds: string[]) =>
        docIds.map((docId) => docRows.get(docId))
      ),
    },
  };

  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => ACTIVE_DB_KEY,
  }));
  const workspacePersistence = await import('../workspace-persistence');
  return { workspacePersistence, db };
}

describe('exportDocumentWorkspaceData workspace scope', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../active-workspace-key');
    vi.resetModules();
  });

  it('exports only attachments scoped to the requested workspace', async () => {
    const { workspacePersistence, db } = await loadWorkspacePersistenceWithRows({
      documents: [
        fakeDocument({ docId: 'doc-1', workspaceId: 'ws-1' }),
        fakeDocument({ docId: 'doc-2', workspaceId: 'ws-2' }),
      ],
      attachments: [
        fakeAttachment({ attachmentId: 'att-good', workspaceId: 'ws-1', docId: 'doc-1' }),
        fakeAttachment({
          attachmentId: 'att-cross-scope',
          workspaceId: 'ws-2',
          docId: 'doc-1',
        }),
        fakeAttachment({ attachmentId: 'att-other-doc', workspaceId: 'ws-2', docId: 'doc-2' }),
      ],
    });

    const exported = await workspacePersistence.exportDocumentWorkspaceData(
      'ws-1',
      [{ id: 'node-1' } as OwnershipNode]
    );

    expect(db.documents.bulkGet).toHaveBeenCalledWith(['doc-1']);
    expect(exported.documents.map((doc) => doc.docId)).toEqual(['doc-1']);
    expect(exported.attachments.map((attachment) => attachment.attachmentId)).toEqual([
      'att-good',
    ]);
  });

  it('exports legacy PDF data only from the requested workspace when logical node IDs collide', async () => {
    const { workspacePersistence, db } = await loadWorkspacePersistenceWithRows({
      documents: [
        fakeDocument({
          docId: `${ACTIVE_DB_KEY}::doc-ws-1`,
          workspaceId: 'ws-1',
          fileName: 'target.pdf',
          blob: new Blob(['target-pdf'], { type: 'application/pdf' }),
        }),
        fakeDocument({
          docId: `${ACTIVE_DB_KEY}::doc-ws-2`,
          workspaceId: 'ws-2',
          fileName: 'stale.pdf',
          blob: new Blob(['stale-pdf'], { type: 'application/pdf' }),
        }),
      ],
      attachments: [
        fakeAttachment({
          attachmentId: `${ACTIVE_DB_KEY}::att-ws-2`,
          workspaceId: 'ws-2',
          docId: 'doc-ws-2',
          entityId: 'node-collide',
          position: 0,
        }),
        fakeAttachment({
          attachmentId: `${ACTIVE_DB_KEY}::att-ws-1`,
          workspaceId: 'ws-1',
          docId: 'doc-ws-1',
          entityId: 'node-collide',
          position: 1,
        }),
      ],
    });

    const exported = await workspacePersistence.exportPdfWorkspaceData(
      'ws-1',
      [{ id: 'node-collide' } as OwnershipNode]
    );

    expect(db.documents.bulkGet).toHaveBeenCalledWith([
      `${ACTIVE_DB_KEY}::doc-ws-1`,
    ]);
    expect(exported.pdfs).toHaveLength(1);
    expect(exported.pdfs[0]).toMatchObject({
      nodeId: 'node-collide',
      fileName: 'target.pdf',
    });
    expect(await exported.pdfs[0]?.blob.text()).toBe('target-pdf');
  });
});
