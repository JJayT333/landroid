import { describe, expect, it } from 'vitest';
import { buildPacketArchiveFromData } from '../packet-export';
import { readStoredZip } from '../../project-records/packet-archive';
import { sha256HexOfBlob } from '../../storage/blob-hash';
import type {
  DocumentWorkspaceData,
  WorkspaceData,
} from '../../storage/workspace-persistence';

const NOW = '2026-06-16T00:00:00.000Z';

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
