import { describe, expect, it } from 'vitest';
import {
  buildNodeWorkspaceIndex,
  migratePdfsToDocuments,
  type DocumentMigrationDeps,
} from '../document-migration';
import type { PdfAttachment } from '../db';

function makePdf(overrides: Partial<PdfAttachment> = {}): PdfAttachment {
  return {
    nodeId: 'node-1',
    fileName: 'deed.pdf',
    mimeType: 'application/pdf',
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function deterministicDeps(): DocumentMigrationDeps {
  let idCounter = 0;
  return {
    generateId: () => `id-${++idCounter}`,
    hashBlob: async () => 'hash-stub',
    now: () => '2026-05-15T00:00:00.000Z',
  };
}

describe('buildNodeWorkspaceIndex', () => {
  it('maps every node id in every workspace to that workspace id', () => {
    const rows = [
      {
        id: 'ws-1',
        data: JSON.stringify({ nodes: [{ id: 'node-1' }, { id: 'node-2' }] }),
      },
      { id: 'ws-2', data: JSON.stringify({ nodes: [{ id: 'node-3' }] }) },
    ];
    const index = buildNodeWorkspaceIndex(rows);
    expect(index.get('node-1')).toBe('ws-1');
    expect(index.get('node-2')).toBe('ws-1');
    expect(index.get('node-3')).toBe('ws-2');
    expect(index.size).toBe(3);
  });

  it('first-write-wins for duplicate node ids across workspaces', () => {
    // Should not happen in practice — node IDs are globally unique — but
    // we should be deterministic if it ever does.
    const rows = [
      { id: 'ws-1', data: JSON.stringify({ nodes: [{ id: 'shared' }] }) },
      { id: 'ws-2', data: JSON.stringify({ nodes: [{ id: 'shared' }] }) },
    ];
    expect(buildNodeWorkspaceIndex(rows).get('shared')).toBe('ws-1');
  });

  it('skips unparseable JSON without throwing', () => {
    const rows = [
      { id: 'ws-1', data: 'not json' },
      { id: 'ws-2', data: JSON.stringify({ nodes: [{ id: 'node-2' }] }) },
    ];
    const index = buildNodeWorkspaceIndex(rows);
    expect(index.size).toBe(1);
    expect(index.get('node-2')).toBe('ws-2');
  });

  it('skips rows whose parsed value is null, an array, or has no nodes', () => {
    const rows = [
      { id: 'ws-null', data: 'null' },
      { id: 'ws-array', data: '[]' },
      { id: 'ws-no-nodes', data: JSON.stringify({ projectName: 'x' }) },
      { id: 'ws-nodes-not-array', data: JSON.stringify({ nodes: 'oops' }) },
      { id: 'ws-good', data: JSON.stringify({ nodes: [{ id: 'kept' }] }) },
    ];
    const index = buildNodeWorkspaceIndex(rows);
    expect(index.size).toBe(1);
    expect(index.get('kept')).toBe('ws-good');
  });

  it('skips node entries with missing or non-string ids', () => {
    const rows = [
      {
        id: 'ws-1',
        data: JSON.stringify({
          nodes: [
            { id: 'good' },
            { id: 42 },
            null,
            'bare-string',
            { name: 'no-id' },
          ],
        }),
      },
    ];
    const index = buildNodeWorkspaceIndex(rows);
    expect(index.size).toBe(1);
    expect(index.get('good')).toBe('ws-1');
  });
});

describe('migratePdfsToDocuments', () => {
  it('emits one document and one attachment per pdf row', async () => {
    const pdfs = [
      makePdf({ nodeId: 'node-1', fileName: 'a.pdf' }),
      makePdf({ nodeId: 'node-2', fileName: 'b.pdf' }),
    ];
    const index = new Map([
      ['node-1', 'ws-1'],
      ['node-2', 'ws-1'],
    ]);
    const result = await migratePdfsToDocuments(
      pdfs,
      index,
      'ws-1',
      deterministicDeps()
    );
    expect(result.documents).toHaveLength(2);
    expect(result.attachments).toHaveLength(2);
    expect(result.orphans).toEqual([]);
  });

  it('scopes documents to the workspace whose nodes list owns the node id', async () => {
    const pdfs = [
      makePdf({ nodeId: 'node-1' }),
      makePdf({ nodeId: 'node-2' }),
    ];
    const index = new Map([
      ['node-1', 'ws-1'],
      ['node-2', 'ws-2'],
    ]);
    const result = await migratePdfsToDocuments(
      pdfs,
      index,
      'ws-fallback',
      deterministicDeps()
    );
    expect(result.documents.map((d) => d.workspaceId)).toEqual(['ws-1', 'ws-2']);
  });

  it('attaches with entityKind=node and position=0', async () => {
    const result = await migratePdfsToDocuments(
      [makePdf()],
      new Map([['node-1', 'ws-1']]),
      'ws-1',
      deterministicDeps()
    );
    expect(result.attachments[0].entityKind).toBe('node');
    expect(result.attachments[0].entityId).toBe('node-1');
    expect(result.attachments[0].workspaceId).toBe('ws-1');
    expect(result.attachments[0].position).toBe(0);
  });

  it('assigns DEFAULT_DOCUMENT_KIND (other) at migration time', async () => {
    const result = await migratePdfsToDocuments(
      [makePdf()],
      new Map([['node-1', 'ws-1']]),
      'ws-1',
      deterministicDeps()
    );
    expect(result.documents[0].kind).toBe('other');
  });

  it('falls back to the supplied workspace id and records the orphan', async () => {
    const pdfs = [makePdf({ nodeId: 'orphaned' })];
    const result = await migratePdfsToDocuments(
      pdfs,
      new Map(),
      'ws-fallback',
      deterministicDeps()
    );
    expect(result.documents[0].workspaceId).toBe('ws-fallback');
    expect(result.orphans).toEqual(['orphaned']);
  });

  it('preserves createdAt when present and falls back to deps.now() otherwise', async () => {
    const result = await migratePdfsToDocuments(
      [
        makePdf({ nodeId: 'n-with-ts', createdAt: '2020-06-01T12:00:00.000Z' }),
        makePdf({ nodeId: 'n-without-ts', createdAt: '' }),
      ],
      new Map([
        ['n-with-ts', 'ws-1'],
        ['n-without-ts', 'ws-1'],
      ]),
      'ws-1',
      deterministicDeps()
    );
    expect(result.documents[0].createdAt).toBe('2020-06-01T12:00:00.000Z');
    expect(result.documents[1].createdAt).toBe('2026-05-15T00:00:00.000Z');
  });

  it('records byteLength and mimeType from the source blob', async () => {
    const pdf = makePdf({
      nodeId: 'node-1',
      mimeType: 'application/pdf',
      blob: new Blob([new Uint8Array(1024)], { type: 'application/pdf' }),
    });
    const result = await migratePdfsToDocuments(
      [pdf],
      new Map([['node-1', 'ws-1']]),
      'ws-1',
      deterministicDeps()
    );
    expect(result.documents[0].byteLength).toBe(1024);
    expect(result.documents[0].mimeType).toBe('application/pdf');
  });

  it('skips empty-blob rows (defensive — v7 should have rejected them)', async () => {
    const pdfs = [
      makePdf({ nodeId: 'good' }),
      makePdf({
        nodeId: 'empty',
        blob: new Blob([], { type: 'application/pdf' }),
      }),
    ];
    const result = await migratePdfsToDocuments(
      pdfs,
      new Map([
        ['good', 'ws-1'],
        ['empty', 'ws-1'],
      ]),
      'ws-1',
      deterministicDeps()
    );
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].fileName).toBe('deed.pdf');
    expect(result.attachments).toHaveLength(1);
  });

  it('records the hash returned by the injected hashBlob', async () => {
    const deps: DocumentMigrationDeps = {
      generateId: () => 'deterministic-id',
      hashBlob: async (blob) => `hash-of-${blob.size}-bytes`,
      now: () => '2026-05-15T00:00:00.000Z',
    };
    const result = await migratePdfsToDocuments(
      [
        makePdf({
          nodeId: 'node-1',
          blob: new Blob([new Uint8Array(8)], { type: 'application/pdf' }),
        }),
      ],
      new Map([['node-1', 'ws-1']]),
      'ws-1',
      deps
    );
    expect(result.documents[0].contentHash).toBe('hash-of-8-bytes');
  });

  it('uses deterministic ids from generateId for both document and attachment', async () => {
    let counter = 0;
    const deps: DocumentMigrationDeps = {
      generateId: () => `id-${++counter}`,
      hashBlob: async () => 'h',
      now: () => '2026-05-15T00:00:00.000Z',
    };
    const result = await migratePdfsToDocuments(
      [makePdf()],
      new Map([['node-1', 'ws-1']]),
      'ws-1',
      deps
    );
    expect(result.documents[0].docId).toBe('id-1');
    expect(result.attachments[0].attachmentId).toBe('id-2');
    expect(result.attachments[0].docId).toBe('id-1');
  });
});
