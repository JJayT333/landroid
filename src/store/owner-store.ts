import { create } from 'zustand';
import {
  deleteContact,
  deleteLease,
  deleteOwner,
  deleteOwnerDoc,
  loadOwnerWorkspaceData,
  replaceOwnerWorkspaceData,
  saveContact,
  saveLease,
  saveOwner,
  saveOwnerDoc,
  type OwnerWorkspaceData,
} from '../storage/owner-persistence';
import type {
  ContactLog,
  Lease,
  Owner,
  OwnerDoc,
  OwnerPanelTab,
} from '../types/owner';
import { normalizeLease } from '../types/owner';
import { useMapStore } from './map-store';
import { useWorkspaceStore } from './workspace-store';

function touch<T extends { updatedAt: string }>(record: T): T {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeLeases(leases: Lease[], workspaceId: string) {
  return leases.map((lease) =>
    normalizeLease(lease, { workspaceId, ownerId: lease.ownerId })
  );
}

interface OwnerState {
  workspaceId: string | null;
  owners: Owner[];
  leases: Lease[];
  contacts: ContactLog[];
  docs: OwnerDoc[];
  selectedOwnerId: string | null;
  selectedOwnerTab: OwnerPanelTab;
  _hydrated: boolean;
  setWorkspace: (workspaceId: string) => Promise<void>;
  replaceWorkspaceData: (
    workspaceId: string,
    data: OwnerWorkspaceData
  ) => Promise<void>;
  exportWorkspaceData: () => Promise<OwnerWorkspaceData>;
  selectOwner: (ownerId: string | null) => void;
  selectOwnerTab: (tab: OwnerPanelTab) => void;
  addOwner: (owner: Owner) => Promise<void>;
  updateOwner: (id: string, fields: Partial<Owner>) => Promise<void>;
  removeOwner: (id: string) => Promise<void>;
  addLease: (lease: Lease) => Promise<void>;
  updateLease: (id: string, fields: Partial<Lease>) => Promise<void>;
  removeLease: (id: string) => Promise<void>;
  addContact: (contact: ContactLog) => Promise<void>;
  updateContact: (id: string, fields: Partial<ContactLog>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  addDoc: (doc: OwnerDoc) => Promise<void>;
  updateDoc: (id: string, fields: Partial<OwnerDoc>) => Promise<void>;
  removeDoc: (id: string) => Promise<void>;
}

export const useOwnerStore = create<OwnerState>()((set, get) => ({
  workspaceId: null,
  owners: [],
  leases: [],
  contacts: [],
  docs: [],
  selectedOwnerId: null,
  selectedOwnerTab: 'info',
  _hydrated: false,

  setWorkspace: async (workspaceId) => {
    const data = await loadOwnerWorkspaceData(workspaceId);
    set({
      workspaceId,
      owners: data.owners,
      leases: normalizeLeases(data.leases, workspaceId),
      contacts: data.contacts,
      docs: data.docs,
      selectedOwnerId: null,
      selectedOwnerTab: 'info',
      _hydrated: true,
    });
  },

  replaceWorkspaceData: async (workspaceId, data) => {
    const normalizedLeases = normalizeLeases(data.leases, workspaceId);
    await replaceOwnerWorkspaceData(workspaceId, {
      ...data,
      leases: normalizedLeases,
    });
    set({
      workspaceId,
      owners: data.owners.map((owner) => ({ ...owner, workspaceId })),
      leases: normalizedLeases,
      contacts: data.contacts.map((contact) => ({ ...contact, workspaceId })),
      docs: data.docs.map((doc) => ({ ...doc, workspaceId })),
      selectedOwnerId: null,
      selectedOwnerTab: 'info',
      _hydrated: true,
    });
  },

  exportWorkspaceData: async () => {
    const { owners, leases, contacts, docs } = get();
    return { owners, leases, contacts, docs };
  },

  selectOwner: (selectedOwnerId) => set({ selectedOwnerId }),
  selectOwnerTab: (selectedOwnerTab) => set({ selectedOwnerTab }),

  addOwner: async (owner) => {
    const workspaceId = get().workspaceId ?? owner.workspaceId;
    const next = { ...owner, workspaceId };
    await saveOwner(next);
    set((state) => ({
      owners: [...state.owners, next].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
      selectedOwnerId: next.id,
      selectedOwnerTab: 'info',
    }));
  },

  updateOwner: async (id, fields) => {
    const current = get().owners.find((owner) => owner.id === id);
    if (!current) return;
    const next = touch({ ...current, ...fields, workspaceId: current.workspaceId });
    await saveOwner(next);
    set((state) => ({
      owners: state.owners
        .map((owner) => (owner.id === id ? next : owner))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }));
  },

  removeOwner: async (id) => {
    await deleteOwner(id);
    useWorkspaceStore.getState().clearLinkedOwner(id);
    await useMapStore.getState().unlinkOwner(id);
    set((state) => ({
      owners: state.owners.filter((owner) => owner.id !== id),
      leases: state.leases.filter((lease) => lease.ownerId !== id),
      contacts: state.contacts.filter((contact) => contact.ownerId !== id),
      docs: state.docs.filter((doc) => doc.ownerId !== id),
      selectedOwnerId: state.selectedOwnerId === id ? null : state.selectedOwnerId,
      selectedOwnerTab:
        state.selectedOwnerId === id ? 'info' : state.selectedOwnerTab,
    }));
  },

  addLease: async (lease) => {
    const workspaceId = get().workspaceId ?? lease.workspaceId;
    const next = normalizeLease(lease, {
      workspaceId,
      ownerId: lease.ownerId,
    });
    await saveLease(next);
    set((state) => ({ leases: [...state.leases, next] }));
  },

  updateLease: async (id, fields) => {
    const current = get().leases.find((lease) => lease.id === id);
    if (!current) return;
    const next = normalizeLease(
      touch({ ...current, ...fields, workspaceId: current.workspaceId }),
      {
        workspaceId: current.workspaceId,
        ownerId: current.ownerId,
      }
    );
    await saveLease(next);
    useWorkspaceStore.getState().syncLeaseNodesFromRecord(next);
    set((state) => ({
      leases: state.leases.map((lease) => (lease.id === id ? next : lease)),
    }));
  },

  removeLease: async (id) => {
    await deleteLease(id);
    useWorkspaceStore.getState().clearLinkedLease(id);
    await useMapStore.getState().unlinkLease(id);
    set((state) => ({
      leases: state.leases.filter((lease) => lease.id !== id),
      docs: state.docs.map((doc) =>
        doc.leaseId === id ? { ...doc, leaseId: null } : doc
      ),
    }));
  },

  addContact: async (contact) => {
    const workspaceId = get().workspaceId ?? contact.workspaceId;
    const next = { ...contact, workspaceId };
    await saveContact(next);
    set((state) => ({ contacts: [...state.contacts, next] }));
  },

  updateContact: async (id, fields) => {
    const current = get().contacts.find((contact) => contact.id === id);
    if (!current) return;
    const next = touch({ ...current, ...fields, workspaceId: current.workspaceId });
    await saveContact(next);
    set((state) => ({
      contacts: state.contacts.map((contact) =>
        contact.id === id ? next : contact
      ),
    }));
  },

  removeContact: async (id) => {
    await deleteContact(id);
    set((state) => ({
      contacts: state.contacts.filter((contact) => contact.id !== id),
    }));
  },

  addDoc: async (doc) => {
    const workspaceId = get().workspaceId ?? doc.workspaceId;
    const next = { ...doc, workspaceId };
    await saveOwnerDoc(next);
    set((state) => ({ docs: [...state.docs, next] }));
  },

  updateDoc: async (id, fields) => {
    const current = get().docs.find((doc) => doc.id === id);
    if (!current) return;
    const next = touch({ ...current, ...fields, workspaceId: current.workspaceId });
    await saveOwnerDoc(next);
    set((state) => ({
      docs: state.docs.map((doc) => (doc.id === id ? next : doc)),
    }));
  },

  removeDoc: async (id) => {
    await deleteOwnerDoc(id);
    set((state) => ({ docs: state.docs.filter((doc) => doc.id !== id) }));
  },
}));
