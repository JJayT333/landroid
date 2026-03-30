import { describe, expect, it } from 'vitest';
import type { CanvasSaveData } from '../../store/canvas-store';
import {
  createBlankMapAsset,
  createBlankMapExternalReference,
  createBlankMapRegion,
} from '../../types/map';
import { createBlankOwner, createBlankOwnerDoc } from '../../types/owner';
import { createBlankNode } from '../../types/node';
import { createBlankResearchImport } from '../../types/research';
import {
  exportLandroidFile,
  importLandroidFile,
  type LandroidFileData,
} from '../workspace-persistence';

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

  return {
    workspaceId: 'ws-1',
    projectName: 'Audit Roundtrip',
    nodes: [
      {
        ...createBlankNode('node-1'),
        type: 'related',
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
    },
    leaseholdOrris: [
      {
        id: 'orri-1',
        payee: 'Override Partners',
        scope: 'unit',
        deskMapId: null,
        burdenFraction: '1/32',
        burdenBasis: 'gross_8_8',
        effectiveDate: '2024-02-01',
        sourceDocNo: 'ORRI-1',
        notes: 'Starter override',
      },
    ],
    activeDeskMapId: 'dm-1',
    instrumentTypes: ['Deed'],
    canvas,
    ownerData: {
      owners: [owner],
      leases: [],
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
    expect(imported.leaseholdOrris).toEqual(original.leaseholdOrris);
    expect(imported.canvas).toEqual(original.canvas);
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
    expect(imported.researchData).toEqual({ imports: [] });
    expect(imported.leaseholdUnit).toEqual({
      name: '',
      description: '',
      operator: '',
      effectiveDate: '',
    });
    expect(imported.leaseholdOrris).toEqual([]);
    expect(imported.nodes[0]?.linkedOwnerId).toBeNull();
    expect(imported.nodes[0]?.linkedLeaseId).toBeNull();
    expect(imported.nodes[0]?.relatedKind).toBeNull();
    expect(imported.nodes[0]?.interestClass).toBe('mineral');
    expect(imported.nodes[0]?.royaltyKind).toBeNull();
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
    });
    expect(imported.leaseholdOrris).toEqual([]);
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
  });

  it('rejects invalid JSON imports with a clear error', async () => {
    const file = new File(['{nope'], 'broken.landroid', {
      type: 'application/json',
    });

    await expect(importLandroidFile(file)).rejects.toThrow(
      'Invalid .landroid file: not valid JSON'
    );
  });
});
