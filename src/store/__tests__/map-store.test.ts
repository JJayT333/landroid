import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBlankMapAsset,
  createBlankMapExternalReference,
  createBlankMapRegion,
} from '../../types/map';

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
    useMapStore.setState({
      workspaceId: null,
      mapAssets: [],
      mapRegions: [],
      mapReferences: [],
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
});
