import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankMapAsset } from '../../types/map';

const mocks = vi.hoisted(() => ({
  loadMapWorkspaceData: vi.fn(),
  replaceMapWorkspaceData: vi.fn(),
  saveMapAsset: vi.fn(),
  deleteMapAsset: vi.fn(),
  clearDeskMapLink: vi.fn(),
  clearNodeLink: vi.fn(),
  clearOwnerLink: vi.fn(),
  clearLeaseLink: vi.fn(),
}));

vi.mock('../../storage/map-persistence', () => ({
  loadMapWorkspaceData: mocks.loadMapWorkspaceData,
  replaceMapWorkspaceData: mocks.replaceMapWorkspaceData,
  saveMapAsset: mocks.saveMapAsset,
  deleteMapAsset: mocks.deleteMapAsset,
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
      _hydrated: false,
    });
  });

  it('loads workspace-scoped assets', async () => {
    const asset = createBlankMapAsset(
      'ws-a',
      new Blob(['map'], { type: 'text/plain' }),
      {
        fileName: 'map.txt',
        mimeType: 'text/plain',
        overrides: { id: 'map-1', title: 'Map 1' },
      }
    );
    mocks.loadMapWorkspaceData.mockResolvedValueOnce({ mapAssets: [asset] });

    await useMapStore.getState().setWorkspace('ws-a');

    expect(useMapStore.getState().workspaceId).toBe('ws-a');
    expect(useMapStore.getState().mapAssets).toHaveLength(1);
    expect(useMapStore.getState().mapAssets[0]?.id).toBe('map-1');
  });

  it('clears node and lease links without dropping the asset', async () => {
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
    mocks.clearNodeLink.mockResolvedValue(undefined);
    mocks.clearLeaseLink.mockResolvedValue(undefined);
    useMapStore.setState({
      workspaceId: 'ws-a',
      mapAssets: [asset],
      _hydrated: true,
    });

    await useMapStore.getState().unlinkNode('node-1');
    await useMapStore.getState().unlinkLease('lease-1');

    expect(mocks.clearNodeLink).toHaveBeenCalledWith('node-1');
    expect(mocks.clearLeaseLink).toHaveBeenCalledWith('lease-1');
    expect(useMapStore.getState().mapAssets[0]?.nodeId).toBeNull();
    expect(useMapStore.getState().mapAssets[0]?.leaseId).toBeNull();
  });
});
