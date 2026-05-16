import { describe, expect, it } from 'vitest';
import {
  buildPacketManifestCsv,
  buildPacketPackageManifest,
  buildPacketZip,
  packetZipFileName,
} from '../packet-export';
import {
  buildDocumentRegistryRows,
  type RegistryDocument,
} from '../document-registry';
import type { DocumentAttachment } from '../../types/document';
import { createBlankNode, type DeskMap } from '../../types/node';

const decoder = new TextDecoder();

function doc(overrides: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    docId: 'doc-1',
    workspaceId: 'ws-1',
    fileName: 'vault/Tract A: North?.pdf',
    mimeType: 'application/pdf',
    byteLength: 12,
    contentHash: 'hash-1',
    kind: 'deed',
    displayTitle: 'Tract A, "North" Deed',
    area: 'runsheet_mineral_title',
    instrumentType: 'Mineral Deed',
    county: 'Walker',
    state: 'TX',
    instrumentNumber: 'DOC-001',
    instrumentDate: '2026-05-16',
    parties: {
      grantor: 'Grantor, LLC',
      grantee: 'Grantee "LP"',
      lessor: 'Registry Lessor',
      lessee: 'Registry Lessee',
      notes: 'Line one\nLine two',
    },
    sourceRef: 'Dropbox/title/tract-a.pdf',
    externalRefs: [
      {
        system: 'file',
        externalId: 'file-1',
        path: '/vault/title/tract-a.pdf',
        label: 'Source file',
      },
    ],
    ocrStatus: 'not_needed',
    createdAt: '2026-05-16T00:00:00.000Z',
    updatedAt: '2026-05-16T00:00:00.000Z',
    ...overrides,
  };
}

function attachment(overrides: Partial<DocumentAttachment> = {}): DocumentAttachment {
  return {
    attachmentId: 'att-1',
    docId: 'doc-1',
    entityKind: 'node',
    entityId: 'node-1',
    position: 0,
    createdAt: '2026-05-16T00:00:00.000Z',
    ...overrides,
  };
}

function rows(overrides: Partial<RegistryDocument> = {}) {
  const node = {
    ...createBlankNode('node-1'),
    instrument: 'Mineral Deed',
    docNo: 'DOC-001',
    grantor: 'Grantor, LLC',
    grantee: 'Grantee "LP"',
  };
  const deskMap: DeskMap = {
    id: 'dm-1',
    name: 'Tract A',
    code: 'A',
    tractId: 'A',
    grossAcres: '100',
    pooledAcres: '',
    description: '',
    nodeIds: ['node-1'],
  };
  return buildDocumentRegistryRows({
    documents: [doc(overrides)],
    attachments: [attachment()],
    nodes: [node],
    deskMaps: [deskMap],
  });
}

async function readStoredZipEntries(blob: Blob): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const entries = new Map<string, Uint8Array>();
  let offset = 0;
  while (offset + 30 <= bytes.byteLength) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const fileNameStart = offset + 30;
    const dataStart = fileNameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const fileName = decoder.decode(bytes.slice(fileNameStart, fileNameStart + fileNameLength));
    entries.set(fileName, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }
  return entries;
}

describe('packet export', () => {
  it('builds package manifests with native file paths and preserved refs', () => {
    const manifest = buildPacketPackageManifest(rows());

    expect(manifest[0]).toMatchObject({
      packetOrder: 1,
      docId: 'doc-1',
      displayTitle: 'Tract A, "North" Deed',
      sourceRef: 'Dropbox/title/tract-a.pdf',
      nativeFilePath: 'documents/001-Tract A- North-.pdf',
      nativeFileIncluded: true,
      externalRefs: [
        expect.objectContaining({
          system: 'file',
          externalId: 'file-1',
          path: '/vault/title/tract-a.pdf',
        }),
      ],
    });
  });

  it('builds a CSV manifest with escaped metadata', () => {
    const csv = buildPacketManifestCsv(buildPacketPackageManifest(rows()));

    expect(csv).toContain('"Tract A, ""North"" Deed"');
    expect(csv).toContain('"Grantor, LLC"');
    expect(csv).toContain('"Grantee ""LP"""');
    expect(csv).toContain('"Line one\nLine two"');
  });

  it('builds a ZIP with JSON, CSV, and native document files', async () => {
    const zip = await buildPacketZip(
      rows(),
      async (docId) => new Blob([`native-${docId}`], { type: 'application/pdf' }),
      {
        projectName: 'Packet Project',
        exportedAt: '2026-05-16T12:00:00.000Z',
      }
    );

    expect(zip.type).toBe('application/zip');
    const entries = await readStoredZipEntries(zip);
    expect([...entries.keys()]).toEqual([
      'manifest.json',
      'manifest.csv',
      'documents/001-Tract A- North-.pdf',
    ]);

    const manifestBytes = entries.get('manifest.json');
    const nativeBytes = entries.get('documents/001-Tract A- North-.pdf');
    if (!manifestBytes || !nativeBytes) {
      throw new Error('Expected packet ZIP entries were missing.');
    }
    const manifest = JSON.parse(decoder.decode(manifestBytes));
    expect(manifest).toMatchObject({
      exportedAt: '2026-05-16T12:00:00.000Z',
      projectName: 'Packet Project',
      documentCount: 1,
      documents: [
        {
          docId: 'doc-1',
          nativeFilePath: 'documents/001-Tract A- North-.pdf',
        },
      ],
    });
    expect(decoder.decode(nativeBytes)).toBe('native-doc-1');
  });

  it('fails when a native document file is missing from storage', async () => {
    await expect(
      buildPacketZip(rows(), async () => undefined, {
        exportedAt: '2026-05-16T12:00:00.000Z',
      })
    ).rejects.toThrow(/missing stored document file for doc-1/);
  });

  it('builds stable project-scoped packet file names', () => {
    expect(packetZipFileName('Bad/Name: With* Chars', new Date('2026-05-16T00:00:00Z'))).toBe(
      'landroid-document-packet-bad-name-with-chars-2026-05-16.zip'
    );
  });
});
