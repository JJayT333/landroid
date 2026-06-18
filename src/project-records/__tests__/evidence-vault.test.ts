import { describe, expect, it } from 'vitest';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineCoreRecordSchema,
  type BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import { sha256HexOfBlob } from '../../storage/blob-hash';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import type { MapWorkspaceData } from '../../storage/map-persistence';
import type { OwnerWorkspaceData } from '../../storage/owner-persistence';
import type { ResearchWorkspaceData } from '../../storage/research-persistence';
import type { DocumentWorkspaceData } from '../../storage/workspace-persistence';
import { createBlankMapAsset } from '../../types/map';
import { createBlankNode, type DeskMap } from '../../types/node';
import {
  createBlankLease,
  createBlankOwner,
  createBlankOwnerDoc,
} from '../../types/owner';
import {
  createBlankResearchImport,
  createBlankResearchProjectRecord,
  createBlankResearchSource,
} from '../../types/research';
import type { TitleIssue } from '../../types/title-issue';
import {
  buildAttorneyPacketExport,
  buildEvidenceVaultRecordsFromWorkspace,
  buildProjectRecordsWithEvidenceVault,
  removeDocumentLinksFromRecords,
} from '../evidence-vault';
import { buildRecordValidationRequest } from '../record-validation';
import { stableRecordId } from '../record-helpers';

const NOW = '2026-06-01T12:00:00.000Z';

const deskMap: DeskMap = {
  id: 'dm-1',
  name: 'Tract 1',
  code: 'T1',
  tractId: 'tract-1',
  grossAcres: '100',
  pooledAcres: '100',
  description: 'Test tract',
  nodeIds: ['node-1'],
};

const workspace = {
  workspaceId: 'ws-1',
  projectName: 'Evidence Vault Fixture',
  nodes: [
    {
      ...createBlankNode('node-1'),
      grantor: 'Grantor A',
      grantee: 'Owner A',
      instrument: 'Mineral Deed',
      docNo: 'D-1',
      fraction: '1',
      initialFraction: '1',
      attachments: [
        {
          attachmentId: 'att-registry',
          docId: 'doc-registry',
          fileName: 'registry.pdf',
          kind: 'deed' as const,
        },
      ],
    },
  ],
  deskMaps: [deskMap],
  leaseholdUnit: {
    name: 'Fixture Unit',
    description: '',
    operator: 'Operator A',
    effectiveDate: '2026-01-01',
    jurisdiction: 'tx_fee' as const,
  },
  leaseholdAssignments: [],
  leaseholdOrris: [],
  leaseholdTransferOrderEntries: [],
  activeDeskMapId: 'dm-1',
  activeUnitCode: null,
  instrumentTypes: ['Mineral Deed'],
};

async function fixtureInput() {
  const registryBlob = new Blob(['registry pdf'], { type: 'application/pdf' });
  const ownerBlob = new Blob(['owner doc'], { type: 'application/pdf' });
  const mapBlob = new Blob(['map asset'], { type: 'application/pdf' });
  const researchBlob = new Blob(['research import'], { type: 'application/pdf' });
  const owner = createBlankOwner('ws-1', {
    id: 'owner-1',
    name: 'Owner A',
    createdAt: NOW,
    updatedAt: NOW,
  });
  const lease = createBlankLease('ws-1', 'owner-1', {
    id: 'lease-1',
    leaseName: 'Lease A',
    lessee: 'Operator A',
    royaltyRate: '1/8',
    leasedInterest: '1',
    jurisdiction: 'tx_fee',
    createdAt: NOW,
    updatedAt: NOW,
  });
  const ownerDoc = createBlankOwnerDoc('ws-1', 'owner-1', ownerBlob, {
    fileName: 'owner.pdf',
    mimeType: 'application/pdf',
    overrides: {
      id: 'owner-doc-1',
      leaseId: 'lease-1',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  const mapAsset = createBlankMapAsset('ws-1', mapBlob, {
    fileName: 'tract-map.pdf',
    mimeType: 'application/pdf',
    overrides: {
      id: 'map-1',
      title: 'Tract map',
      deskMapId: 'dm-1',
      nodeId: 'node-1',
      linkedOwnerId: 'owner-1',
      leaseId: 'lease-1',
      researchSourceId: 'source-1',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  const researchImport = createBlankResearchImport('ws-1', researchBlob, {
    fileName: 'research.pdf',
    mimeType: 'application/pdf',
    overrides: {
      id: 'import-1',
      title: 'Research packet',
      createdAt: NOW,
      updatedAt: NOW,
    },
  });
  const researchSource = createBlankResearchSource('ws-1', {
    id: 'source-1',
    title: 'Source 1',
    links: { ...createBlankResearchSource('ws-1').links, importId: 'import-1' },
    createdAt: NOW,
    updatedAt: NOW,
  });
  const researchProjectRecord = createBlankResearchProjectRecord('ws-1', {
    id: 'project-record-1',
    name: 'Research record',
    importId: 'import-1',
    createdAt: NOW,
    updatedAt: NOW,
  });

  const documentData: DocumentWorkspaceData = {
    documents: [
      {
        docId: 'doc-registry',
        workspaceId: 'ws-1',
        fileName: 'registry.pdf',
        mimeType: 'application/pdf',
        byteLength: registryBlob.size,
        contentHash: await sha256HexOfBlob(registryBlob),
        blob: registryBlob,
        kind: 'deed',
        displayTitle: 'Registry Deed',
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    attachments: [
      {
        attachmentId: 'att-registry',
        workspaceId: 'ws-1',
        docId: 'doc-registry',
        entityKind: 'node',
        entityId: 'node-1',
        position: 2,
        createdAt: NOW,
      },
    ],
  };
  const ownerData: OwnerWorkspaceData = {
    owners: [owner],
    leases: [lease],
    contacts: [],
    docs: [ownerDoc],
  };
  const mapData: MapWorkspaceData = {
    mapAssets: [mapAsset],
    mapRegions: [],
    mapReferences: [],
    tractFeatures: [],
  };
  const researchData: ResearchWorkspaceData = {
    imports: [researchImport],
    sources: [researchSource],
    formulas: [],
    projectRecords: [researchProjectRecord],
    questions: [],
  };
  const titleIssue: TitleIssue = {
    id: 'issue-1',
    workspaceId: 'ws-1',
    title: 'Unresolved probate',
    issueType: 'Probate / heirship',
    priority: 'High',
    status: 'Open',
    affectedDeskMapId: 'dm-1',
    affectedNodeId: 'node-1',
    affectedOwnerId: 'owner-1',
    affectedLeaseId: null,
    sourceDocNo: '',
    requiredCurativeAction: 'Find probate',
    responsibleParty: '',
    dueDate: '',
    notes: '',
    resolutionNotes: '',
    createdAt: NOW,
    updatedAt: NOW,
  };

  return {
    workspace,
    ownerData,
    documentData,
    mapData,
    researchData,
    curativeData: { titleIssues: [titleIssue] },
    generatedAt: NOW,
    projectId: 'project-1',
    landroidFileVersion: LANDROID_FILE_VERSION,
    syncState: 'local_only' as const,
  };
}

describe('evidence-vault project records', () => {
  it('projects registry, owner, map, and research files into shared document records', async () => {
    const input = await fixtureInput();
    const records = await buildEvidenceVaultRecordsFromWorkspace(input);

    expect(buildRecordValidationRequest(records).records).toHaveLength(records.length);
    expect(records.filter((record) => record.recordType === 'document')).toHaveLength(4);
    expect(records.filter((record) => record.recordType === 'document_version')).toHaveLength(4);
    expect(records.filter((record) => record.recordType === 'vault_object')).toHaveLength(4);

    const links = records.filter((record) => record.recordType === 'document_link');
    expect(links.map((link) => link.entityKind)).toEqual(
      expect.arrayContaining(['node', 'owner', 'lease', 'tract', 'research', 'import_row'])
    );
    expect(
      links.find((link) => link.recordId.includes('att-registry'))
    ).toMatchObject({
      entityKind: 'node',
      entityId: 'node-1',
      position: 2,
    });
    expect(
      links.find((link) => link.entityKind === 'tract')
    ).toMatchObject({
      entityId: 'tract-1',
      position: 0,
    });
    expect(records.some((record) => 'blob' in record)).toBe(false);
  });

  it('builds a record bundle with evidence-vault records and no v8 format bump', async () => {
    const input = await fixtureInput();
    const bundle = await buildProjectRecordsWithEvidenceVault(input);
    const manifest = bundle.records.find(
      (record) => record.recordType === 'workspace_manifest'
    );

    expect(manifest).toMatchObject({
      landroidFileVersion: LANDROID_FILE_VERSION,
      recordCounts: expect.objectContaining({
        document: 4,
        document_link: expect.any(Number),
        vault_object: 4,
      }),
    });
    expect(JSON.parse(JSON.stringify(bundle)).records).toHaveLength(
      bundle.records.length
    );
  });

  it('deleting document links leaves shared documents and surviving links intact', async () => {
    const input = await fixtureInput();
    const records = await buildEvidenceVaultRecordsFromWorkspace(input);
    const ownerDocId = stableRecordId('ws-1', 'document', 'owner_doc', 'owner-doc-1');
    const ownerLinks = records.filter(
      (record) => record.recordType === 'document_link' && record.documentId === ownerDocId
    );

    expect(ownerLinks).toHaveLength(2);
    const remaining = removeDocumentLinksFromRecords(records, [ownerLinks[0].recordId]);

    expect(
      remaining.some((record) => record.recordType === 'document' && record.recordId === ownerDocId)
    ).toBe(true);
    expect(
      remaining.filter(
        (record) => record.recordType === 'document_link' && record.documentId === ownerDocId
      )
    ).toHaveLength(1);
  });

  it('builds deterministic attorney packet manifests with checksums and sidecars', async () => {
    const input = await fixtureInput();
    const bundle = await buildProjectRecordsWithEvidenceVault(input);
    const documentId = stableRecordId('ws-1', 'document', 'doc-registry');
    const citation = BackendSpineCoreRecordSchema.parse({
      recordId: 'source-citation-1',
      recordType: 'source_citation',
      workspaceId: 'ws-1',
      projectId: 'project-1',
      schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
      lastModified: NOW,
      revision: 0,
      source: 'local',
      syncState: 'local_only',
      documentId,
      confidence: 'supported',
      pageNumber: 1,
    }) as BackendSpineCoreRecord;
    const records = [...bundle.records, citation];

    const first = await buildAttorneyPacketExport({
      records,
      packetId: 'attorney',
      title: 'Attorney packet',
      generatedAt: NOW,
      includeEdiscoverySidecars: true,
    });
    const second = await buildAttorneyPacketExport({
      records: [...records].reverse(),
      packetId: 'attorney',
      title: 'Attorney packet',
      generatedAt: NOW,
      includeEdiscoverySidecars: true,
    });

    expect(first.manifestHash).toBe(second.manifestHash);
    expect(first.manifestJson).toBe(second.manifestJson);
    expect(JSON.parse(first.manifestJson)).toMatchObject({
      manifestHash: first.manifestHash,
      checksumAlgorithm: 'sha256',
      unresolvedIssues: [
        expect.objectContaining({
          issueId: 'issue-1',
          status: 'open',
        }),
      ],
    });
    expect(first.sourceCitationSidecars).toEqual([
      {
        documentId,
        citations: [
          expect.objectContaining({
            sourceCitationId: 'source-citation-1',
            confidence: 'supported',
          }),
        ],
      },
    ]);
    expect(first.eDiscoverySidecars[0]).toMatchObject({
      controlNumber: 'DOC-000001',
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(
      first.records.map((record) => record.recordType)
    ).toEqual(expect.arrayContaining(['packet', 'packet_item', 'packet_export']));
  });
});
