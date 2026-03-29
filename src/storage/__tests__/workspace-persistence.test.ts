import { describe, expect, it } from 'vitest';
import type { CanvasSaveData } from '../../store/canvas-store';
import { createBlankMapAsset } from '../../types/map';
import { createBlankOwner, createBlankOwnerDoc } from '../../types/owner';
import { createBlankNode } from '../../types/node';
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
    expect(imported.mapData).toEqual({ mapAssets: [] });
    expect(imported.nodes[0]?.linkedOwnerId).toBeNull();
  });
});
