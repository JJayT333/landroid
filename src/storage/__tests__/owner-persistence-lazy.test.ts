/**
 * Phase 0.5 lazy-load contract for the owner-document side store.
 *
 * Opening a project must hand the owner store document METADATA only — never
 * the file blob bytes — so a large workspace does not pull every owner document
 * into memory just to render the list. Blob bytes are fetched on demand through
 * `getOwnerDocBlob` (preview/download) or `loadOwnerDocsWithBlobs` (export /
 * AI undo snapshot). These tests lock that behavior so a future reader change
 * cannot silently start leaking blobs into project open. Mirrors
 * `document-store-lazy.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OwnerDoc } from '../../types/owner';

function fakeDoc(overrides: Partial<OwnerDoc> = {}): OwnerDoc {
  return {
    id: 'doc-1',
    workspaceId: 'ws-1',
    ownerId: 'owner-1',
    leaseId: null,
    fileName: 'notes.txt',
    mimeType: 'text/plain',
    category: 'Other',
    notes: '',
    blob: new Blob(['hello'], { type: 'text/plain' }),
    createdAt: '2026-05-30T00:00:00.000Z',
    updatedAt: '2026-05-30T00:00:00.000Z',
    ...overrides,
  };
}

function makeTable<Row extends Record<string, unknown>>(rows: Row[], pk: keyof Row) {
  const byId = new Map(rows.map((row) => [String(row[pk]), row]));
  const collection = (predicate: (row: Row) => boolean) => ({
    toArray: vi.fn(async () => rows.filter(predicate)),
    sortBy: vi.fn(async (field: string) =>
      rows
        .filter(predicate)
        .slice()
        .sort((a, b) => String(a[field]).localeCompare(String(b[field])))
    ),
  });
  return {
    get: vi.fn(async (id: string) => byId.get(id)),
    where: vi.fn((field: string) => ({
      equals: (value: unknown) => collection((row) => row[field] === value),
    })),
  };
}

async function loadStore(docs: OwnerDoc[]) {
  vi.resetModules();
  const ownerDocs = makeTable(docs as unknown as Array<Record<string, unknown>>, 'id');
  const db = {
    owners: makeTable([], 'id'),
    leases: makeTable([], 'id'),
    contactLogs: makeTable([], 'id'),
    ownerDocs,
  };
  vi.doMock('../db', () => ({ default: db }));
  const ownerPersistence = await import('../owner-persistence');
  return { ownerPersistence };
}

function hasBlob(value: unknown): boolean {
  return Boolean(value) && typeof value === 'object' && 'blob' in (value as object);
}

describe('owner-document lazy-load contract', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.resetModules();
  });

  it('loadOwnerWorkspaceMetadata returns docs with no blob payloads', async () => {
    const { ownerPersistence } = await loadStore([
      fakeDoc(),
      fakeDoc({ id: 'doc-2', fileName: 'deed.pdf' }),
    ]);

    const data = await ownerPersistence.loadOwnerWorkspaceMetadata('ws-1');

    expect(data.docs).toHaveLength(2);
    expect(data.docs.some(hasBlob)).toBe(false);
    expect(data.docs[0].fileName).toBe('notes.txt');
  });

  it('getOwnerDocBlob returns the bytes on demand', async () => {
    const { ownerPersistence } = await loadStore([fakeDoc()]);

    const blob = await ownerPersistence.getOwnerDocBlob('doc-1');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.size).toBe(5);

    const missing = await ownerPersistence.getOwnerDocBlob('nope');
    expect(missing).toBeUndefined();
  });

  it('loadOwnerDocsWithBlobs carries the bytes for export / undo', async () => {
    const { ownerPersistence } = await loadStore([fakeDoc()]);

    const docs = await ownerPersistence.loadOwnerDocsWithBlobs('ws-1');
    expect(docs).toHaveLength(1);
    expect(docs[0].blob).toBeInstanceOf(Blob);
  });

  it('never exposes a Blob through the metadata project-open reader', async () => {
    const { ownerPersistence } = await loadStore([
      fakeDoc(),
      fakeDoc({ id: 'doc-2' }),
    ]);

    const data = await ownerPersistence.loadOwnerWorkspaceMetadata('ws-1');
    for (const doc of data.docs) {
      expect(doc).not.toBeInstanceOf(Blob);
      expect(hasBlob(doc)).toBe(false);
    }
  });
});
