import { describe, expect, it } from 'vitest';
import { sha256HexOfBytes } from '../../storage/blob-hash';
import type {
  AttorneyPacketExport,
  AttorneyPacketManifestItem,
} from '../evidence-vault';
import {
  buildAttorneyPacketArchive,
  PacketArchiveHashMismatchError,
  readStoredZip,
} from '../packet-archive';

const NOW = '2026-06-01T12:00:00.000Z';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const FILE_A = encoder.encode('%PDF-1.4 deed A native bytes');
const FILE_B = encoder.encode('%PDF-1.4 deed B native bytes');

async function makeExport(options?: { eDiscovery?: boolean }): Promise<{
  packetExport: AttorneyPacketExport;
  files: Map<string, Uint8Array>;
}> {
  const hashA = await sha256HexOfBytes(FILE_A);
  const hashB = await sha256HexOfBytes(FILE_B);
  const item = (
    order: number,
    id: string,
    title: string,
    fileName: string,
    nativeFileName: string,
    byteLength: number,
    contentHash: string
  ): AttorneyPacketManifestItem => ({
    packetOrder: order,
    documentId: `doc-${id}`,
    documentRecordId: `rec-${id}`,
    displayTitle: title,
    fileName,
    nativeFileName,
    mimeType: 'application/pdf',
    byteLength,
    contentHash,
    vaultObjectId: `vo-${id}`,
    documentVersionId: `dv-${id}`,
    linkedEntities: [],
    sourceCitationIds: [],
  });
  const items = [
    item(1, 'a', 'Deed A', 'deed-a.pdf', '0001-deed-a.pdf', FILE_A.length, hashA),
    item(2, 'b', 'Deed B', 'deed-b.pdf', '0002-deed-b.pdf', FILE_B.length, hashB),
  ];
  const manifestWithoutHash = {
    packetId: 'pkt-1',
    title: 'Attorney packet',
    packetType: 'attorney' as const,
    workspaceId: 'ws-1',
    projectId: 'proj-1',
    generatedAt: NOW,
    checksumAlgorithm: 'sha256' as const,
    items,
    unresolvedIssues: [],
  };
  const manifestHash = await sha256HexOfBytes(
    encoder.encode(JSON.stringify(manifestWithoutHash))
  );
  const manifest = { ...manifestWithoutHash, manifestHash };
  const packetExport: AttorneyPacketExport = {
    manifest,
    manifestJson: JSON.stringify(manifest),
    manifestHash,
    records: [],
    sourceCitationSidecars: [
      {
        documentId: 'doc-a',
        citations: [
          { sourceCitationId: 'sc-1', confidence: 'supported', pageNumber: 1 },
        ],
      },
    ],
    eDiscoverySidecars: options?.eDiscovery
      ? [
          {
            controlNumber: 'DOC-000001',
            fileName: '0001-deed-a.pdf',
            sha256: hashA,
            documentRecordId: 'rec-a',
          },
        ]
      : [],
  };
  return {
    packetExport,
    files: new Map([
      [hashA, FILE_A],
      [hashB, FILE_B],
    ]),
  };
}

describe('packet-archive', () => {
  it('packages a deterministic ZIP whose entries match the manifest', async () => {
    const { packetExport, files } = await makeExport();
    const loadNativeBytes = (item: AttorneyPacketManifestItem) =>
      files.get(item.contentHash)!;

    const archive = await buildAttorneyPacketArchive({ packetExport, loadNativeBytes });

    expect(archive.entryPaths).toEqual([
      'manifest.json',
      'checksums.sha256',
      'files/0001-deed-a.pdf',
      'files/0002-deed-b.pdf',
      'sidecars/source-citations.json',
      'sidecars/unresolved-issues.json',
    ]);

    const unpacked = readStoredZip(archive.bytes);
    // manifest.json round-trips to the projection manifest
    expect(JSON.parse(decoder.decode(unpacked.get('manifest.json')))).toEqual(
      packetExport.manifest
    );
    // native files are byte-identical to the originals
    expect(unpacked.get('files/0001-deed-a.pdf')).toEqual(FILE_A);
    expect(unpacked.get('files/0002-deed-b.pdf')).toEqual(FILE_B);
    // checksum file lists the manifest hash + every file hash
    const checksums = decoder.decode(unpacked.get('checksums.sha256'));
    expect(checksums).toContain(`${packetExport.manifestHash}  manifest.json`);
    for (const manifestItem of packetExport.manifest.items) {
      expect(checksums).toContain(
        `${manifestItem.contentHash}  files/${manifestItem.nativeFileName}`
      );
    }
    // citation sidecar is present
    expect(
      JSON.parse(decoder.decode(unpacked.get('sidecars/source-citations.json')))
    ).toEqual(packetExport.sourceCitationSidecars);
  });

  it('is reproducible: same projection -> byte-identical archive', async () => {
    const { packetExport, files } = await makeExport();
    const load = (item: AttorneyPacketManifestItem) => files.get(item.contentHash)!;
    const first = await buildAttorneyPacketArchive({ packetExport, loadNativeBytes: load });
    const second = await buildAttorneyPacketArchive({ packetExport, loadNativeBytes: load });
    expect(second.bytes).toEqual(first.bytes);
  });

  it('refuses to package a file whose bytes do not match its recorded hash', async () => {
    const { packetExport, files } = await makeExport();
    const tampered = (item: AttorneyPacketManifestItem) =>
      item.packetOrder === 2 ? encoder.encode('swapped bytes') : files.get(item.contentHash)!;

    await expect(
      buildAttorneyPacketArchive({ packetExport, loadNativeBytes: tampered })
    ).rejects.toBeInstanceOf(PacketArchiveHashMismatchError);
  });

  it('includes the eDiscovery sidecar only when the projection has one', async () => {
    const withSidecar = await makeExport({ eDiscovery: true });
    const withoutSidecar = await makeExport({ eDiscovery: false });
    const load =
      (files: Map<string, Uint8Array>) => (item: AttorneyPacketManifestItem) =>
        files.get(item.contentHash)!;

    const withArchive = await buildAttorneyPacketArchive({
      packetExport: withSidecar.packetExport,
      loadNativeBytes: load(withSidecar.files),
    });
    const withoutArchive = await buildAttorneyPacketArchive({
      packetExport: withoutSidecar.packetExport,
      loadNativeBytes: load(withoutSidecar.files),
    });

    expect(withArchive.entryPaths).toContain('sidecars/ediscovery-loadfile.json');
    expect(withoutArchive.entryPaths).not.toContain('sidecars/ediscovery-loadfile.json');
  });
});
