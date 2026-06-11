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
  const scopeMatch = (
    row: { dbKey?: string; workspaceId: string },
    value: unknown
  ) =>
    Array.isArray(value)
      ? row.dbKey === value[0] && row.workspaceId === value[1]
      : false;
  const db = {
    document_attachments: {
      // Supports both the workspace-scoped query the document export now makes
      // (`.equals(scope).toArray()`) and the legacy PDF export's node-join
      // (`.equals(scope).and(predicate).toArray()`).
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: unknown) => {
          const base = attachments.filter((row) =>
            field === '[dbKey+workspaceId]'
              ? scopeMatch(row, value)
              : row[field as keyof DocumentAttachment] === value
          );
          return {
            toArray: vi.fn(async () => base),
            and: vi.fn(
              (predicate: (row: StoredDocumentAttachment) => boolean) => ({
                toArray: vi.fn(async () => base.filter(predicate)),
              })
            ),
          };
        }),
      })),
    },
    documents: {
      where: vi.fn((field: string) => ({
        equals: vi.fn((value: unknown) => ({
          toArray: vi.fn(async () =>
            documents.filter((row) =>
              field === '[dbKey+workspaceId]' ? scopeMatch(row, value) : true
            )
          ),
        })),
      })),
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

  it('exports every workspace document — detached and non-node-attached originals included — even when no nodes are passed (DA-H6)', async () => {
    const { workspacePersistence } = await loadWorkspacePersistenceWithRows({
      documents: [
        fakeDocument({ docId: 'doc-node', workspaceId: 'ws-1' }),
        // Detached: an advertised "Unlinked" state — present, no attachment row.
        fakeDocument({ docId: 'doc-detached', workspaceId: 'ws-1' }),
        // Attached to a non-node entity (owner) — the LLA-M04 case.
        fakeDocument({ docId: 'doc-owner', workspaceId: 'ws-1' }),
        // Different workspace — must never be exported.
        fakeDocument({ docId: 'doc-foreign', workspaceId: 'ws-2' }),
      ],
      attachments: [
        fakeAttachment({
          attachmentId: 'att-node',
          workspaceId: 'ws-1',
          docId: 'doc-node',
          entityKind: 'node',
          entityId: 'node-1',
        }),
        fakeAttachment({
          attachmentId: 'att-owner',
          workspaceId: 'ws-1',
          docId: 'doc-owner',
          entityKind: 'owner',
          entityId: 'owner-7',
        }),
        fakeAttachment({
          attachmentId: 'att-foreign',
          workspaceId: 'ws-2',
          docId: 'doc-foreign',
          entityKind: 'node',
          entityId: 'node-9',
        }),
      ],
    });

    // Pass [] — the value side-store rollback and AI undo capture passes. The
    // old node-join returned an EMPTY snapshot here, which then permanently
    // deleted these originals on restore. The export must be workspace-complete
    // regardless of what (if anything) is passed for the deprecated nodes arg.
    const exported = await workspacePersistence.exportDocumentWorkspaceData('ws-1', []);

    expect(exported.documents.map((doc) => doc.docId).sort()).toEqual([
      'doc-detached',
      'doc-node',
      'doc-owner',
    ]);
    expect(
      exported.attachments.map((attachment) => attachment.attachmentId).sort()
    ).toEqual(['att-node', 'att-owner']);
  });

  it('excludes documents and attachments from other workspaces', async () => {
    const { workspacePersistence } = await loadWorkspacePersistenceWithRows({
      documents: [
        fakeDocument({ docId: 'doc-1', workspaceId: 'ws-1' }),
        fakeDocument({ docId: 'doc-2', workspaceId: 'ws-2' }),
      ],
      attachments: [
        fakeAttachment({ attachmentId: 'att-1', workspaceId: 'ws-1', docId: 'doc-1' }),
        fakeAttachment({ attachmentId: 'att-2', workspaceId: 'ws-2', docId: 'doc-2' }),
      ],
    });

    const exported = await workspacePersistence.exportDocumentWorkspaceData('ws-1');

    expect(exported.documents.map((doc) => doc.docId)).toEqual(['doc-1']);
    expect(exported.attachments.map((attachment) => attachment.attachmentId)).toEqual([
      'att-1',
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
