import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CanvasSaveData } from '../../store/canvas-store';
import {
  createBlankMapAsset,
  createBlankMapExternalReference,
  createBlankMapRegion,
} from '../../types/map';
import { createBlankLease, createBlankOwner, createBlankOwnerDoc } from '../../types/owner';
import { createBlankLeasePurchaseReport } from '../../types/lease-purchase-report';
import { createBlankNode } from '../../types/node';
import { sha256HexOfBlob } from '../blob-hash';
import {
  createBlankResearchFormula,
  createBlankResearchImport,
  createBlankResearchProjectRecord,
  createBlankResearchQuestion,
  createBlankResearchSource,
} from '../../types/research';
import { createBlankTitleIssue } from '../../types/title-issue';
import {
  exportLandroidFile,
  importLandroidFile,
  LANDROID_FILE_VERSION,
  parsePersistedWorkspaceData,
  type LandroidFileData,
} from '../workspace-persistence';
import { parsePersistedCanvasData } from '../canvas-persistence';
import { recordTitleMutation } from '../../project-records/action-layer/title-command-sourcing';
import { verifyAuditChain } from '../../project-records/action-layer/audit-chain';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  titleContext,
  titleOwnerData,
  titleWorkspace,
} from '../../project-records/__tests__/title-cutover-fixtures';
import type { AuditEventRecord } from '../../backend-spine/contracts';

const TEST_PDF_BODY = '%PDF-1.7\n% LANDroid test PDF\n';

afterEach(() => {
  vi.restoreAllMocks();
});

function buildCanvas(): CanvasSaveData {
  return {
    nodes: [
      {
        id: 'flow-root',
        type: 'ownership',
        position: { x: 100, y: 40 },
        data: { label: 'Root' },
      },
    ],
    edges: [],
    viewport: { x: 12, y: 24, zoom: 0.75 },
    gridCols: 6,
    gridRows: 3,
    orientation: 'portrait',
    pageSize: 'ansi-b',
    horizontalSpacingFactor: 1.5,
    verticalSpacingFactor: 1.25,
    snapToGrid: true,
    gridSize: 24,
  };
}

function buildWorkspace(canvas: CanvasSaveData | null): LandroidFileData {
  const owner = createBlankOwner('ws-1', {
    id: 'owner-1',
    name: 'Pat Doe',
    county: 'Elmore',
  });
  const lease = createBlankLease('ws-1', owner.id, {
    id: 'lease-1',
    leaseName: 'Pat Doe Lease',
    lessee: 'Federal Lessee LLC',
  });
  const ownerDoc = createBlankOwnerDoc(
    'ws-1',
    owner.id,
    new Blob(['owner-doc-body'], { type: 'text/plain' }),
    {
      fileName: 'owner-notes.txt',
      mimeType: 'text/plain',
    }
  );
  const mapAsset = createBlankMapAsset(
    'ws-1',
    new Blob(['{"type":"FeatureCollection","features":[]}'], {
      type: 'application/geo+json',
    }),
    {
      fileName: 'tract.geojson',
      mimeType: 'application/geo+json',
      overrides: {
        title: 'Tract Map',
        linkedOwnerId: owner.id,
        county: 'Elmore',
        isFeatured: true,
      },
    }
  );
  const mapRegion = createBlankMapRegion('ws-1', mapAsset.id, {
    id: 'region-1',
    title: 'North Tract',
    linkedOwnerId: owner.id,
  });
  const mapReference = createBlankMapExternalReference('ws-1', {
    id: 'ref-1',
    assetId: mapAsset.id,
    regionId: mapRegion.id,
    label: 'RRC GIS',
    url: 'https://example.com/rrc',
  });
  const researchImport = createBlankResearchImport(
    'ws-1',
    new Blob(['api,data'], { type: 'text/csv' }),
    {
      fileName: 'production-dump.csv',
      mimeType: 'text/csv',
      datasetId: 'production-data-query-dump',
      overrides: {
        id: 'rrc-1',
        title: 'Production Dump',
      },
    }
  );
  const researchSource = createBlankResearchSource('ws-1', {
    id: 'source-1',
    title: 'Texas division order statute',
    sourceType: 'Statute',
    context: 'Texas',
    citation: 'Tex. Nat. Res. Code Sec. 91.402',
    links: {
      deskMapId: 'dm-1',
      nodeId: 'node-1',
      ownerId: owner.id,
      leaseId: 'lease-1',
      mapAssetId: mapAsset.id,
      mapRegionId: mapRegion.id,
      importId: researchImport.id,
    },
  });
  const researchFormula = createBlankResearchFormula('ws-1', {
    id: 'formula-1',
    title: 'Mineral owner royalty',
    category: 'Leasehold',
    status: 'Verified',
    formulaText: 'leased fraction x lease royalty',
    explanation: 'Calculates the royalty row before downstream burdens.',
    variables: 'leased fraction; lease royalty',
    example: '1/2 x 1/4 = 1/8',
    engineReference: 'src/components/leasehold/leasehold-summary.ts',
    sourceIds: [researchSource.id],
  });
  const researchProjectRecord = createBlankResearchProjectRecord('ws-1', {
    id: 'project-1',
    recordType: 'Federal Lease',
    jurisdiction: 'Federal / BLM',
    status: 'Current',
    acquisitionStatus: 'Held',
    name: 'Federal Lease NMNM 000000',
    serialOrReference: 'NMNM 000000',
    legacySerial: 'NMNM 000000',
    mlrsSerial: 'MLRS-000000',
    lesseeOrApplicant: 'Federal Lessee LLC',
    operator: 'Federal Operator LLC',
    state: 'NM',
    county: 'Eddy',
    prospectArea: 'Delaware North',
    effectiveDate: '2026-01-01',
    expirationDate: '2036-01-01',
    primaryTerm: '10 years',
    nextAction: 'Review BLM source packet before bid window.',
    nextActionDate: '2026-05-01',
    priority: 'High',
    sourcePacketStatus: 'Ready',
    acres: '640',
    legalDescription: 'Section 1',
    sourceIds: [researchSource.id],
    mapAssetId: mapAsset.id,
    mapRegionId: mapRegion.id,
    deskMapId: 'dm-1',
    nodeId: 'node-1',
    ownerId: owner.id,
    leaseId: 'lease-1',
    importId: researchImport.id,
  });
  const researchQuestion = createBlankResearchQuestion('ws-1', {
    id: 'question-1',
    question: 'What source supports the royalty formula?',
    answer: 'The formula card links to the saved source.',
    status: 'Answered',
    sourceIds: [researchSource.id],
    formulaIds: [researchFormula.id],
    projectRecordIds: [researchProjectRecord.id],
  });
  const titleIssue = createBlankTitleIssue('ws-1', {
    id: 'issue-1',
    title: 'Missing affidavit of heirship',
    issueType: 'Probate / heirship',
    priority: 'High',
    affectedDeskMapId: 'dm-1',
    affectedNodeId: 'node-1',
    affectedOwnerId: owner.id,
  });

  return {
    workspaceId: 'ws-1',
    projectName: 'Audit Roundtrip',
    nodes: [
      {
        ...createBlankNode('node-1'),
        type: 'related',
        attachments: [
          {
            docId: 'doc-fixture-1',
            attachmentId: 'att-fixture-1',
            fileName: '20260001.pdf',
            kind: 'deed',
          },
        ],
        linkedOwnerId: owner.id,
        linkedLeaseId: 'lease-1',
        relatedKind: 'lease',
      },
    ],
    deskMaps: [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: 'T1',
        grossAcres: '160',
        pooledAcres: '120',
        description: 'North half of Section 1',
        nodeIds: ['node-1'],
      },
    ],
    leaseholdUnit: {
      name: 'Raven Bend Unit',
      description: 'Five tract unit',
      operator: 'Operator A',
      effectiveDate: '2024-01-01',
      jurisdiction: 'tx_fee' as const,
    },
    leaseholdAssignments: [
      {
        id: 'assignment-1',
        assignor: 'Operator A',
        assignee: 'Unit Partner',
        scope: 'unit',
        unitCode: null,
        deskMapId: null,
        workingInterestFraction: '1/2',
        effectiveDate: '2024-03-01',
        sourceDocNo: 'ASG-1',
        notes: 'Starter WI split',
        depthRange: 'all_depths',
      },
    ],
    leaseholdOrris: [
      {
        id: 'orri-1',
        payee: 'Override Partners',
        scope: 'unit',
        unitCode: null,
        deskMapId: null,
        burdenFraction: '1/32',
        burdenBasis: 'gross_8_8',
        effectiveDate: '2024-02-01',
        sourceDocNo: 'ORRI-1',
        notes: 'Starter override',
        depthRange: 'all_depths',
      },
    ],
    leaseholdTransferOrderEntries: [
      {
        id: 'to-1',
        sourceRowId: 'royalty-dm-1-node-1',
        ownerNumber: '001',
        status: 'ready',
        notes: 'Ready for payout setup',
      },
    ],
    activeDeskMapId: 'dm-1',
    instrumentTypes: ['Deed'],
    canvas,
    documentData: {
      documents: [
        {
          docId: 'doc-fixture-1',
          workspaceId: 'ws-1',
          fileName: '20260001.pdf',
          mimeType: 'application/pdf',
          byteLength: TEST_PDF_BODY.length,
          contentHash: 'fixture-hash',
          blob: new Blob([TEST_PDF_BODY], { type: 'application/pdf' }),
          kind: 'deed',
          displayTitle: 'Recorded Mineral Deed',
          documentArea: 'runsheet_mineral_title',
          instrumentType: 'Mineral Deed',
          county: 'Elmore',
          instrumentNumber: '20260001',
          volume: '120',
          page: '44',
          effectiveDate: '2026-03-01',
          recordingDate: '2026-04-01',
          grantor: 'Pat Doe',
          grantee: 'Acme Minerals LLC',
          notes: 'Registry metadata round-trip fixture',
          sourceReference: 'TORS packet A',
          ocrStatus: 'not_needed',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          docId: 'doc-owner-attached',
          workspaceId: 'ws-1',
          fileName: 'owner-summary.pdf',
          mimeType: 'application/pdf',
          byteLength: TEST_PDF_BODY.length,
          contentHash: 'fixture-owner-hash',
          blob: new Blob([`${TEST_PDF_BODY}owner attachment\n`], {
            type: 'application/pdf',
          }),
          kind: 'other',
          displayTitle: 'Owner Summary',
          createdAt: '2026-04-02T00:00:00.000Z',
          updatedAt: '2026-04-02T00:00:00.000Z',
        },
        {
          docId: 'doc-unattached',
          workspaceId: 'ws-1',
          fileName: 'unattached-source.pdf',
          mimeType: 'application/pdf',
          byteLength: TEST_PDF_BODY.length,
          contentHash: 'fixture-unattached-hash',
          blob: new Blob([`${TEST_PDF_BODY}unattached document\n`], {
            type: 'application/pdf',
          }),
          kind: 'other',
          displayTitle: 'Unattached Source',
          createdAt: '2026-04-03T00:00:00.000Z',
          updatedAt: '2026-04-03T00:00:00.000Z',
        },
      ],
      attachments: [
        {
          attachmentId: 'att-fixture-1',
          workspaceId: 'ws-1',
          docId: 'doc-fixture-1',
          entityKind: 'node',
          entityId: 'node-1',
          position: 0,
          createdAt: '2026-04-01T00:00:00.000Z',
        },
        {
          attachmentId: 'att-owner-fixture',
          workspaceId: 'ws-1',
          docId: 'doc-owner-attached',
          entityKind: 'owner',
          entityId: 'owner-1',
          position: 0,
          createdAt: '2026-04-02T00:00:00.000Z',
        },
      ],
    },
    ownerData: {
      owners: [owner],
      leases: [lease],
      contacts: [],
      docs: [ownerDoc],
    },
    mapData: {
      mapAssets: [mapAsset],
      mapRegions: [mapRegion],
      mapReferences: [mapReference],
    },
    researchData: {
      imports: [researchImport],
      sources: [researchSource],
      formulas: [researchFormula],
      projectRecords: [researchProjectRecord],
      questions: [researchQuestion],
    },
    curativeData: {
      titleIssues: [titleIssue],
    },
  };
}

function titleImportSafeWorkspace() {
  const workspace = titleWorkspace();
  const nodes = workspace.nodes.filter((node) => node.type !== 'related');
  return {
    ...workspace,
    nodes,
    deskMaps: workspace.deskMaps.map((deskMap) => ({
      ...deskMap,
      nodeIds: deskMap.nodeIds.filter((nodeId) =>
        nodes.some((node) => node.id === nodeId)
      ),
    })),
  };
}

async function buildSyntheticTitleLedger() {
  const result = await recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'system',
    approvedBy: 'system',
    context: titleContext(),
    appliedAt: TITLE_NOW,
    beforeWorkspace: emptyTitleWorkspace(),
    afterWorkspace: titleImportSafeWorkspace(),
    ownerData: titleOwnerData(),
  });
  return {
    actionRecords: [result.actionRecord],
    auditEvents: [result.auditEvent],
  };
}

function titleLandroidData(): LandroidFileData {
  const ownerData = titleOwnerData();
  return {
    ...titleImportSafeWorkspace(),
    ownerData: {
      ...ownerData,
      contacts: [],
      docs: [],
    },
  };
}

/**
 * A minimal v8 `.landroid` payload carrying one node, one valid-PDF document
 * with a caller-controlled recorded `contentHash`, and one node attachment.
 * Used by the DA-H7 fixity tests to drive the import re-hash path.
 */
function v8SingleDocPayload({
  fileName,
  contentHash,
}: {
  fileName: string;
  contentHash: string;
}) {
  return {
    version: 8,
    workspaceId: 'ws-fixity',
    projectName: 'Fixity',
    nodes: [createBlankNode('node-fixity')],
    deskMaps: [],
    activeDeskMapId: null,
    instrumentTypes: [],
    documentData: {
      documents: [
        {
          docId: 'doc-fixity',
          workspaceId: 'ws-fixity',
          fileName,
          mimeType: 'application/pdf',
          byteLength: TEST_PDF_BODY.length,
          contentHash,
          blob: { base64: btoa(TEST_PDF_BODY), mimeType: 'application/pdf' },
          kind: 'deed',
          createdAt: '2026-05-17T00:00:00.000Z',
          updatedAt: '2026-05-17T00:00:00.000Z',
        },
      ],
      attachments: [
        {
          attachmentId: 'att-fixity',
          workspaceId: 'ws-fixity',
          docId: 'doc-fixity',
          entityKind: 'node',
          entityId: 'node-fixity',
          position: 0,
          createdAt: '2026-05-17T00:00:00.000Z',
        },
      ],
    },
  };
}

describe('workspace-persistence', () => {
  it('round-trips Lease Purchase Reports and lease slice acre/term fields', async () => {
    const original = buildWorkspace(null);
    const lpr = createBlankLeasePurchaseReport('ws-1', 'owner-1', {
      id: 'lpr-1',
      lesseeName: 'Magnolia Petroleum Company, LLC',
      royalty: '1/4',
      primaryTerm: 'one year',
      leaseForm: 'Producers 88 (7-69)',
    });
    const withLpr: LandroidFileData = {
      ...original,
      ownerData: {
        ...original.ownerData!,
        leases: original.ownerData!.leases.map((lease) => ({
          ...lease,
          leasePurchaseReportId: 'lpr-1',
          grossAcres: '35.92',
          leasedInterest: '0.5',
        })),
        leasePurchaseReports: [lpr],
      },
    };

    const blob = await exportLandroidFile(withLpr);
    const file = new File([await blob.text()], 'lpr.landroid', {
      type: 'application/json',
    });
    const imported = await importLandroidFile(file);

    expect(imported.ownerData?.leasePurchaseReports).toEqual([
      expect.objectContaining({
        id: 'lpr-1',
        royalty: '1/4',
        leaseForm: 'Producers 88 (7-69)',
        primaryTerm: 'one year',
      }),
    ]);
    const lease = imported.ownerData?.leases.find((entry) => entry.id === 'lease-1');
    expect(lease).toMatchObject({
      leasePurchaseReportId: 'lpr-1',
      grossAcres: '35.92',
      netAcres: '17.96',
    });
  });

  it('round-trips a multi-tract LPR with provisions and attachments across three slices', async () => {
    const original = buildWorkspace(null);
    const lpr = createBlankLeasePurchaseReport('ws-1', 'owner-1', {
      id: 'lpr-multi',
      lesseeName: 'Magnolia Petroleum Company, LLC',
      royalty: '1/5',
      legalDescription: 'Tracts 1-3, Dr. Elmore #1 Unit',
      preparedBy: 'J. Landman',
      preparedDate: '2026-06-09',
      provisions: [
        { key: 'pugh_acreage_release', present: true, paragraph: '14' },
        { key: 'shut_in_royalty', present: true, paragraph: '6' },
      ],
      attachments: ['original_lease', 'copy_check'],
    });
    const slices = ['tract-1', 'tract-2', 'tract-3'].map((id) =>
      createBlankLease('ws-1', 'owner-1', {
        id,
        leaseName: `${id} Lease`,
        leasePurchaseReportId: 'lpr-multi',
        leasedInterest: '0.5',
        grossAcres: '40',
        royaltyRate: '1/5',
      })
    );
    const withMulti: LandroidFileData = {
      ...original,
      ownerData: {
        ...original.ownerData!,
        leases: slices,
        leasePurchaseReports: [lpr],
      },
    };

    const blob = await exportLandroidFile(withMulti);
    const file = new File([await blob.text()], 'lpr-multi.landroid', {
      type: 'application/json',
    });
    const imported = await importLandroidFile(file);

    expect(imported.ownerData?.leasePurchaseReports?.[0]).toMatchObject({
      id: 'lpr-multi',
      legalDescription: 'Tracts 1-3, Dr. Elmore #1 Unit',
      preparedBy: 'J. Landman',
      provisions: [
        { key: 'pugh_acreage_release', present: true, paragraph: '14' },
        { key: 'shut_in_royalty', present: true, paragraph: '6' },
      ],
      attachments: ['original_lease', 'copy_check'],
    });
    const importedSlices = (imported.ownerData?.leases ?? []).filter(
      (entry) => entry.leasePurchaseReportId === 'lpr-multi'
    );
    expect(importedSlices).toHaveLength(3);
    expect(importedSlices.every((entry) => entry.netAcres === '20')).toBe(true);
  });

  it('round-trips canvas state through .landroid export/import', async () => {
    const original = buildWorkspace(buildCanvas());
    const blob = await exportLandroidFile(original);
    const file = new File([await blob.text()], 'audit.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.projectName).toBe(original.projectName);
    expect(imported.workspaceId).toBe(original.workspaceId);
    expect(imported.nodes).toEqual(original.nodes);
    expect(imported.deskMaps).toEqual(original.deskMaps);
    expect(imported.leaseholdUnit).toEqual(original.leaseholdUnit);
    expect(imported.leaseholdAssignments).toEqual(original.leaseholdAssignments);
    expect(imported.leaseholdOrris).toEqual(original.leaseholdOrris);
    expect(imported.leaseholdTransferOrderEntries).toEqual(
      original.leaseholdTransferOrderEntries
    );
    expect(imported.canvas).toEqual(original.canvas);
    const importedDocumentsById = new Map(
      imported.documentData?.documents.map((document) => [document.docId, document])
    );
    const importedAttachments = imported.documentData?.attachments ?? [];
    expect([...importedDocumentsById.keys()].sort()).toEqual([
      'doc-fixture-1',
      'doc-owner-attached',
      'doc-unattached',
    ]);
    expect(importedDocumentsById.get('doc-fixture-1')?.fileName).toBe('20260001.pdf');
    expect(importedDocumentsById.get('doc-fixture-1')).toMatchObject({
      displayTitle: 'Recorded Mineral Deed',
      documentArea: 'runsheet_mineral_title',
      instrumentType: 'Mineral Deed',
      county: 'Elmore',
      instrumentNumber: '20260001',
      volume: '120',
      page: '44',
      effectiveDate: '2026-03-01',
      recordingDate: '2026-04-01',
      grantor: 'Pat Doe',
      grantee: 'Acme Minerals LLC',
      notes: 'Registry metadata round-trip fixture',
      sourceReference: 'TORS packet A',
      ocrStatus: 'not_needed',
    });
    expect(await importedDocumentsById.get('doc-fixture-1')?.blob.text()).toBe(
      TEST_PDF_BODY
    );
    expect(importedAttachments).toContainEqual(expect.objectContaining({
      attachmentId: 'att-fixture-1',
      workspaceId: 'ws-1',
      docId: 'doc-fixture-1',
      entityKind: 'node',
      entityId: 'node-1',
      position: 0,
    }));
    expect(importedAttachments).toContainEqual(expect.objectContaining({
      attachmentId: 'att-owner-fixture',
      workspaceId: 'ws-1',
      docId: 'doc-owner-attached',
      entityKind: 'owner',
      entityId: 'owner-1',
      position: 0,
    }));
    expect(
      importedAttachments.filter((attachment) => attachment.docId === 'doc-unattached')
    ).toHaveLength(0);
    expect(imported.ownerData?.owners).toEqual(original.ownerData?.owners);
    expect(imported.ownerData?.docs[0]?.fileName).toBe('owner-notes.txt');
    expect(await imported.ownerData?.docs[0]?.blob.text()).toBe('owner-doc-body');
    expect(imported.mapData?.mapAssets[0]?.title).toBe('Tract Map');
    expect(imported.mapData?.mapAssets[0]?.isFeatured).toBe(true);
    expect(imported.mapData?.mapRegions[0]?.title).toBe('North Tract');
    expect(imported.mapData?.mapRegions[0]?.linkedOwnerId).toBe('owner-1');
    expect(imported.mapData?.mapReferences[0]?.label).toBe('RRC GIS');
    expect(imported.researchData?.imports[0]?.datasetId).toBe(
      'production-data-query-dump'
    );
    expect(imported.researchData?.sources[0]?.links.mapAssetId).toBe(
      original.researchData?.sources[0]?.links.mapAssetId
    );
    expect(imported.researchData?.formulas[0]?.sourceIds).toEqual(['source-1']);
    expect(imported.researchData?.projectRecords[0]?.recordType).toBe('Federal Lease');
    expect(imported.researchData?.projectRecords[0]).toMatchObject({
      legacySerial: 'NMNM 000000',
      mlrsSerial: 'MLRS-000000',
      lesseeOrApplicant: 'Federal Lessee LLC',
      operator: 'Federal Operator LLC',
      state: 'NM',
      county: 'Eddy',
      prospectArea: 'Delaware North',
      effectiveDate: '2026-01-01',
      expirationDate: '2036-01-01',
      primaryTerm: '10 years',
      nextAction: 'Review BLM source packet before bid window.',
      nextActionDate: '2026-05-01',
      priority: 'High',
      sourcePacketStatus: 'Ready',
      deskMapId: 'dm-1',
      nodeId: 'node-1',
      ownerId: 'owner-1',
      leaseId: 'lease-1',
      importId: 'rrc-1',
    });
    expect(imported.researchData?.questions[0]?.projectRecordIds).toEqual([
      'project-1',
    ]);
    expect(imported.curativeData?.titleIssues[0]).toEqual(
      expect.objectContaining({
        id: 'issue-1',
        title: 'Missing affidavit of heirship',
        priority: 'High',
      })
    );
    expect(await imported.researchData?.imports[0]?.blob.text()).toBe('api,data');
    expect(await imported.mapData?.mapAssets[0]?.blob.text()).toContain('FeatureCollection');
  });

  it('round-trips canvas image assets (bytes + content hash) through export/import', async () => {
    const imageBytes = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], {
      type: 'image/png',
    });
    const contentHash = await sha256HexOfBlob(imageBytes);
    const original = buildWorkspace(buildCanvas());
    original.canvasAssetData = {
      assets: [
        {
          id: contentHash,
          workspaceId: 'ws-1',
          contentHash,
          mimeType: 'image/png',
          byteLength: imageBytes.size,
          fileName: 'seal.png',
          createdAt: '2026-04-01T00:00:00.000Z',
          blob: imageBytes,
        },
      ],
    };

    const blob = await exportLandroidFile(original);
    const file = new File([await blob.text()], 'audit.landroid', {
      type: 'application/json',
    });
    const imported = await importLandroidFile(file);

    expect(imported.canvasAssetData?.assets).toHaveLength(1);
    const asset = imported.canvasAssetData?.assets[0];
    expect(asset?.contentHash).toBe(contentHash);
    expect(asset?.mimeType).toBe('image/png');
    expect(asset?.fileName).toBe('seal.png');
    expect(new Uint8Array(await asset!.blob.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    );
  });

  it('imports a .landroid that lacks canvasAssetData as an empty asset set', async () => {
    const original = buildWorkspace(buildCanvas());
    const payload = JSON.parse(await (await exportLandroidFile(original)).text());
    delete payload.canvasAssetData;
    const file = new File([JSON.stringify(payload)], 'legacy.landroid', {
      type: 'application/json',
    });
    const imported = await importLandroidFile(file);
    expect(imported.canvasAssetData).toEqual({ assets: [] });
  });

  it('round-trips a v9 action ledger without making it authoritative', async () => {
    const original = titleLandroidData();
    const ledger = await buildSyntheticTitleLedger();
    const snapshotOnlyKeys = Object.keys(
      JSON.parse(await (await exportLandroidFile(original)).text())
    );
    const blob = await exportLandroidFile(original, ledger);
    const text = await blob.text();
    const parsed = JSON.parse(text);
    const file = new File([text], 'title-ledger.landroid', {
      type: 'application/json',
    });

    expect(parsed.version).toBe(9);
    expect(Object.keys(parsed).filter((key) => !snapshotOnlyKeys.includes(key))).toEqual([
      'actionLedger',
    ]);
    expect(parsed.actionLedger).toBeDefined();
    expect(parsed.actionLedger.workspaceId).toBe(original.workspaceId);
    expect(parsed.actionLedger.projectId).toBe(original.workspaceId);
    expect(parsed.actionLedger.generatedAt).toBe(parsed.exportedAt);
    expect(
      parsed.actionLedger.records.map((record: { recordType: string }) => record.recordType)
    ).toEqual(['action_record', 'audit_event']);

    const imported = await importLandroidFile(file);
    const importedAuditEvents =
      imported.actionLedger?.records.filter(
        (record): record is AuditEventRecord => record.recordType === 'audit_event'
      ) ?? [];

    expect(imported.nodes).toEqual(original.nodes);
    expect(imported.actionLedger?.records).toEqual([
      ...ledger.actionRecords,
      ...ledger.auditEvents,
    ]);
    expect((await verifyAuditChain(importedAuditEvents)).valid).toBe(true);
  });

  it('imports a v8 payload without an action ledger', async () => {
    const payload = {
      version: 8,
      workspaceId: 'ws-v8',
      projectName: 'v8 Read Compatibility',
      nodes: [createBlankNode('node-v8')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: ['Deed'],
      documentData: { documents: [], attachments: [] },
    };
    const file = new File([JSON.stringify(payload)], 'v8.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.projectName).toBe('v8 Read Compatibility');
    expect(imported.actionLedger).toBeUndefined();
  });

  it('drops a schema-invalid v9 action ledger and still returns the snapshot', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const payload = {
      version: 9,
      workspaceId: 'ws-invalid-ledger',
      projectName: 'Invalid Ledger',
      nodes: [createBlankNode('node-invalid-ledger')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: ['Deed'],
      documentData: { documents: [], attachments: [] },
      actionLedger: {
        workspaceId: 'ws-invalid-ledger',
        projectId: 'ws-invalid-ledger',
        generatedAt: '2026-06-02T00:00:00.000Z',
        records: [],
      },
    };
    const file = new File([JSON.stringify(payload)], 'bad-ledger.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.projectName).toBe('Invalid Ledger');
    expect(imported.nodes).toHaveLength(1);
    expect(imported.actionLedger).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Dropping invalid actionLedger')
    );
  });

  it('drops a chain-broken v9 action ledger and still returns the snapshot', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ledger = await buildSyntheticTitleLedger();
    const blob = await exportLandroidFile(titleLandroidData(), ledger);
    const payload = JSON.parse(await blob.text());
    const auditIndex = payload.actionLedger.records.findIndex(
      (record: { recordType: string }) => record.recordType === 'audit_event'
    );
    payload.actionLedger.records[auditIndex] = {
      ...payload.actionLedger.records[auditIndex],
      eventKind: 'tampered',
    };
    const file = new File([JSON.stringify(payload)], 'broken-ledger.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.projectName).toBe(titleImportSafeWorkspace().projectName);
    expect(imported.nodes).toEqual(titleImportSafeWorkspace().nodes);
    expect(imported.actionLedger).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('audit chain failed'));
  });

  it('keeps backward compatibility when older files omit canvas state', async () => {
    const legacyPayload = {
      version: 1,
      workspaceId: 'ws-legacy',
      projectName: 'Legacy Workspace',
      nodes: [createBlankNode('node-1')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: ['Deed'],
    };
    const file = new File([JSON.stringify(legacyPayload)], 'legacy.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.projectName).toBe('Legacy Workspace');
    expect(imported.canvas).toBeNull();
    expect(imported.ownerData).toEqual({
      owners: [],
      leases: [],
      contacts: [],
      docs: [],
    });
    expect(imported.mapData).toEqual({
      mapAssets: [],
      mapRegions: [],
      mapReferences: [],
    });
    expect(imported.researchData).toEqual({
      imports: [],
      sources: [],
      formulas: [],
      projectRecords: [],
      questions: [],
    });
    expect(imported.curativeData).toEqual({ titleIssues: [] });
    expect(imported.documentData).toEqual({ documents: [], attachments: [] });
    expect(imported.leaseholdUnit).toEqual({
      name: '',
      description: '',
      operator: '',
      effectiveDate: '',
      jurisdiction: 'tx_fee',
    });
    expect(imported.leaseholdAssignments).toEqual([]);
    expect(imported.leaseholdOrris).toEqual([]);
    expect(imported.leaseholdTransferOrderEntries).toEqual([]);
    expect(imported.nodes[0]?.linkedOwnerId).toBeNull();
    expect(imported.nodes[0]?.linkedLeaseId).toBeNull();
    expect(imported.nodes[0]?.relatedKind).toBeNull();
    expect(imported.nodes[0]?.interestClass).toBe('mineral');
    expect(imported.nodes[0]?.royaltyKind).toBeNull();
  });

  it('imports a legacy v6 .landroid with no PDF payload as empty documentData', async () => {
    const payload = {
      version: 6,
      workspaceId: 'ws-missing-pdf',
      projectName: 'Missing PDF',
      nodes: [
        {
          ...createBlankNode('node-with-missing-pdf'),
        },
      ],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    };
    const file = new File([JSON.stringify(payload)], 'missing-pdf.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.nodes[0]?.attachments).toEqual([]);
    expect(imported.documentData).toEqual({ documents: [], attachments: [] });
  });

  it('migrates a v7 .landroid PDF payload inline into v8 documents + attachments', async () => {
    const v7Pdf = {
      nodeId: 'node-v7',
      fileName: 'oldfile.pdf',
      mimeType: 'application/pdf',
      blob: { base64: btoa(TEST_PDF_BODY), mimeType: 'application/pdf' },
      createdAt: '2025-12-01T00:00:00.000Z',
    };
    const payload = {
      version: 7,
      workspaceId: 'ws-v7',
      projectName: 'Legacy v7',
      nodes: [createBlankNode('node-v7')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
      pdfData: { pdfs: [v7Pdf] },
    };
    const file = new File([JSON.stringify(payload)], 'legacy.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.documentData?.documents).toHaveLength(1);
    expect(imported.documentData?.documents[0]).toMatchObject({
      workspaceId: 'ws-v7',
      fileName: 'oldfile.pdf',
      mimeType: 'application/pdf',
      kind: 'other',
    });
    expect(await imported.documentData?.documents[0]?.blob.text()).toBe(TEST_PDF_BODY);
    expect(imported.documentData?.attachments).toHaveLength(1);
    expect(imported.documentData?.attachments[0]).toMatchObject({
      entityKind: 'node',
      entityId: 'node-v7',
      workspaceId: 'ws-v7',
      position: 0,
      docId: imported.documentData?.documents[0]?.docId,
    });
  });

  it('recomputes the document hash on import and warns on a fixity mismatch (DA-H7)', async () => {
    const realHash = await sha256HexOfBlob(
      new Blob([TEST_PDF_BODY], { type: 'application/pdf' })
    );
    const payload = v8SingleDocPayload({
      fileName: 'tampered.pdf',
      contentHash: 'tampered-deadbeef',
    });
    const file = new File([JSON.stringify(payload)], 'tampered.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    // Recorded hash was a lie; recomputed digest wins.
    expect(imported.documentData?.documents[0]?.contentHash).toBe(realHash);
    // ...and the operator is warned, with the file named.
    expect(imported.documentFixityWarning).toBeTruthy();
    expect(imported.documentFixityWarning).toContain('tampered.pdf');
    expect(imported.documentFixityWarning).toContain('fixity');
  });

  it('heals a blank legacy document hash on import without warning (DA-H7)', async () => {
    const realHash = await sha256HexOfBlob(
      new Blob([TEST_PDF_BODY], { type: 'application/pdf' })
    );
    const payload = v8SingleDocPayload({ fileName: 'legacy.pdf', contentHash: '' });
    const file = new File([JSON.stringify(payload)], 'legacy-blank.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.documentData?.documents[0]?.contentHash).toBe(realHash);
    // A blank hash is an unhashed legacy import, not a mismatch — no warning.
    expect(imported.documentFixityWarning).toBeUndefined();
  });

  it('does not warn when the recorded document hash already matches (DA-H7)', async () => {
    const realHash = await sha256HexOfBlob(
      new Blob([TEST_PDF_BODY], { type: 'application/pdf' })
    );
    const payload = v8SingleDocPayload({
      fileName: 'good.pdf',
      contentHash: realHash,
    });
    const file = new File([JSON.stringify(payload)], 'good.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.documentData?.documents[0]?.contentHash).toBe(realHash);
    expect(imported.documentFixityWarning).toBeUndefined();
  });

  it('recomputes the document hash on export so the file is self-consistent (DA-H7)', async () => {
    const realHash = await sha256HexOfBlob(
      new Blob([TEST_PDF_BODY], { type: 'application/pdf' })
    );
    const data = buildWorkspace(null);
    // Poison the in-memory stored hash; export must still write the real one.
    data.documentData!.documents[0]!.contentHash = 'stale-stored-hash';

    const blob = await exportLandroidFile(data);
    const serialized = JSON.parse(await blob.text());

    expect(serialized.documentData.documents[0].contentHash).toBe(realHash);
  });

  it('rejects v8 document blobs that claim PDF MIME without PDF bytes', async () => {
    const payload = {
      version: 8,
      workspaceId: 'ws-bad-doc',
      projectName: 'Bad Document',
      nodes: [createBlankNode('node-bad-doc')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
      documentData: {
        documents: [
          {
            docId: 'doc-bad',
            workspaceId: 'ws-bad-doc',
            fileName: 'evil.pdf',
            mimeType: 'application/pdf',
            byteLength: 31,
            contentHash: 'bad',
            blob: {
              base64: btoa('<script>alert("owned")</script>'),
              mimeType: 'application/pdf',
            },
            kind: 'deed',
            createdAt: '2026-05-17T00:00:00.000Z',
            updatedAt: '2026-05-17T00:00:00.000Z',
          },
        ],
        attachments: [
          {
            attachmentId: 'att-bad',
            workspaceId: 'ws-bad-doc',
            docId: 'doc-bad',
            entityKind: 'node',
            entityId: 'node-bad-doc',
            position: 0,
            createdAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      },
    };
    const file = new File([JSON.stringify(payload)], 'bad.landroid', {
      type: 'application/json',
    });

    await expect(importLandroidFile(file)).rejects.toThrow(/valid PDF file/i);
  });

  it('writes version 9 in the export payload without an empty action ledger', async () => {
    const original = buildWorkspace(buildCanvas());
    const blob = await exportLandroidFile(original);
    const parsed = JSON.parse(await blob.text());
    expect(parsed.version).toBe(9);
    // The legacy v7 `pdfData` slot is gone in v8.
    expect(parsed.pdfData).toBeUndefined();
    expect(parsed.documentData).toBeDefined();
    expect(parsed.actionLedger).toBeUndefined();
  });

  it('rejects .landroid files from a newer schema version before normalization', async () => {
    const payload = {
      version: 10,
      workspaceId: 'ws-future',
      projectName: 'Future Workspace',
      nodes: 'not-normalizable',
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    };
    const file = new File([JSON.stringify(payload)], 'future.landroid', {
      type: 'application/json',
    });

    await expect(importLandroidFile(file)).rejects.toThrow(
      `Unsupported .landroid file version ${LANDROID_FILE_VERSION + 1}`
    );
  });

  it('rejects a non-numeric version that carries v8+ document data (DA-L8 bypass)', async () => {
    const payload = {
      version: '99',
      workspaceId: 'ws-bypass',
      projectName: 'Bypass',
      nodes: [createBlankNode('node-a')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
      documentData: { documents: [], attachments: [] },
    };
    const file = new File([JSON.stringify(payload)], 'bypass.landroid', {
      type: 'application/json',
    });

    await expect(importLandroidFile(file)).rejects.toThrow(/numeric version/);
  });

  it('rejects a missing version that carries an action ledger (DA-L8 bypass)', async () => {
    const payload = {
      workspaceId: 'ws-bypass-2',
      projectName: 'Bypass 2',
      nodes: [createBlankNode('node-a')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
      actionLedger: { records: [], auditEvents: [] },
    };
    const file = new File([JSON.stringify(payload)], 'bypass-2.landroid', {
      type: 'application/json',
    });

    await expect(importLandroidFile(file)).rejects.toThrow(/numeric version/);
  });

  it('still imports a genuine version-less legacy file with no v8+ markers (DA-L8)', async () => {
    const payload = {
      workspaceId: 'ws-legacy-noversion',
      projectName: 'Legacy No Version',
      nodes: [createBlankNode('node-legacy')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    };
    const file = new File([JSON.stringify(payload)], 'legacy-noversion.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);
    expect(imported.workspaceId).toBe('ws-legacy-noversion');
  });

  it('normalizes legacy imported leases that predate royalty and leased-interest fields', async () => {
    const legacyPayload = {
      version: 3,
      workspaceId: 'ws-legacy-lease',
      projectName: 'Legacy Lease Workspace',
      nodes: [createBlankNode('node-legacy')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: ['Oil & Gas Lease'],
      ownerData: {
        owners: [],
        leases: [
          {
            id: 'lease-legacy',
            workspaceId: 'ws-legacy-lease',
            ownerId: 'owner-1',
            leaseName: 'Legacy Lease',
            lessee: 'Acme Energy',
            effectiveDate: '2026-03-30',
            expirationDate: '',
            docNo: '1234',
            notes: '',
            createdAt: '2026-03-30T00:00:00.000Z',
            updatedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
        contacts: [],
        docs: [],
      },
    };
    const file = new File([JSON.stringify(legacyPayload)], 'legacy-lease.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.ownerData?.leases).toEqual([
      expect.objectContaining({
        id: 'lease-legacy',
        royaltyRate: '',
        leasedInterest: '',
        status: 'Active',
      }),
    ]);
  });

  it('keeps version 2 map files compatible when regions/references are missing', async () => {
    const v2Payload = {
      version: 2,
      workspaceId: 'ws-v2',
      projectName: 'Map Upgrade',
      nodes: [createBlankNode('node-2')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
      mapData: {
        mapAssets: [
          {
            ...createBlankMapAsset(
              'ws-v2',
              new Blob(['legacy map'], { type: 'application/pdf' }),
              {
                fileName: 'legacy.pdf',
                mimeType: 'application/pdf',
                overrides: {
                  id: 'legacy-map',
                  title: 'Legacy Map',
                },
              }
            ),
            blob: {
              base64: 'bGVnYWN5IG1hcA==',
              mimeType: 'application/pdf',
            },
          },
        ],
      },
    };
    const file = new File([JSON.stringify(v2Payload)], 'legacy-map.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.mapData?.mapAssets[0]?.title).toBe('Legacy Map');
    expect(imported.mapData?.mapRegions).toEqual([]);
    expect(imported.mapData?.mapReferences).toEqual([]);
    expect(await imported.mapData?.mapAssets[0]?.blob.text()).toBe('legacy map');
  });

  it('sanitizes imported links and malformed optional payloads', async () => {
    const payload = {
      version: 4,
      workspaceId: 'ws-safe',
      projectName: 'Safety Check',
      nodes: [createBlankNode('node-1')],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['node-1', 'missing-node', 42],
        },
      ],
      activeDeskMapId: 'dm-1',
      instrumentTypes: ['Deed', 5, null],
      canvas: {
        nodes: 'bad',
        edges: null,
        viewport: { x: 12, y: 24, zoom: 0.75 },
        gridCols: 6,
      },
      mapData: {
        mapAssets: [],
        mapRegions: [],
        mapReferences: [
          {
            id: 'ref-unsafe',
            workspaceId: 'ws-safe',
            assetId: null,
            regionId: null,
            source: 'RRC Download',
            label: 'Blocked link',
            url: 'javascript:alert(1)',
            notes: 'bad',
            createdAt: '2026-03-29T00:00:00.000Z',
            updatedAt: '2026-03-29T00:00:00.000Z',
          },
          {
            id: 'ref-domain',
            workspaceId: 'ws-safe',
            assetId: null,
            regionId: null,
            source: 'Manual',
            label: 'Plain domain',
            url: 'rrc.texas.gov/resource-center',
            notes: '',
            createdAt: '2026-03-29T00:00:00.000Z',
            updatedAt: '2026-03-29T00:00:00.000Z',
          },
        ],
      },
      researchData: {
        sources: [
          createBlankResearchSource('ws-safe', {
            id: 'source-stale',
            title: 'Stale source links',
            links: {
              deskMapId: 'missing-dm',
              nodeId: 'missing-node',
              ownerId: 'missing-owner',
              leaseId: 'missing-lease',
              mapAssetId: 'missing-map',
              mapRegionId: 'missing-region',
              importId: 'missing-import',
            },
          }),
        ],
        formulas: [
          createBlankResearchFormula('ws-safe', {
            id: 'formula-stale',
            title: 'Stale formula source',
            sourceIds: ['source-stale', 'missing-source'],
          }),
        ],
        projectRecords: [
          createBlankResearchProjectRecord('ws-safe', {
            id: 'project-stale',
            sourceIds: ['source-stale', 'missing-source'],
            mapAssetId: 'missing-map',
            mapRegionId: 'missing-region',
            deskMapId: 'missing-dm',
            nodeId: 'missing-node',
            ownerId: 'missing-owner',
            leaseId: 'missing-lease',
            importId: 'missing-import',
          }),
        ],
        questions: [
          createBlankResearchQuestion('ws-safe', {
            id: 'question-stale',
            sourceIds: ['source-stale', 'missing-source'],
            formulaIds: ['formula-stale', 'missing-formula'],
            projectRecordIds: ['project-stale', 'missing-project'],
          }),
        ],
      },
      curativeData: {
        titleIssues: [
          createBlankTitleIssue('ws-safe', {
            id: 'issue-stale',
            title: 'Stale import link',
            affectedDeskMapId: 'missing-dm',
            affectedNodeId: 'missing-node',
            affectedOwnerId: 'missing-owner',
            affectedLeaseId: 'missing-lease',
          }),
        ],
      },
    };
    const file = new File([JSON.stringify(payload)], 'sanitized.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.deskMaps).toEqual([
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: 'T1',
        grossAcres: '',
        pooledAcres: '',
        description: '',
        nodeIds: ['node-1'],
      },
    ]);
    expect(imported.leaseholdUnit).toEqual({
      name: '',
      description: '',
      operator: '',
      effectiveDate: '',
      jurisdiction: 'tx_fee',
    });
    expect(imported.leaseholdAssignments).toEqual([]);
    expect(imported.leaseholdOrris).toEqual([]);
    expect(imported.leaseholdTransferOrderEntries).toEqual([]);
    expect(imported.instrumentTypes).toEqual(['Deed']);
    expect(imported.canvas).toEqual({
      nodes: [],
      edges: [],
      viewport: { x: 12, y: 24, zoom: 0.75 },
      gridCols: 6,
    });
    expect(imported.mapData?.mapReferences[0]?.url).toBe('');
    expect(imported.mapData?.mapReferences[1]?.url).toBe(
      'https://rrc.texas.gov/resource-center'
    );
    expect(imported.researchData?.sources[0]?.links).toEqual({
      deskMapId: null,
      nodeId: null,
      ownerId: null,
      leaseId: null,
      mapAssetId: null,
      mapRegionId: null,
      importId: null,
    });
    expect(imported.researchData?.formulas[0]?.sourceIds).toEqual(['source-stale']);
    expect(imported.researchData?.projectRecords[0]?.sourceIds).toEqual([
      'source-stale',
    ]);
    expect(imported.researchData?.projectRecords[0]?.mapAssetId).toBeNull();
    expect(imported.researchData?.projectRecords[0]?.mapRegionId).toBeNull();
    expect(imported.researchData?.projectRecords[0]?.deskMapId).toBeNull();
    expect(imported.researchData?.projectRecords[0]?.nodeId).toBeNull();
    expect(imported.researchData?.projectRecords[0]?.ownerId).toBeNull();
    expect(imported.researchData?.projectRecords[0]?.leaseId).toBeNull();
    expect(imported.researchData?.projectRecords[0]?.importId).toBeNull();
    expect(imported.researchData?.questions[0]?.formulaIds).toEqual([
      'formula-stale',
    ]);
    expect(imported.researchData?.questions[0]?.projectRecordIds).toEqual([
      'project-stale',
    ]);
    expect(imported.curativeData?.titleIssues[0]).toEqual(
      expect.objectContaining({
        id: 'issue-stale',
        affectedDeskMapId: null,
        affectedNodeId: null,
        affectedOwnerId: null,
        affectedLeaseId: null,
      })
    );
  });

  it('rejects invalid JSON imports with a clear error', async () => {
    const file = new File(['{nope'], 'broken.landroid', {
      type: 'application/json',
    });

    await expect(importLandroidFile(file)).rejects.toThrow(
      'Invalid .landroid file: not valid JSON'
    );
  });

  it('rejects invalid ownership graphs on import', async () => {
    const invalidPayload = {
      version: 5,
      workspaceId: 'ws-invalid',
      projectName: 'Invalid Graph',
      nodes: [
        {
          ...createBlankNode('a', 'b'),
          fraction: '0.250000000',
          initialFraction: '0.250000000',
        },
        {
          ...createBlankNode('b', 'a'),
          fraction: '0.250000000',
          initialFraction: '0.250000000',
        },
      ],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    };
    const file = new File([JSON.stringify(invalidPayload)], 'invalid-graph.landroid', {
      type: 'application/json',
    });

    await expect(importLandroidFile(file)).rejects.toThrow(
      'Invalid .landroid file: invalid ownership graph'
    );
  });

  it('rejects malformed persisted node fractions before graph validation', async () => {
    const invalidPayload = {
      version: 5,
      workspaceId: 'ws-invalid-fraction',
      projectName: 'Invalid Fraction',
      nodes: [
        {
          ...createBlankNode('node-bad'),
          fraction: 'not-a-number',
          initialFraction: '1',
        },
      ],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    };
    const file = new File(
      [JSON.stringify(invalidPayload)],
      'invalid-fraction.landroid',
      { type: 'application/json' }
    );

    await expect(importLandroidFile(file)).rejects.toThrow(/invalid fraction/i);
  });

  it('rejects explicit invalid imported lease jurisdictions', async () => {
    const invalidPayload = {
      version: 5,
      workspaceId: 'ws-invalid-lease',
      projectName: 'Invalid Lease Jurisdiction',
      nodes: [createBlankNode('node-1')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
      ownerData: {
        owners: [],
        leases: [
          {
            id: 'lease-1',
            ownerId: 'owner-1',
            jurisdiction: 'blm',
          },
        ],
        contacts: [],
        docs: [],
      },
    };
    const file = new File(
      [JSON.stringify(invalidPayload)],
      'invalid-lease-jurisdiction.landroid',
      { type: 'application/json' }
    );

    await expect(importLandroidFile(file)).rejects.toThrow(
      /invalid lease jurisdiction/i
    );
  });

  it('allows warning-only ownership review states in persisted workspace data', () => {
    const warningOnlyWorkspace = JSON.stringify({
      workspaceId: 'ws-warning-only',
      projectName: 'Persisted Warning Only',
      nodes: [
        {
          ...createBlankNode('orphan', 'missing-parent'),
          fraction: '0.250000000',
          initialFraction: '0.250000000',
        },
        {
          ...createBlankNode('root'),
          fraction: '0.750000000',
          initialFraction: '1.000000000',
        },
        {
          ...createBlankNode('child-a', 'root'),
          fraction: '0',
          initialFraction: '0.500000000',
        },
      ],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    });

    const parsed = parsePersistedWorkspaceData(warningOnlyWorkspace);
    expect(parsed.nodes.map((node) => node.id)).toEqual([
      'orphan',
      'root',
      'child-a',
    ]);
  });

  it('rejects corrupt persisted canvas data', () => {
    expect(() => parsePersistedCanvasData('{"nodes":')).toThrow(
      'saved flowchart canvas is not valid JSON'
    );
    expect(() => parsePersistedCanvasData('[]')).toThrow(
      'saved flowchart canvas payload must be an object'
    );
  });

  it('round-trips desk-map unit grouping fields (unitName, unitCode)', async () => {
    const payload = {
      version: 6,
      workspaceId: 'ws-raven',
      projectName: 'Raven Forest',
      nodes: [createBlankNode('node-1')],
      deskMaps: [
        {
          id: 'dm-unit-a',
          name: 'C1 Smith',
          code: 'C1',
          tractId: 'C1',
          grossAcres: '640',
          pooledAcres: '640',
          description: 'Sam Houston NF — Walker County',
          nodeIds: ['node-1'],
          unitName: 'Raven Forest Unit A',
          unitCode: 'A',
        },
        {
          id: 'dm-unit-b',
          name: 'C6 Jones',
          code: 'C6',
          tractId: 'C6',
          grossAcres: '320',
          pooledAcres: '320',
          description: 'Sam Houston NF — Walker/Montgomery line',
          nodeIds: [],
          unitName: 'Raven Forest Unit B',
          unitCode: 'B',
        },
      ],
      activeDeskMapId: 'dm-unit-a',
      activeUnitCode: 'A',
      instrumentTypes: [],
    };
    const file = new File([JSON.stringify(payload)], 'raven.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.deskMaps).toEqual([
      expect.objectContaining({
        id: 'dm-unit-a',
        unitName: 'Raven Forest Unit A',
        unitCode: 'A',
      }),
      expect.objectContaining({
        id: 'dm-unit-b',
        unitName: 'Raven Forest Unit B',
        unitCode: 'B',
      }),
    ]);
    expect(imported.activeUnitCode).toBe('A');
  });

  it('loads pre-overhaul desk maps without unit fields and leaves them undefined', async () => {
    const legacyPayload = {
      version: 5,
      workspaceId: 'ws-legacy-unit',
      projectName: 'Legacy Without Units',
      nodes: [createBlankNode('node-1')],
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '160',
          pooledAcres: '',
          description: '',
          nodeIds: ['node-1'],
        },
      ],
      activeDeskMapId: 'dm-1',
      instrumentTypes: [],
    };
    const file = new File([JSON.stringify(legacyPayload)], 'legacy-unit.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.deskMaps[0]).not.toHaveProperty('unitName');
    expect(imported.deskMaps[0]).not.toHaveProperty('unitCode');
  });

  it('drops blank unit names but keeps arbitrary unit codes during import', async () => {
    const payload = {
      version: 6,
      workspaceId: 'ws-bad-unit',
      projectName: 'Additional Unit Fields',
      nodes: [createBlankNode('node-1')],
      deskMaps: [
        {
          id: 'dm-bad',
          name: 'Mystery Tract',
          code: '',
          tractId: null,
          grossAcres: '',
          pooledAcres: '',
          description: '',
          nodeIds: ['node-1'],
          unitName: '   ',
          unitCode: 'Z',
        },
      ],
      activeDeskMapId: 'dm-bad',
      instrumentTypes: [],
    };
    const file = new File([JSON.stringify(payload)], 'additional-unit.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.deskMaps[0]).not.toHaveProperty('unitName');
    expect(imported.deskMaps[0]?.unitCode).toBe('Z');
    expect(imported.activeUnitCode).toBe('Z');
  });
});
