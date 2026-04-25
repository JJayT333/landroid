import { describe, expect, it } from 'vitest';
import type { CanvasSaveData } from '../../store/canvas-store';
import {
  createBlankMapAsset,
  createBlankMapExternalReference,
  createBlankMapRegion,
} from '../../types/map';
import { createBlankLease, createBlankOwner, createBlankOwnerDoc } from '../../types/owner';
import { createBlankNode } from '../../types/node';
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
  parsePersistedWorkspaceData,
  type LandroidFileData,
} from '../workspace-persistence';
import { parsePersistedCanvasData } from '../canvas-persistence';

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
        hasDoc: true,
        docFileName: '20260001.pdf',
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
    pdfData: {
      pdfs: [
        {
          nodeId: 'node-1',
          fileName: '20260001.pdf',
          mimeType: 'application/pdf',
          blob: new Blob(['node-pdf-body'], { type: 'application/pdf' }),
          createdAt: '2026-04-01T00:00:00.000Z',
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

describe('workspace-persistence', () => {
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
    expect(imported.pdfData?.pdfs[0]?.fileName).toBe('20260001.pdf');
    expect(imported.nodes[0]?.docFileName).toBe('20260001.pdf');
    expect(await imported.pdfData?.pdfs[0]?.blob.text()).toBe('node-pdf-body');
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
    expect(imported.pdfData).toEqual({ pdfs: [] });
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

  it('clears stale hasDoc flags when an imported .landroid lacks the node PDF payload', async () => {
    const payload = {
      version: 6,
      workspaceId: 'ws-missing-pdf',
      projectName: 'Missing PDF',
      nodes: [
        {
          ...createBlankNode('node-with-missing-pdf'),
          hasDoc: true,
          docFileName: 'missing.pdf',
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

    expect(imported.nodes[0]?.hasDoc).toBe(false);
    expect(imported.nodes[0]?.docFileName).toBe('');
    expect(imported.pdfData).toEqual({ pdfs: [] });
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
          fraction: '-0.250000000',
          initialFraction: '-0.250000000',
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

  it('rejects missing-parent ownership graphs in persisted workspace data', () => {
    const invalidWorkspace = JSON.stringify({
      workspaceId: 'ws-invalid',
      projectName: 'Persisted Invalid',
      nodes: [
        {
          ...createBlankNode('orphan', 'missing-parent'),
          fraction: '0.250000000',
          initialFraction: '0.250000000',
        },
      ],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    });

    expect(() => parsePersistedWorkspaceData(invalidWorkspace)).toThrow(
      'Invalid saved workspace: invalid ownership graph'
    );
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
