/**
 * Phase 0.5 lazy-load contract for the document vault.
 *
 * Opening a project (and listing the registry) must hand the app layer document
 * METADATA only — never the PDF blob bytes — so a large workspace does not pull
 * every document into memory just to render badges and the registry. Blob bytes
 * are fetched on demand through `getDocBlob` for preview / export. These tests
 * lock that behavior so a future reader change cannot silently start leaking
 * blobs into project open.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentAttachment, DocumentRecord } from '../../types/document';

type StoredDocumentRecord = DocumentRecord & { dbKey?: string };
type StoredDocumentAttachment = DocumentAttachment & { dbKey?: string };

const ACTIVE_DB_KEY = 'user-alice';

function fakeDoc(
  overrides: Partial<StoredDocumentRecord> = {}
): StoredDocumentRecord {
  return {
    docId: 'doc-1',
    dbKey: ACTIVE_DB_KEY,
    workspaceId: 'ws-1',
    fileName: 'deed.pdf',
    mimeType: 'application/pdf',
    byteLength: 12,
    contentHash: 'hash-1',
    blob: new Blob([new Uint8Array(12)], { type: 'application/pdf' }),
    kind: 'deed',
    createdAt: '2026-05-29T00:00:00.000Z',
    updatedAt: '2026-05-29T00:00:00.000Z',
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
    createdAt: '2026-05-29T00:00:00.000Z',
    ...overrides,
  };
}

function matchEquals(
  row: Record<string, unknown>,
  field: string,
  value: unknown
): boolean {
  if (field === '[workspaceId+entityKind+entityId]' && Array.isArray(value)) {
    const [ws, kind, id] = value as [string, string, string];
    return row.workspaceId === ws && row.entityKind === kind && row.entityId === id;
  }
  if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
    const [dbKey, ws] = value as [string, string];
    return row.dbKey === dbKey && row.workspaceId === ws;
  }
  if (field === '[dbKey+workspaceId+docId]' && Array.isArray(value)) {
    const [dbKey, ws, docId] = value as [string, string, string];
    return row.dbKey === dbKey && row.workspaceId === ws && row.docId === docId;
  }
  if (field === '[dbKey+workspaceId+entityKind+entityId]' && Array.isArray(value)) {
    const [dbKey, ws, kind, id] = value as [string, string, string, string];
    return (
      row.dbKey === dbKey
      && row.workspaceId === ws
      && row.entityKind === kind
      && row.entityId === id
    );
  }
  return row[field] === value;
}

function makeTable<Row extends Record<string, unknown>>(
  rows: Row[],
  pk: keyof Row
) {
  const byId = new Map(rows.map((row) => [String(row[pk]), row]));
  const all = () => [...byId.values()];
  const collection = (predicate: (row: Row) => boolean) => {
    const c = {
      toArray: vi.fn(async () => all().filter(predicate)),
      and: (fn: (row: Row) => boolean) =>
        collection((row) => predicate(row) && fn(row)),
    };
    return c;
  };
  return {
    get: vi.fn(async (id: string) => byId.get(id)),
    bulkGet: vi.fn(async (ids: string[]) => ids.map((id) => byId.get(id))),
    where: vi.fn((field: string) => ({
      equals: (value: unknown) =>
        collection((row) => matchEquals(row, field, value)),
      anyOf: (values: unknown[]) => {
        if (field === '[dbKey+workspaceId+docId]') {
          const set = new Set(values.map((value) => JSON.stringify(value)));
          return collection((row) =>
            set.has(JSON.stringify([row.dbKey, row.workspaceId, row.docId]))
          );
        }
        const set = new Set(values);
        return collection((row) => set.has(row[field]));
      },
      between: (lower: unknown[]) =>
        // The node-attachment reader scans [ws, 'node', minKey..maxKey];
        // match on the fixed prefix and let the caller's `.and(...)` filter ids.
        collection((row) => {
          if (lower.length === 4) {
            return (
              row.dbKey === lower[0]
              && row.workspaceId === lower[1]
              && row.entityKind === lower[2]
            );
          }
          return row.workspaceId === lower[0] && row.entityKind === lower[1];
        }),
    })),
  };
}

async function loadStore({
  documents,
  attachments,
}: {
  documents: StoredDocumentRecord[];
  attachments: StoredDocumentAttachment[];
}) {
  vi.resetModules();
  const docTable = makeTable(
    documents as unknown as Array<Record<string, unknown>>,
    'docId'
  );
  const attachmentTable = makeTable(
    attachments as unknown as Array<Record<string, unknown>>,
    'attachmentId'
  );
  const db = { documents: docTable, document_attachments: attachmentTable };
  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => ACTIVE_DB_KEY,
  }));
  const documentStore = await import('../document-store');
  return { documentStore, docTable };
}

function hasBlob(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && 'blob' in (value as object);
}

describe('document vault lazy-load contract', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../active-workspace-key');
    vi.resetModules();
  });

  it('listDocumentRegistryData returns metadata with no blob payloads', async () => {
    const { documentStore } = await loadStore({
      documents: [fakeDoc(), fakeDoc({ docId: 'doc-2', fileName: 'lease.pdf' })],
      attachments: [fakeAttachment(), fakeAttachment({ attachmentId: 'att-2', docId: 'doc-2' })],
    });

    const { documents, attachments } =
      await documentStore.listDocumentRegistryData('ws-1');

    expect(documents).toHaveLength(2);
    expect(attachments).toHaveLength(2);
    expect(documents.some(hasBlob)).toBe(false);
    expect(documents[0].fileName).toBe('deed.pdf');
  });

  it('listDocsForEntity pairs the attachment with blob-free metadata', async () => {
    const { documentStore } = await loadStore({
      documents: [fakeDoc()],
      attachments: [fakeAttachment()],
    });

    const result = await documentStore.listDocsForEntity('ws-1', 'node', 'node-1');

    expect(result).toHaveLength(1);
    expect(result[0].document.fileName).toBe('deed.pdf');
    expect(hasBlob(result[0].document)).toBe(false);
  });

  it('listAttachmentsForNodes hydrates node badges with summaries, not blobs', async () => {
    const { documentStore } = await loadStore({
      documents: [fakeDoc()],
      attachments: [fakeAttachment()],
    });

    const byNode = await documentStore.listAttachmentsForNodes('ws-1', ['node-1']);
    const entries = byNode.get('node-1');

    expect(entries).toHaveLength(1);
    expect(Object.keys(entries![0]).sort()).toEqual(
      ['attachmentId', 'docId', 'fileName', 'kind', 'position'].sort()
    );
    expect(hasBlob(entries![0])).toBe(false);
  });

  it('getDocMeta omits the blob while getDocBlob returns the bytes', async () => {
    const { documentStore } = await loadStore({
      documents: [fakeDoc()],
      attachments: [],
    });

    const meta = await documentStore.getDocMeta('doc-1');
    expect(meta?.fileName).toBe('deed.pdf');
    expect(hasBlob(meta)).toBe(false);

    const blob = await documentStore.getDocBlob('doc-1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBe(12);
  });

  it('never exposes a Blob through any project-open listing reader', async () => {
    const { documentStore } = await loadStore({
      documents: [fakeDoc(), fakeDoc({ docId: 'doc-2' })],
      attachments: [fakeAttachment(), fakeAttachment({ attachmentId: 'att-2', docId: 'doc-2' })],
    });

    const registry = await documentStore.listDocumentRegistryData('ws-1');
    const forEntity = await documentStore.listDocsForEntity('ws-1', 'node', 'node-1');
    const forNodes = await documentStore.listAttachmentsForNodes('ws-1', ['node-1']);

    const exposed: unknown[] = [
      ...registry.documents,
      ...forEntity.map((entry) => entry.document),
      ...[...forNodes.values()].flat(),
    ];
    for (const value of exposed) {
      expect(value).not.toBeInstanceOf(Blob);
      expect(hasBlob(value)).toBe(false);
    }
  });
});
