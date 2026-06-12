import { describe, expect, it, vi } from 'vitest';
import type { DocumentRecord } from '../../types/document';
import {
  backfillBlankDocumentContentHashesWithDeps,
  type ContentHashBackfillDocumentTable,
} from '../content-hash-backfill';

type StoredDocumentRecord = DocumentRecord & { dbKey?: string };

function fakeDocument(
  overrides: Partial<StoredDocumentRecord> = {}
): StoredDocumentRecord {
  return {
    docId: 'doc-1',
    dbKey: 'user-alice',
    workspaceId: 'ws-1',
    fileName: 'doc.pdf',
    mimeType: 'application/pdf',
    byteLength: 12,
    contentHash: '',
    blob: new Blob(['doc body'], { type: 'application/pdf' }),
    kind: 'deed',
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  };
}

function fakeDocumentTable(rows: StoredDocumentRecord[]) {
  const docRows = new Map(rows.map((doc) => [doc.docId, doc]));
  const table: ContentHashBackfillDocumentTable = {
    get: vi.fn(async (docId: string) => docRows.get(docId)),
    where: vi.fn((indexName: string) => ({
      equals: vi.fn((value: unknown) => ({
        primaryKeys: vi.fn(async () => {
          if (indexName !== 'contentHash') return [];
          return [...docRows.values()]
            .filter((doc) => doc.contentHash === value)
            .map((doc) => doc.docId);
        }),
        modify: vi.fn(async (callback: (doc: StoredDocumentRecord) => void) => {
          if (indexName !== 'docId') return 0;
          const existing = docRows.get(String(value));
          if (!existing) return 0;
          const previousHash = existing.contentHash;
          callback(existing);
          return existing.contentHash !== previousHash ? 1 : 0;
        }),
      })),
    })),
  };

  return { docRows, table };
}

describe('content-hash backfill', () => {
  it('repairs only blank legacy document hashes and self-extinguishes', async () => {
    const { docRows, table } = fakeDocumentTable([
      fakeDocument({ docId: 'doc-blank', contentHash: '' }),
      fakeDocument({
        docId: 'doc-valid',
        contentHash: 'a'.repeat(64),
        blob: new Blob(['valid body'], { type: 'application/pdf' }),
      }),
    ]);
    const hashBlob = vi.fn(async (blob: Blob) => {
      expect(await blob.text()).toBe('doc body');
      return 'b'.repeat(64);
    });

    await expect(
      backfillBlankDocumentContentHashesWithDeps({
        documents: table,
        hashBlob,
      })
    ).resolves.toEqual({ scanned: 1, updated: 1 });

    expect(docRows.get('doc-blank')?.contentHash).toBe('b'.repeat(64));
    expect(docRows.get('doc-valid')?.contentHash).toBe('a'.repeat(64));
    expect(hashBlob).toHaveBeenCalledTimes(1);

    await expect(
      backfillBlankDocumentContentHashesWithDeps({
        documents: table,
        hashBlob,
      })
    ).resolves.toEqual({ scanned: 0, updated: 0 });
    expect(hashBlob).toHaveBeenCalledTimes(1);
  });

  it('does not clobber a row that changed after the indexed scan', async () => {
    const document = fakeDocument({ docId: 'doc-race', contentHash: '' });
    const { docRows, table } = fakeDocumentTable([document]);
    const hashBlob = vi.fn(async () => {
      document.contentHash = 'c'.repeat(64);
      return 'd'.repeat(64);
    });

    await expect(
      backfillBlankDocumentContentHashesWithDeps({
        documents: table,
        hashBlob,
      })
    ).resolves.toEqual({ scanned: 1, updated: 0 });

    expect(docRows.get('doc-race')?.contentHash).toBe('c'.repeat(64));
  });
});
