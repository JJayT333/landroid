import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankOwner, type Lease } from '../../types/owner';

const mocks = vi.hoisted(() => ({
  loadOwnerWorkspaceMetadata: vi.fn(),
  loadOwnerDocsWithBlobs: vi.fn(),
  getOwnerDocBlob: vi.fn(),
  replaceOwnerWorkspaceData: vi.fn(),
  saveOwner: vi.fn(),
  saveLease: vi.fn(),
  saveContact: vi.fn(),
  saveOwnerDoc: vi.fn(),
  updateOwnerDocFields: vi.fn(),
  deleteOwner: vi.fn(),
  deleteLease: vi.fn(),
  deleteContact: vi.fn(),
  deleteOwnerDoc: vi.fn(),
  clearLinkedOwner: vi.fn(),
  clearLinkedLease: vi.fn(),
  syncLeaseNodesFromRecord: vi.fn(),
  unlinkOwner: vi.fn(),
  unlinkLease: vi.fn(),
}));

vi.mock('../../storage/owner-persistence', () => ({
  loadOwnerWorkspaceMetadata: mocks.loadOwnerWorkspaceMetadata,
  loadOwnerDocsWithBlobs: mocks.loadOwnerDocsWithBlobs,
  getOwnerDocBlob: mocks.getOwnerDocBlob,
  replaceOwnerWorkspaceData: mocks.replaceOwnerWorkspaceData,
  saveOwner: mocks.saveOwner,
  saveLease: mocks.saveLease,
  saveContact: mocks.saveContact,
  saveOwnerDoc: mocks.saveOwnerDoc,
  updateOwnerDocFields: mocks.updateOwnerDocFields,
  deleteOwner: mocks.deleteOwner,
  deleteLease: mocks.deleteLease,
  deleteContact: mocks.deleteContact,
  deleteOwnerDoc: mocks.deleteOwnerDoc,
}));

vi.mock('../workspace-store', () => ({
  useWorkspaceStore: {
    getState: () => ({
      clearLinkedOwner: mocks.clearLinkedOwner,
      clearLinkedLease: mocks.clearLinkedLease,
      syncLeaseNodesFromRecord: mocks.syncLeaseNodesFromRecord,
    }),
  },
}));

vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({
      unlinkOwner: mocks.unlinkOwner,
      unlinkLease: mocks.unlinkLease,
    }),
  },
}));

import { useOwnerStore } from '../owner-store';

describe('owner-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOwnerStore.setState({
      workspaceId: null,
      owners: [],
      leases: [],
      contacts: [],
      docs: [],
      selectedOwnerId: null,
      selectedOwnerTab: 'info',
      _hydrated: false,
    });
  });

  it('clears selected owner state when switching workspaces', async () => {
    const firstOwner = createBlankOwner('ws-a', { id: 'owner-a', name: 'Alpha Owner' });
    mocks.loadOwnerWorkspaceMetadata
      .mockResolvedValueOnce({
        owners: [firstOwner],
        leases: [],
        contacts: [],
        docs: [],
      })
      .mockResolvedValueOnce({
        owners: [],
        leases: [],
        contacts: [],
        docs: [],
      });

    await useOwnerStore.getState().setWorkspace('ws-a');
    useOwnerStore.getState().selectOwner(firstOwner.id);
    await useOwnerStore.getState().setWorkspace('ws-b');

    const state = useOwnerStore.getState();
    expect(state.workspaceId).toBe('ws-b');
    expect(state.selectedOwnerId).toBeNull();
    expect(state.selectedOwnerTab).toBe('info');
    expect(state.owners).toEqual([]);
  });

  it('adds owners into the active workspace and selects them', async () => {
    const owner = createBlankOwner('wrong-ws', {
      id: 'owner-1',
      name: 'Pat Doe',
    });
    mocks.saveOwner.mockResolvedValue(undefined);
    useOwnerStore.setState({ workspaceId: 'ws-active' });

    await useOwnerStore.getState().addOwner(owner);

    expect(mocks.saveOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'owner-1',
        workspaceId: 'ws-active',
      })
    );
    expect(useOwnerStore.getState().selectedOwnerId).toBe('owner-1');
    expect(useOwnerStore.getState().selectedOwnerTab).toBe('info');
    expect(useOwnerStore.getState().owners[0]?.workspaceId).toBe('ws-active');
  });

  it('tracks which owner detail tab should open', () => {
    useOwnerStore.getState().selectOwnerTab('leases');
    expect(useOwnerStore.getState().selectedOwnerTab).toBe('leases');
  });

  it('normalizes legacy leases that are missing newer text fields', async () => {
    mocks.loadOwnerWorkspaceMetadata.mockResolvedValue({
      owners: [],
      leases: [
        {
          id: 'legacy-lease',
          workspaceId: 'ws-a',
          ownerId: 'owner-1',
          leaseName: 'Legacy Lease',
          lessee: 'Acme Energy',
          effectiveDate: '',
          expirationDate: '',
          docNo: '',
          notes: '',
          createdAt: '',
          updatedAt: '',
        } as Lease,
      ],
      contacts: [],
      docs: [],
    });

    await useOwnerStore.getState().setWorkspace('ws-a');

    expect(useOwnerStore.getState().leases).toEqual([
      expect.objectContaining({
        id: 'legacy-lease',
        royaltyRate: '',
        leasedInterest: '',
        status: 'Active',
      }),
    ]);
  });

  it('removes dependent owner records and clears linked references', async () => {
    const owner = createBlankOwner('ws-a', { id: 'owner-1', name: 'Pat Doe' });
    mocks.deleteOwner.mockResolvedValue(undefined);
    mocks.unlinkOwner.mockResolvedValue(undefined);
    useOwnerStore.setState({
      workspaceId: 'ws-a',
      owners: [owner],
      leases: [
        {
          id: 'lease-1',
          workspaceId: 'ws-a',
          ownerId: owner.id,
          leaseName: 'Lease 1',
          lessee: '',
          royaltyRate: '',
          leasedInterest: '',
          effectiveDate: '',
          expirationDate: '',
          status: 'Active',
          docNo: '',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '',
          updatedAt: '',
          depthRange: 'all_depths',
        },
      ],
      contacts: [
        {
          id: 'contact-1',
          workspaceId: 'ws-a',
          ownerId: owner.id,
          contactDate: '',
          method: 'Phone',
          subject: '',
          outcome: '',
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      docs: [
        {
          id: 'doc-1',
          workspaceId: 'ws-a',
          ownerId: owner.id,
          leaseId: null,
          fileName: 'notes.txt',
          mimeType: 'text/plain',
          category: 'Other',
          notes: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
      selectedOwnerId: owner.id,
      selectedOwnerTab: 'leases',
    });

    await useOwnerStore.getState().removeOwner(owner.id);

    expect(mocks.deleteOwner).toHaveBeenCalledWith(owner.id);
    expect(mocks.clearLinkedOwner).toHaveBeenCalledWith(owner.id);
    expect(mocks.clearLinkedLease).toHaveBeenCalledWith('lease-1');
    expect(mocks.unlinkOwner).toHaveBeenCalledWith(owner.id);
    expect(mocks.unlinkLease).toHaveBeenCalledWith('lease-1');
    expect(useOwnerStore.getState().owners).toEqual([]);
    expect(useOwnerStore.getState().leases).toEqual([]);
    expect(useOwnerStore.getState().contacts).toEqual([]);
    expect(useOwnerStore.getState().docs).toEqual([]);
    expect(useOwnerStore.getState().selectedOwnerId).toBeNull();
    expect(useOwnerStore.getState().selectedOwnerTab).toBe('info');
  });

  it('clears linked lease references when a lease is removed', async () => {
    mocks.deleteLease.mockResolvedValue(undefined);
    mocks.unlinkLease.mockResolvedValue(undefined);
    useOwnerStore.setState({
      workspaceId: 'ws-a',
      owners: [],
      leases: [
        {
          id: 'lease-1',
          workspaceId: 'ws-a',
          ownerId: 'owner-1',
          leaseName: 'Lease 1',
          lessee: 'Acme Energy',
          royaltyRate: '1/4',
          leasedInterest: '0.125',
          effectiveDate: '',
          expirationDate: '',
          status: 'Active',
          docNo: '',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '',
          updatedAt: '',
          depthRange: 'all_depths',
        },
      ],
      contacts: [],
      docs: [],
      selectedOwnerId: null,
      selectedOwnerTab: 'info',
    });

    await useOwnerStore.getState().removeLease('lease-1');

    expect(mocks.deleteLease).toHaveBeenCalledWith('lease-1');
    expect(mocks.clearLinkedLease).toHaveBeenCalledWith('lease-1');
    expect(mocks.unlinkLease).toHaveBeenCalledWith('lease-1');
    expect(useOwnerStore.getState().leases).toEqual([]);
  });

  it('re-reads blob-bearing docs from storage when exporting', async () => {
    const exportedDoc = {
      id: 'doc-1',
      workspaceId: 'ws-a',
      ownerId: 'owner-1',
      leaseId: null,
      fileName: 'notes.txt',
      mimeType: 'text/plain',
      category: 'Other' as const,
      notes: '',
      blob: new Blob(['hello'], { type: 'text/plain' }),
      createdAt: '',
      updatedAt: '',
    };
    mocks.loadOwnerDocsWithBlobs.mockResolvedValue([exportedDoc]);
    useOwnerStore.setState({
      workspaceId: 'ws-a',
      // In-memory docs are metadata only (no blob); export must not rely on them.
      docs: [{ ...exportedDoc, blob: undefined } as never],
    });

    const data = await useOwnerStore.getState().exportWorkspaceData();

    expect(mocks.loadOwnerDocsWithBlobs).toHaveBeenCalledWith('ws-a');
    expect(data.docs).toHaveLength(1);
    expect(data.docs[0].blob).toBeInstanceOf(Blob);
  });

  it('refreshes linked lease nodes when a lease record is updated', async () => {
    mocks.saveLease.mockResolvedValue(undefined);
    useOwnerStore.setState({
      workspaceId: 'ws-a',
      owners: [],
      leases: [
        {
          id: 'lease-1',
          workspaceId: 'ws-a',
          ownerId: 'owner-1',
          leaseName: 'Old Lease Name',
          lessee: 'Acme Energy',
          royaltyRate: '1/4',
          leasedInterest: '0.5',
          effectiveDate: '',
          expirationDate: '',
          status: 'Active',
          docNo: '12345',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '',
          updatedAt: '',
          depthRange: 'all_depths',
        },
      ],
      contacts: [],
      docs: [],
      selectedOwnerId: null,
      selectedOwnerTab: 'info',
    });

    await useOwnerStore.getState().updateLease('lease-1', {
      leaseName: 'Updated Lease Name',
      lessee: 'Bluebonnet Operating',
    });

    expect(mocks.saveLease).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lease-1',
        leaseName: 'Updated Lease Name',
        lessee: 'Bluebonnet Operating',
      })
    );
    expect(mocks.syncLeaseNodesFromRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'lease-1',
        leaseName: 'Updated Lease Name',
        lessee: 'Bluebonnet Operating',
      })
    );
  });
});
