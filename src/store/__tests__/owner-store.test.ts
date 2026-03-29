import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankOwner } from '../../types/owner';

const mocks = vi.hoisted(() => ({
  loadOwnerWorkspaceData: vi.fn(),
  replaceOwnerWorkspaceData: vi.fn(),
  saveOwner: vi.fn(),
  saveLease: vi.fn(),
  saveContact: vi.fn(),
  saveOwnerDoc: vi.fn(),
  deleteOwner: vi.fn(),
  deleteLease: vi.fn(),
  deleteContact: vi.fn(),
  deleteOwnerDoc: vi.fn(),
  clearLinkedOwner: vi.fn(),
  unlinkOwner: vi.fn(),
  unlinkLease: vi.fn(),
}));

vi.mock('../../storage/owner-persistence', () => ({
  loadOwnerWorkspaceData: mocks.loadOwnerWorkspaceData,
  replaceOwnerWorkspaceData: mocks.replaceOwnerWorkspaceData,
  saveOwner: mocks.saveOwner,
  saveLease: mocks.saveLease,
  saveContact: mocks.saveContact,
  saveOwnerDoc: mocks.saveOwnerDoc,
  deleteOwner: mocks.deleteOwner,
  deleteLease: mocks.deleteLease,
  deleteContact: mocks.deleteContact,
  deleteOwnerDoc: mocks.deleteOwnerDoc,
}));

vi.mock('../workspace-store', () => ({
  useWorkspaceStore: {
    getState: () => ({
      clearLinkedOwner: mocks.clearLinkedOwner,
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
      _hydrated: false,
    });
  });

  it('clears selected owner state when switching workspaces', async () => {
    const firstOwner = createBlankOwner('ws-a', { id: 'owner-a', name: 'Alpha Owner' });
    mocks.loadOwnerWorkspaceData
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
    expect(useOwnerStore.getState().owners[0]?.workspaceId).toBe('ws-active');
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
          effectiveDate: '',
          expirationDate: '',
          status: 'Active',
          docNo: '',
          notes: '',
          createdAt: '',
          updatedAt: '',
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
          blob: new Blob(['hello'], { type: 'text/plain' }),
          createdAt: '',
          updatedAt: '',
        },
      ],
      selectedOwnerId: owner.id,
    });

    await useOwnerStore.getState().removeOwner(owner.id);

    expect(mocks.deleteOwner).toHaveBeenCalledWith(owner.id);
    expect(mocks.clearLinkedOwner).toHaveBeenCalledWith(owner.id);
    expect(mocks.unlinkOwner).toHaveBeenCalledWith(owner.id);
    expect(useOwnerStore.getState().owners).toEqual([]);
    expect(useOwnerStore.getState().leases).toEqual([]);
    expect(useOwnerStore.getState().contacts).toEqual([]);
    expect(useOwnerStore.getState().docs).toEqual([]);
    expect(useOwnerStore.getState().selectedOwnerId).toBeNull();
  });
});
