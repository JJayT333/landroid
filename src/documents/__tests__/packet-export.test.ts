import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildPacketArchiveFromData } from '../packet-export';
import { readStoredZip } from '../../project-records/packet-archive';
import { sha256HexOfBlob } from '../../storage/blob-hash';
import type {
  DocumentWorkspaceData,
  WorkspaceData,
} from '../../storage/workspace-persistence';

const NOW = '2026-06-16T00:00:00.000Z';

async function pdfBytes(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) pdf.addPage([612, 792]);
  return pdf.save();
}

function workspace(): WorkspaceData {
  return {
    workspaceId: 'ws-1',
    projectName: 'Vulcan Mesa',
    nodes: [],
    deskMaps: [],
    activeDeskMapId: null,
    instrumentTypes: [],
  };
}

async function singleDocData(): Promise<{
  documentData: DocumentWorkspaceData;
  bytes: Uint8Array;
}> {
  const blob = new Blob(['mineral deed bytes'], { type: 'application/pdf' });
  const documentData: DocumentWorkspaceData = {
    documents: [
      {
        docId: 'doc-1',
        workspaceId: 'ws-1',
        fileName: 'deed.pdf',
        mimeType: 'application/pdf',
        byteLength: blob.size,
        contentHash: await sha256HexOfBlob(blob),
        blob,
        kind: 'deed',
        displayTitle: 'Mineral Deed',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    attachments: [
      {
        attachmentId: 'att-1',
        workspaceId: 'ws-1',
        docId: 'doc-1',
        entityKind: 'node',
        entityId: 'node-1',
        position: 0,
        createdAt: NOW,
      },
    ],
  };
  return { documentData, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

describe('buildPacketArchiveFromData', () => {
  it('packages the scoped documents into a hash-verified ZIP', async () => {
    const { documentData, bytes } = await singleDocData();
    const result = await buildPacketArchiveFromData({
      workspace: workspace(),
      documentData,
      title: 'Attorney packet',
      generatedAt: NOW,
      loadNativeBytes: async () => bytes,
    });

    // valid store-only ZIP (local file header "PK\x03\x04")
    expect([result.bytes[0], result.bytes[1]]).toEqual([0x50, 0x4b]);
    expect(result.entryPaths).toContain('manifest.json');
    expect(result.entryPaths).toContain('checksums.sha256');
    expect(result.entryPaths.some((path) => path.startsWith('files/'))).toBe(true);
    expect(result.manifestHash).toMatch(/^[0-9a-f]{64}$/);

    const unzipped = readStoredZip(result.bytes);
    const manifest = JSON.parse(new TextDecoder().decode(unzipped.get('manifest.json')!));
    expect(manifest.checksumAlgorithm).toBe('sha256');
    expect(manifest.items).toHaveLength(1);
    expect(manifest.items[0].displayTitle).toBe('Mineral Deed');
    // the native file is present + listed in the checksums
    const checksums = new TextDecoder().decode(unzipped.get('checksums.sha256')!);
    expect(checksums).toContain(manifest.items[0].contentHash);
  });

  it('refuses to emit a corrupt packet on a content-hash mismatch (tampered/lost blob)', async () => {
    const { documentData } = await singleDocData();
    await expect(
      buildPacketArchiveFromData({
        workspace: workspace(),
        documentData,
        title: 'x',
        generatedAt: NOW,
        loadNativeBytes: async () => new Uint8Array([1, 2, 3]), // wrong bytes
      })
    ).rejects.toThrow(/SHA-256/);
  });
});

async function twoPdfDocs(): Promise<{
  documentData: DocumentWorkspaceData;
  bytesById: Map<string, Uint8Array>;
}> {
  const a = await pdfBytes(2);
  const b = await pdfBytes(1);
  const blobA = new Blob([new Uint8Array(a)], { type: 'application/pdf' });
  const blobB = new Blob([new Uint8Array(b)], { type: 'application/pdf' });
  const mk = (
    docId: string,
    fileName: string,
    blob: Blob,
    contentHash: string,
    position: number
  ) => ({
    doc: {
      docId,
      workspaceId: 'ws-1',
      fileName,
      mimeType: 'application/pdf',
      byteLength: blob.size,
      contentHash,
      blob,
      kind: 'deed' as const,
      displayTitle: fileName,
      createdAt: NOW,
      updatedAt: NOW,
    },
    att: {
      attachmentId: `att-${docId}`,
      workspaceId: 'ws-1',
      docId,
      entityKind: 'node' as const,
      entityId: 'node-1',
      position,
      createdAt: NOW,
    },
  });
  const rowA = mk('doc-a', 'a.pdf', blobA, await sha256HexOfBlob(blobA), 0);
  const rowB = mk('doc-b', 'b.pdf', blobB, await sha256HexOfBlob(blobB), 1);
  return {
    documentData: {
      documents: [rowA.doc, rowB.doc],
      attachments: [rowA.att, rowB.att],
    },
    bytesById: new Map([
      ['doc-a', a],
      ['doc-b', b],
    ]),
  };
}

describe('buildPacketArchiveFromData — Bates production set', () => {
  it('adds production/ stamped copies + a sequential bates-index, leaving files/ originals intact', async () => {
    const { documentData, bytesById } = await twoPdfDocs();
    const result = await buildPacketArchiveFromData({
      workspace: workspace(),
      documentData,
      title: 'Attorney packet',
      generatedAt: NOW,
      bates: { prefix: 'LANDROID', startNumber: 1, padWidth: 6 },
      loadNativeBytes: async (item) => bytesById.get(item.documentId)!,
    });

    expect(result.batesPageCount).toBe(3);
    const unzipped = readStoredZip(result.bytes);
    const paths = [...unzipped.keys()];
    // Two stamped copies + the index (filenames are packet-order-prefixed).
    expect(paths.filter((p) => p.startsWith('production/') && p.endsWith('.pdf'))).toHaveLength(2);
    expect(paths).toContain('production/bates-index.json');

    const index = JSON.parse(
      new TextDecoder().decode(unzipped.get('production/bates-index.json')!)
    );
    expect(index.totalPages).toBe(3);
    expect(index.items).toHaveLength(2);

    // For each doc: the original in files/ is byte-identical (untouched) and the
    // production/ copy genuinely differs (it was stamped).
    for (const it of index.items as Array<{ documentId: string; nativeFileName: string }>) {
      const original = bytesById.get(it.documentId)!;
      expect(unzipped.get(`files/${it.nativeFileName}`)).toEqual(original);
      expect(unzipped.get(`production/${it.nativeFileName}`)).not.toEqual(original);
    }

    const byId: Record<string, { firstBates: string; lastBates: string; pageCount: number }> =
      Object.fromEntries(index.items.map((it: { documentId: string }) => [it.documentId, it]));
    expect(byId['doc-a'].pageCount).toBe(2);
    expect(byId['doc-b'].pageCount).toBe(1);

    // Numbering runs continuously across the whole set (order-independent):
    // every span length matches its pageCount and the union is exactly 1..3.
    const covered = new Set<number>();
    for (const it of index.items) {
      const first = Number(String(it.firstBates).replace('LANDROID', ''));
      const last = Number(String(it.lastBates).replace('LANDROID', ''));
      expect(last - first + 1).toBe(it.pageCount);
      for (let n = first; n <= last; n += 1) covered.add(n);
    }
    expect([...covered].sort((x, y) => x - y)).toEqual([1, 2, 3]);
  });

  it('omits the production set when no Bates options are given', async () => {
    const { documentData, bytesById } = await twoPdfDocs();
    const result = await buildPacketArchiveFromData({
      workspace: workspace(),
      documentData,
      title: 'x',
      generatedAt: NOW,
      loadNativeBytes: async (item) => bytesById.get(item.documentId)!,
    });
    expect(result.batesPageCount).toBe(0);
    expect(result.entryPaths.some((path) => path.startsWith('production/'))).toBe(false);
  });
});
