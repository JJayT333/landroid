import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBlankMapAsset,
  createBlankMapExternalReference,
  createBlankMapRegion,
} from '../../types/map';
import { normalizeMapTractFeature } from '../../types/map-tract-feature';

const mocks = vi.hoisted(() => ({
  loadMapWorkspaceMetadata: vi.fn(),
  loadMapAssetsWithBlobs: vi.fn(),
  getMapAssetBlob: vi.fn(),
  replaceMapWorkspaceData: vi.fn(),
  saveMapAsset: vi.fn(),
  updateMapAssetFields: vi.fn(),
  saveMapRegion: vi.fn(),
  saveMapReference: vi.fn(),
  deleteMapAsset: vi.fn(),
  deleteMapRegion: vi.fn(),
  deleteMapReference: vi.fn(),
  clearDeskMapLink: vi.fn(),
  clearNodeLink: vi.fn(),
  clearOwnerLink: vi.fn(),
  clearLeaseLink: vi.fn(),
}));

const tractMocks = vi.hoisted(() => ({
  loadMapTractFeatures: vi.fn(async () => []),
  saveMapTractFeatures: vi.fn(async () => undefined),
  deleteMapTractFeaturesForAsset: vi.fn(async () => undefined),
  deleteMapTractFeature: vi.fn(async () => undefined),
  updateMapTractFeatureFields: vi.fn(async () => undefined),
}));

vi.mock('../../storage/map-tract-feature-persistence', () => tractMocks);

// The matcher's cross-store write dynamically imports workspace-store; stub it
// with a controllable desk-map list + an updateDeskMapDetails spy.
const wsMocks = vi.hoisted(() => {
  const state = {
    deskMaps: [] as Array<{ id: string; code: string; externalRefs?: unknown[] }>,
  };
  const updateDeskMapDetails = vi.fn((id: string, fields: Record<string, unknown>) => {
    const dm = state.deskMaps.find((d) => d.id === id);
    if (dm) Object.assign(dm, fields);
  });
  return { state, updateDeskMapDetails };
});

vi.mock('../workspace-store', () => ({
  useWorkspaceStore: {
    getState: () => ({
      deskMaps: wsMocks.state.deskMaps,
      updateDeskMapDetails: wsMocks.updateDeskMapDetails,
    }),
  },
}));

vi.mock('../../storage/map-persistence', () => ({
  loadMapWorkspaceMetadata: mocks.loadMapWorkspaceMetadata,
  loadMapAssetsWithBlobs: mocks.loadMapAssetsWithBlobs,
  getMapAssetBlob: mocks.getMapAssetBlob,
  replaceMapWorkspaceData: mocks.replaceMapWorkspaceData,
  saveMapAsset: mocks.saveMapAsset,
  updateMapAssetFields: mocks.updateMapAssetFields,
  saveMapRegion: mocks.saveMapRegion,
  saveMapReference: mocks.saveMapReference,
  deleteMapAsset: mocks.deleteMapAsset,
  deleteMapRegion: mocks.deleteMapRegion,
  deleteMapReference: mocks.deleteMapReference,
  clearDeskMapLink: mocks.clearDeskMapLink,
  clearNodeLink: mocks.clearNodeLink,
  clearOwnerLink: mocks.clearOwnerLink,
  clearLeaseLink: mocks.clearLeaseLink,
}));

import { useMapStore } from '../map-store';

describe('map-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tractMocks.loadMapTractFeatures.mockResolvedValue([]);
    wsMocks.state.deskMaps = [];
    useMapStore.setState({
      workspaceId: null,
      mapAssets: [],
      mapRegions: [],
      mapReferences: [],
      tractFeatures: [],
      _hydrated: false,
    });
  });

  it('loads workspace-scoped map data and backfills a featured asset when missing', async () => {
    const asset = createBlankMapAsset(
      'ws-a',
      new Blob(['map'], { type: 'text/plain' }),
      {
        fileName: 'map.txt',
        mimeType: 'text/plain',
        overrides: {
          id: 'map-1',
          title: 'Map 1',
          isFeatured: false,
        },
      }
    );
    const region = createBlankMapRegion('ws-a', asset.id, {
      id: 'region-1',
      title: 'South Block',
    });
    const reference = createBlankMapExternalReference('ws-a', {
      id: 'ref-1',
      assetId: asset.id,
      label: 'RRC GIS',
    });

    const { blob: _blob, ...assetMeta } = asset;
    mocks.loadMapWorkspaceMetadata.mockResolvedValueOnce({
      mapAssets: [assetMeta],
      mapRegions: [region],
      mapReferences: [reference],
    });

    await useMapStore.getState().setWorkspace('ws-a');

    expect(useMapStore.getState().workspaceId).toBe('ws-a');
    expect(useMapStore.getState().mapAssets).toHaveLength(1);
    expect(useMapStore.getState().mapAssets[0]?.isFeatured).toBe(true);
    // Project open holds metadata only, never the blob.
    expect('blob' in (useMapStore.getState().mapAssets[0] ?? {})).toBe(false);
    expect(useMapStore.getState().mapRegions[0]?.id).toBe('region-1');
    expect(useMapStore.getState().mapReferences[0]?.id).toBe('ref-1');
    // Backfilling the featured flag uses a blob-preserving partial update,
    // not a full-row put.
    expect(mocks.saveMapAsset).not.toHaveBeenCalled();
    expect(mocks.updateMapAssetFields).toHaveBeenCalledWith('map-1', {
      isFeatured: true,
    });
  });

  it('removes related regions/references and promotes the remaining asset to featured', async () => {
    const featured = createBlankMapAsset(
      'ws-a',
      new Blob(['featured'], { type: 'image/png' }),
      {
        fileName: 'featured.png',
        mimeType: 'image/png',
        overrides: {
          id: 'map-1',
          isFeatured: true,
        },
      }
    );
    const secondary = createBlankMapAsset(
      'ws-a',
      new Blob(['secondary'], { type: 'application/pdf' }),
      {
        fileName: 'secondary.pdf',
        mimeType: 'application/pdf',
        overrides: {
          id: 'map-2',
          isFeatured: false,
        },
      }
    );
    const region = createBlankMapRegion('ws-a', featured.id, { id: 'region-1' });
    const reference = createBlankMapExternalReference('ws-a', {
      id: 'ref-1',
      assetId: featured.id,
    });

    mocks.deleteMapAsset.mockResolvedValue(undefined);
    mocks.saveMapAsset.mockResolvedValue(undefined);
    useMapStore.setState({
      workspaceId: 'ws-a',
      mapAssets: [featured, secondary],
      mapRegions: [region],
      mapReferences: [reference],
      _hydrated: true,
    });

    await useMapStore.getState().removeAsset(featured.id);

    expect(mocks.deleteMapAsset).toHaveBeenCalledWith(featured.id);
    expect(useMapStore.getState().mapAssets).toHaveLength(1);
    expect(useMapStore.getState().mapAssets[0]?.id).toBe('map-2');
    expect(useMapStore.getState().mapAssets[0]?.isFeatured).toBe(true);
    expect(useMapStore.getState().mapRegions).toEqual([]);
    expect(useMapStore.getState().mapReferences).toEqual([]);
  });

  it('clears node and lease links across assets and regions without dropping records', async () => {
    const asset = createBlankMapAsset(
      'ws-a',
      new Blob(['map'], { type: 'text/plain' }),
      {
        fileName: 'map.txt',
        mimeType: 'text/plain',
        overrides: {
          id: 'map-1',
          nodeId: 'node-1',
          leaseId: 'lease-1',
        },
      }
    );
    const region = createBlankMapRegion('ws-a', asset.id, {
      id: 'region-1',
      nodeId: 'node-1',
      leaseId: 'lease-1',
    });
    mocks.clearNodeLink.mockResolvedValue(undefined);
    mocks.clearLeaseLink.mockResolvedValue(undefined);
    useMapStore.setState({
      workspaceId: 'ws-a',
      mapAssets: [asset],
      mapRegions: [region],
      mapReferences: [],
      _hydrated: true,
    });

    await useMapStore.getState().unlinkNode('node-1');
    await useMapStore.getState().unlinkLease('lease-1');

    expect(mocks.clearNodeLink).toHaveBeenCalledWith('ws-a', 'node-1');
    expect(mocks.clearLeaseLink).toHaveBeenCalledWith('ws-a', 'lease-1');
    expect(useMapStore.getState().mapAssets[0]?.nodeId).toBeNull();
    expect(useMapStore.getState().mapAssets[0]?.leaseId).toBeNull();
    expect(useMapStore.getState().mapRegions[0]?.nodeId).toBeNull();
    expect(useMapStore.getState().mapRegions[0]?.leaseId).toBeNull();
  });

  it('re-reads blob-bearing assets from storage when exporting', async () => {
    const exported = createBlankMapAsset(
      'ws-a',
      new Blob(['featured'], { type: 'image/png' }),
      {
        fileName: 'featured.png',
        mimeType: 'image/png',
        overrides: { id: 'map-1', isFeatured: true },
      }
    );
    mocks.loadMapAssetsWithBlobs.mockResolvedValue([exported]);
    const { blob: _blob, ...meta } = exported;
    useMapStore.setState({
      workspaceId: 'ws-a',
      // In-memory assets are metadata only; export must not rely on them.
      mapAssets: [meta],
      mapRegions: [],
      mapReferences: [],
      _hydrated: true,
    });

    const data = await useMapStore.getState().exportWorkspaceData();

    expect(mocks.loadMapAssetsWithBlobs).toHaveBeenCalledWith('ws-a');
    expect(data.mapAssets).toHaveLength(1);
    expect(data.mapAssets[0]?.blob).toBeInstanceOf(Blob);
  });

  it('inserts a new asset with its blob, then toggles featured via partial update', async () => {
    mocks.saveMapAsset.mockResolvedValue(undefined);
    mocks.updateMapAssetFields.mockResolvedValue(1);
    useMapStore.setState({
      workspaceId: 'ws-a',
      mapAssets: [],
      mapRegions: [],
      mapReferences: [],
      _hydrated: true,
    });

    const asset = createBlankMapAsset(
      'ws-a',
      new Blob(['png-bytes'], { type: 'image/png' }),
      {
        fileName: 'new.png',
        mimeType: 'image/png',
        overrides: { id: 'map-new' },
      }
    );

    await useMapStore.getState().addAsset(asset);

    // The new row is inserted WITH its blob (full put)...
    expect(mocks.saveMapAsset).toHaveBeenCalledTimes(1);
    expect(mocks.saveMapAsset.mock.calls[0]?.[0]?.blob).toBeInstanceOf(Blob);
    // ...and featured flags are synced via blob-preserving partial updates.
    expect(mocks.updateMapAssetFields).toHaveBeenCalledWith('map-new', {
      isFeatured: true,
    });
    // The in-memory store holds metadata only.
    expect('blob' in (useMapStore.getState().mapAssets[0] ?? {})).toBe(false);
  });

  it('normalizes reference URLs before persisting them', async () => {
    const reference = createBlankMapExternalReference('ws-a', {
      id: 'ref-unsafe',
      url: 'rrc.texas.gov/resource-center',
    });

    mocks.saveMapReference.mockResolvedValue(undefined);
    useMapStore.setState({
      workspaceId: 'ws-a',
      mapAssets: [],
      mapRegions: [],
      mapReferences: [],
      _hydrated: true,
    });

    await useMapStore.getState().addReference(reference);

    expect(mocks.saveMapReference).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ref-unsafe',
        url: 'https://rrc.texas.gov/resource-center',
      })
    );
    expect(useMapStore.getState().mapReferences[0]?.url).toBe(
      'https://rrc.texas.gov/resource-center'
    );

    await useMapStore.getState().updateReference('ref-unsafe', {
      url: 'javascript:alert(1)',
    });

    expect(useMapStore.getState().mapReferences[0]?.url).toBe('');
  });

  it('ingestGeoJsonTractFeatures stores the raw asset + parses features into state', async () => {
    useMapStore.setState({ workspaceId: 'ws-a', _hydrated: true });
    const geojson = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { Tract: 'T-1', Acres: '40 ac', OBJECTID: 1 },
          geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        },
        {
          type: 'Feature',
          properties: { Tract: 'T-2' },
          geometry: { type: 'Point', coordinates: [0, 0] }, // non-polygon → skipped
        },
      ],
    });

    const result = await useMapStore
      .getState()
      .ingestGeoJsonTractFeatures({ fileName: 'tracts.geojson', text: geojson });

    expect(result.featureCount).toBe(1);
    expect(result.warnings).toHaveLength(1);
    // raw GeoJSON saved as a map asset
    expect(mocks.saveMapAsset).toHaveBeenCalledTimes(1);
    // idempotent persistence: clear this asset's features, then write the batch
    expect(tractMocks.deleteMapTractFeaturesForAsset).toHaveBeenCalledWith('ws-a', result.assetId);
    expect(tractMocks.saveMapTractFeatures).toHaveBeenCalledTimes(1);

    const state = useMapStore.getState();
    expect(state.tractFeatures).toHaveLength(1);
    expect(state.tractFeatures[0].tractKey).toBe('T-1');
    expect(state.tractFeatures[0].assetId).toBe(result.assetId);
    expect(state.tractFeatures[0].matchedDeskMapId).toBeNull();
  });

  it('ingest throws before a workspace is set', async () => {
    useMapStore.setState({ workspaceId: null });
    await expect(
      useMapStore.getState().ingestGeoJsonTractFeatures({ fileName: 'x.geojson', text: '{}' })
    ).rejects.toThrow(/workspace/);
  });

  it('setFeatureTractMatch links the feature and writes the ArcGIS ref onto the DeskMap', async () => {
    wsMocks.state.deskMaps = [{ id: 'dm-1', code: '18-203', externalRefs: [] }];
    useMapStore.setState({
      workspaceId: 'ws-a',
      tractFeatures: [
        normalizeMapTractFeature({
          id: 'feat-1',
          workspaceId: 'ws-a',
          assetId: 'asset-1',
          tractKey: '18-203',
          objectId: 1,
          polygons: [{ outer: [[0, 0], [1, 0], [1, 1]], holes: [] }],
          bbox: [0, 0, 1, 1],
          matchedDeskMapId: null,
        }),
      ],
    });

    await useMapStore.getState().setFeatureTractMatch('feat-1', 'dm-1');

    // feature match persisted + reflected
    expect(tractMocks.updateMapTractFeatureFields).toHaveBeenCalledWith(
      'feat-1',
      expect.objectContaining({ matchedDeskMapId: 'dm-1' })
    );
    expect(useMapStore.getState().tractFeatures[0].matchedDeskMapId).toBe('dm-1');
    // ArcGIS ref written onto the DeskMap
    expect(wsMocks.updateDeskMapDetails).toHaveBeenCalledWith(
      'dm-1',
      expect.objectContaining({ externalRefs: expect.any(Array) })
    );
    const refs = wsMocks.state.deskMaps[0].externalRefs as Array<{ system: string; objectId?: number }>;
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ system: 'arcgis', objectId: 1 });
  });

  it('removeTractFeature drops the feature and clears its ref from the matched DeskMap', async () => {
    wsMocks.state.deskMaps = [
      { id: 'dm-1', code: '18-203', externalRefs: [{ system: 'arcgis', objectId: 1, externalId: '18-203' }] },
    ];
    useMapStore.setState({
      workspaceId: 'ws-a',
      tractFeatures: [
        normalizeMapTractFeature({
          id: 'feat-1',
          workspaceId: 'ws-a',
          assetId: 'asset-1',
          tractKey: '18-203',
          objectId: 1,
          polygons: [{ outer: [[0, 0], [1, 0], [1, 1]], holes: [] }],
          bbox: [0, 0, 1, 1],
          matchedDeskMapId: 'dm-1',
        }),
        normalizeMapTractFeature({
          id: 'feat-2',
          workspaceId: 'ws-a',
          assetId: 'asset-1',
          tractKey: '1',
          polygons: [{ outer: [[0, 0], [1, 0], [1, 1]], holes: [] }],
          bbox: [0, 0, 1, 1],
          matchedDeskMapId: null,
        }),
      ],
    });

    await useMapStore.getState().removeTractFeature('feat-1');

    expect(tractMocks.deleteMapTractFeature).toHaveBeenCalledWith('feat-1');
    expect(useMapStore.getState().tractFeatures.map((f) => f.id)).toEqual(['feat-2']);
    expect(wsMocks.state.deskMaps[0].externalRefs).toHaveLength(0);
  });

  it('re-matching a feature moves the ref from the old DeskMap to the new', async () => {
    wsMocks.state.deskMaps = [
      { id: 'dm-1', code: '18-203', externalRefs: [{ system: 'arcgis', objectId: 5, externalId: '18-203' }] },
      { id: 'dm-2', code: '18-201', externalRefs: [] },
    ];
    useMapStore.setState({
      workspaceId: 'ws-a',
      tractFeatures: [
        normalizeMapTractFeature({
          id: 'feat-1',
          workspaceId: 'ws-a',
          assetId: 'asset-1',
          tractKey: '18-203',
          objectId: 5,
          polygons: [{ outer: [[0, 0], [1, 0], [1, 1]], holes: [] }],
          bbox: [0, 0, 1, 1],
          matchedDeskMapId: 'dm-1',
        }),
      ],
    });

    await useMapStore.getState().setFeatureTractMatch('feat-1', 'dm-2');

    expect(wsMocks.state.deskMaps[0].externalRefs).toHaveLength(0); // removed from old
    expect(wsMocks.state.deskMaps[1].externalRefs).toHaveLength(1); // added to new
  });
});
