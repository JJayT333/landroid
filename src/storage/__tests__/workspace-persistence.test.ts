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
    nodes: [createBlankNode('node-1')],
    deskMaps: [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: 'T1',
        nodeIds: ['node-1'],
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
    expect(imported.nodes[0]?.linkedOwnerId).toBeNull();
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
});
