import { describe, expect, it } from 'vitest';
import {
  buildPacketManifest,
  buildPacketPreview,
  buildRegistryRows,
  filterRegistryRows,
  type RegistryDocument,
} from '../registry';
import type { DocumentAttachment } from '../../types/document';
import { createBlankNode, type DeskMap, type OwnershipNode } from '../../types/node';

function makeDoc(overrides: Partial<RegistryDocument> = {}): RegistryDocument {
  return {
    docId: 'doc-1',
    workspaceId: 'ws-1',
    fileName: 'deed.pdf',
    mimeType: 'application/pdf',
    byteLength: 1024,
    contentHash: 'hash-1',
    kind: 'deed',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeNode(overrides: Partial<OwnershipNode> = {}): OwnershipNode {
  return { ...createBlankNode(overrides.id ?? 'node-1', overrides.parentId ?? null), ...overrides };
}

function makeDeskMap(overrides: Partial<DeskMap> = {}): DeskMap {
  return {
    id: 'tract-1',
    name: 'Tract 1',
    code: 'T1',
    tractId: null,
    grossAcres: '40',
    pooledAcres: '0',
    description: '',
    nodeIds: [],
    ...overrides,
  };
}

function makeAttachment(overrides: Partial<DocumentAttachment> = {}): DocumentAttachment {
  return {
    attachmentId: 'att-1',
    docId: 'doc-1',
    entityKind: 'node',
    entityId: 'node-1',
    position: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildRegistryRows', () => {
  it('derives area from kind when not explicit', () => {
    const rows = buildRegistryRows({
      documents: [makeDoc({ kind: 'deed' }), makeDoc({ docId: 'doc-2', kind: 'lease' })],
      attachments: [],
      nodes: [],
      deskMaps: [],
    });
    const byId = new Map(rows.map((r) => [r.document.docId, r]));
    expect(byId.get('doc-1')?.area).toBe('mineral_title');
    expect(byId.get('doc-2')?.area).toBe('leasehold');
  });

  it('honors explicit area over kind default', () => {
    const rows = buildRegistryRows({
      documents: [makeDoc({ kind: 'deed', area: 'curative' })],
      attachments: [],
      nodes: [],
      deskMaps: [],
    });
    expect(rows[0].area).toBe('curative');
  });

  it('resolves node links and tract names from desk maps', () => {
    const node = makeNode({ id: 'node-1', instrument: 'Mineral Deed', grantor: 'Smith', grantee: 'Jones' });
    const deskMap = makeDeskMap({ id: 'tract-A', name: 'Section 1', nodeIds: ['node-1'] });
    const rows = buildRegistryRows({
      documents: [makeDoc()],
      attachments: [makeAttachment()],
      nodes: [node],
      deskMaps: [deskMap],
    });
    expect(rows[0].links).toHaveLength(1);
    expect(rows[0].links[0].label).toContain('Mineral Deed');
    expect(rows[0].links[0].detail).toContain('Smith');
    expect(rows[0].links[0].tractIds).toEqual(['tract-A']);
  });

  it('flags missing metadata fields', () => {
    const rows = buildRegistryRows({
      documents: [makeDoc({ kind: 'deed' })],
      attachments: [],
      nodes: [],
      deskMaps: [],
    });
    expect(rows[0].missingMetadata.sort()).toEqual(
      ['instrument_type', 'county', 'recording_reference', 'date', 'parties'].sort()
    );
  });

  it('clears missing flags when fields are filled', () => {
    const rows = buildRegistryRows({
      documents: [
        makeDoc({
          instrumentType: 'Mineral Deed',
          county: 'Loving',
          instrumentNumber: '12345',
          instrumentDate: '2024-06-01',
          parties: { grantor: 'Smith', grantee: 'Jones' },
        }),
      ],
      attachments: [],
      nodes: [],
      deskMaps: [],
    });
    expect(rows[0].missingMetadata).toEqual([]);
  });

  it('groups duplicates by content hash', () => {
    const rows = buildRegistryRows({
      documents: [
        makeDoc({ docId: 'a', contentHash: 'shared' }),
        makeDoc({ docId: 'b', contentHash: 'shared' }),
        makeDoc({ docId: 'c', contentHash: 'unique' }),
      ],
      attachments: [],
      nodes: [],
      deskMaps: [],
    });
    const byId = new Map(rows.map((r) => [r.document.docId, r]));
    expect(byId.get('a')?.duplicateDocIds).toEqual(['b']);
    expect(byId.get('b')?.duplicateDocIds).toEqual(['a']);
    expect(byId.get('c')?.duplicateDocIds).toEqual([]);
  });

  it('sorts by best date descending then by title', () => {
    const rows = buildRegistryRows({
      documents: [
        makeDoc({ docId: 'a', fileName: 'old.pdf', instrumentDate: '2020-01-01' }),
        makeDoc({ docId: 'b', fileName: 'beta.pdf', recordingDate: '2024-06-15' }),
        makeDoc({ docId: 'c', fileName: 'alpha.pdf', instrumentDate: '2024-06-15' }),
      ],
      attachments: [],
      nodes: [],
      deskMaps: [],
    });
    // 2024 docs win the date tier; within that tier, alpha < beta by title.
    expect(rows.map((r) => r.document.docId)).toEqual(['c', 'b', 'a']);
  });
});

describe('filterRegistryRows', () => {
  const fixtureRows = () =>
    buildRegistryRows({
      documents: [
        makeDoc({ docId: 'mineral', kind: 'deed', instrumentType: 'Mineral Deed', county: 'Loving' }),
        makeDoc({ docId: 'lease', kind: 'lease', instrumentType: 'Oil & Gas Lease' }),
        makeDoc({ docId: 'unlinked', kind: 'other', area: 'gis_map_support' }),
      ],
      attachments: [makeAttachment({ docId: 'mineral', entityId: 'node-1' })],
      nodes: [makeNode({ id: 'node-1', instrument: 'Mineral Deed', grantor: 'Smith', grantee: 'Jones' })],
      deskMaps: [makeDeskMap({ id: 'tract-A', nodeIds: ['node-1'] })],
    });

  it('filters by saved view (area)', () => {
    const rows = filterRegistryRows(fixtureRows(), { view: 'mineral_title' });
    expect(rows.map((r) => r.document.docId)).toEqual(['mineral']);
  });

  it('filters by unlinked saved view', () => {
    const rows = filterRegistryRows(fixtureRows(), { view: 'unlinked' });
    expect(rows.map((r) => r.document.docId).sort()).toEqual(['lease', 'unlinked']);
  });

  it('filters by missing_metadata saved view', () => {
    const rows = filterRegistryRows(fixtureRows(), { view: 'missing_metadata' });
    // All three docs are missing parties / dates / recording ref; this just
    // verifies the predicate fires when there is at least one missing field.
    expect(rows.length).toBeGreaterThan(0);
  });

  it('honors free-text query against parties and filename', () => {
    const rows = filterRegistryRows(fixtureRows(), { view: 'all', query: 'smith' });
    expect(rows.map((r) => r.document.docId)).toEqual(['mineral']);
  });

  it('filters by tract through node attachments', () => {
    const rows = filterRegistryRows(fixtureRows(), { view: 'all', tractId: 'tract-A' });
    expect(rows.map((r) => r.document.docId)).toEqual(['mineral']);
  });

  it('respects link state filter', () => {
    const linked = filterRegistryRows(fixtureRows(), { view: 'all', link: 'linked' });
    expect(linked.map((r) => r.document.docId)).toEqual(['mineral']);
    const unlinked = filterRegistryRows(fixtureRows(), { view: 'all', link: 'unlinked' });
    expect(unlinked.map((r) => r.document.docId).sort()).toEqual(['lease', 'unlinked']);
  });
});

describe('buildPacketPreview', () => {
  it('aggregates byte sum, unique hashes, and warning counters', () => {
    const rows = buildRegistryRows({
      documents: [
        makeDoc({ docId: 'a', byteLength: 100, contentHash: 'h1' }),
        makeDoc({ docId: 'b', byteLength: 200, contentHash: 'h1' }),
        makeDoc({ docId: 'c', byteLength: 300, contentHash: 'h2' }),
      ],
      attachments: [makeAttachment({ docId: 'a', entityId: 'node-1' })],
      nodes: [makeNode({ id: 'node-1' })],
      deskMaps: [],
    });
    const preview = buildPacketPreview(rows);
    expect(preview.totalBytes).toBe(600);
    expect(preview.uniqueHashCount).toBe(2);
    expect(preview.duplicateCount).toBe(2); // a and b both share h1
    expect(preview.unlinkedCount).toBe(2); // b and c
    expect(preview.missingMetadataCount).toBe(3); // all missing meta
  });
});

describe('buildPacketManifest', () => {
  it('emits dense 1-indexed entries and flattens parties to strings', () => {
    const rows = buildRegistryRows({
      documents: [
        makeDoc({
          docId: 'a',
          instrumentType: 'Mineral Deed',
          parties: { grantor: 'Smith', grantee: 'Jones' },
        }),
      ],
      attachments: [],
      nodes: [],
      deskMaps: [],
    });
    const manifest = buildPacketManifest(rows);
    expect(manifest).toHaveLength(1);
    expect(manifest[0].packetOrder).toBe(1);
    expect(manifest[0].parties.grantor).toBe('Smith');
    expect(manifest[0].parties.grantee).toBe('Jones');
    expect(manifest[0].parties.lessor).toBe('');
    expect(manifest[0].instrumentType).toBe('Mineral Deed');
  });
});
