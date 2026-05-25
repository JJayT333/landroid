import { describe, expect, it } from 'vitest';
import {
  buildDocumentRegistryRows,
  buildPacketManifest,
  buildPacketPreview,
  filterDocumentRegistryRows,
  type RegistryDocument,
} from '../document-registry';
import type { DocumentAttachment } from '../../types/document';
import { createBlankNode, type DeskMap } from '../../types/node';

function doc(overrides: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    docId: 'doc-1',
    workspaceId: 'ws-1',
    fileName: 'deed.pdf',
    mimeType: 'application/pdf',
    byteLength: 1024,
    contentHash: 'hash-1',
    kind: 'deed',
    createdAt: '2026-05-16T00:00:00.000Z',
    updatedAt: '2026-05-16T00:00:00.000Z',
    ...overrides,
  };
}

function attachment(overrides: Partial<DocumentAttachment> = {}): DocumentAttachment {
  return {
    attachmentId: 'att-1',
    workspaceId: 'ws-1',
    docId: 'doc-1',
    entityKind: 'node',
    entityId: 'node-1',
    position: 0,
    createdAt: '2026-05-16T00:00:00.000Z',
    ...overrides,
  };
}

const node = {
  ...createBlankNode('node-1'),
  instrument: 'Mineral Deed',
  docNo: '20260001',
  grantor: 'Grantor LLC',
  grantee: 'Grantee LP',
  county: 'Tyler',
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

describe('document registry rows', () => {
  it('builds node links, derived runsheet area, and duplicate status', () => {
    const rows = buildDocumentRegistryRows({
      documents: [
        doc({
          docId: 'doc-1',
          contentHash: 'same',
          instrumentType: 'Mineral Deed',
          county: 'Tyler',
          instrumentNumber: '20260001',
          effectiveDate: '2026-01-01',
          grantor: 'Grantor LLC',
          grantee: 'Grantee LP',
        }),
        doc({ docId: 'doc-2', fileName: 'copy.pdf', contentHash: 'same' }),
      ],
      attachments: [attachment()],
      nodes: [node],
      deskMaps: [deskMap],
    });

    const first = rows.find((row) => row.document.docId === 'doc-1');
    expect(first?.resolvedArea).toBe('runsheet_mineral_title');
    expect(first?.linkedEntities[0]).toMatchObject({
      entityKind: 'node',
      entityId: 'node-1',
      label: 'Mineral Deed #20260001',
      detail: 'conveyance | Grantor LLC to Grantee LP | Tract A',
    });
    expect(first?.duplicateDocIds).toEqual(['doc-2']);
  });

  it('filters saved views, linked state, and tract scope', () => {
    const rows = buildDocumentRegistryRows({
      documents: [
        doc({ docId: 'doc-linked', kind: 'deed' }),
        doc({ docId: 'doc-unlinked', kind: 'lease', documentArea: 'leasehold' }),
      ],
      attachments: [attachment({ docId: 'doc-linked' })],
      nodes: [node],
      deskMaps: [deskMap],
    });

    expect(
      filterDocumentRegistryRows(rows, {
        view: 'runsheet_mineral_title',
        tractId: 'dm-1',
        linkedState: 'linked',
      }).map((row) => row.document.docId)
    ).toEqual(['doc-linked']);

    expect(
      filterDocumentRegistryRows(rows, {
        view: 'unlinked',
      }).map((row) => row.document.docId)
    ).toEqual(['doc-unlinked']);
  });

  it('summarizes packet warnings and manifest metadata', () => {
    const rows = buildDocumentRegistryRows({
      documents: [
        doc({
          docId: 'doc-1',
          displayTitle: 'Recorded Deed',
          documentArea: 'runsheet_mineral_title',
          instrumentType: 'Mineral Deed',
          county: 'Tyler',
          instrumentNumber: '20260001',
          recordingDate: '2026-02-01',
          grantor: 'Grantor LLC',
          grantee: 'Grantee LP',
          ocrStatus: 'not_needed',
        }),
        doc({ docId: 'doc-2', fileName: 'missing.pdf', contentHash: 'hash-2' }),
      ],
      attachments: [attachment()],
      nodes: [node],
      deskMaps: [deskMap],
    });

    const preview = buildPacketPreview(rows);
    expect(preview.totalBytes).toBe(2048);
    expect(preview.missingMetadataCount).toBe(1);
    expect(preview.needsOcrCount).toBe(1);
    expect(preview.unlinkedCount).toBe(1);

    const manifest = buildPacketManifest(rows);
    const deedManifest = manifest.find((entry) => entry.docId === 'doc-1');
    expect(Object.keys(deedManifest ?? {})).toEqual([
      'packetOrder',
      'docId',
      'fileName',
      'displayTitle',
      'documentArea',
      'kind',
      'byteLength',
      'contentHash',
      'instrumentType',
      'county',
      'instrumentNumber',
      'volume',
      'page',
      'effectiveDate',
      'recordingDate',
      'grantor',
      'grantee',
      'sourceReference',
      'linkedEntities',
      'missingMetadata',
      'duplicateDocIds',
      'needsOcr',
    ]);
    expect(deedManifest).toMatchObject({
      docId: 'doc-1',
      displayTitle: 'Recorded Deed',
      documentArea: 'runsheet_mineral_title',
      linkedEntities: [
        expect.objectContaining({
          entityKind: 'node',
          entityId: 'node-1',
        }),
      ],
    });
  });
});
