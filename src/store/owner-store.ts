/**
 * Owner database state — owners list, detail panel, leases, contacts, docs.
 *
 * Owner list lives in Zustand for reactive UI. Dexie is source of truth.
 * Leases/contacts/docs are loaded on-demand when an owner is selected.
 */
import { create } from 'zustand';
import type { Owner, Lease, ContactLog, OwnerDoc, OwnerStatus } from '../types/owner';
import {
  loadAllOwners,
  saveOwner,
  deleteOwner as dbDeleteOwner,
  loadLeasesForOwner,
  saveLease,
  deleteLease as dbDeleteLease,
  loadContactsForOwner,
  saveContact,
  deleteContact as dbDeleteContact,
  loadDocsForOwner,
  saveOwnerDoc,
  deleteOwnerDoc as dbDeleteDoc,
} from '../storage/owner-persistence';

export type DetailTab = 'info' | 'leases' | 'contacts' | 'documents';
export type SortField = 'name' | 'status' | 'county' | 'updatedAt';

interface OwnerStoreState {
  owners: Owner[];
  _hydrated: boolean;

  // UI
  selectedOwnerId: string | null;
  searchQuery: string;
  statusFilter: OwnerStatus | 'all';
  sortField: SortField;
  sortDirection: 'asc' | 'desc';
  detailTab: DetailTab;

  // Detail data (loaded on demand)
  activeLeases: Lease[];
  activeContacts: ContactLog[];
  activeDocs: OwnerDoc[];

  // Actions
  hydrate: () => Promise<void>;
  setHydrated: () => void;
  selectOwner: (id: string | null) => Promise<void>;
  addOwner: (owner: Owner) => Promise<void>;
  updateOwner: (id: string, fields: Partial<Owner>) => Promise<void>;
  removeOwner: (id: string) => Promise<void>;

  addLease: (lease: Lease) => Promise<void>;
  updateLease: (id: string, fields: Partial<Lease>) => Promise<void>;
  removeLease: (id: string) => Promise<void>;

  addContact: (entry: ContactLog) => Promise<void>;
  removeContact: (id: string) => Promise<void>;

  addDoc: (doc: OwnerDoc) => Promise<void>;
  removeDoc: (id: string) => Promise<void>;

  refreshDetail: () => Promise<void>;

  setSearch: (q: string) => void;
  setStatusFilter: (s: OwnerStatus | 'all') => void;
  setSort: (field: SortField) => void;
  setDetailTab: (tab: DetailTab) => void;
}

export const useOwnerStore = create<OwnerStoreState>()((set, get) => ({
  owners: [],
  _hydrated: false,
  selectedOwnerId: null,
  searchQuery: '',
  statusFilter: 'all',
  sortField: 'name',
  sortDirection: 'asc',
  detailTab: 'info',
  activeLeases: [],
  activeContacts: [],
  activeDocs: [],

  hydrate: async () => {
    const owners = await loadAllOwners();
    set({ owners, _hydrated: true });
  },

  setHydrated: () => set({ _hydrated: true }),

  selectOwner: async (id) => {
    set({ selectedOwnerId: id, detailTab: 'info' });
    if (!id) {
      set({ activeLeases: [], activeContacts: [], activeDocs: [] });
      return;
    }
    const [leases, contacts, docs] = await Promise.all([
      loadLeasesForOwner(id),
      loadContactsForOwner(id),
      loadDocsForOwner(id),
    ]);
    set({ activeLeases: leases, activeContacts: contacts, activeDocs: docs });
  },

  refreshDetail: async () => {
    const id = get().selectedOwnerId;
    if (!id) return;
    const [leases, contacts, docs] = await Promise.all([
      loadLeasesForOwner(id),
      loadContactsForOwner(id),
      loadDocsForOwner(id),
    ]);
    set({ activeLeases: leases, activeContacts: contacts, activeDocs: docs });
  },

  addOwner: async (owner) => {
    await saveOwner(owner);
    set((s) => ({ owners: [...s.owners, owner] }));
  },

  updateOwner: async (id, fields) => {
    const updated = { ...get().owners.find((o) => o.id === id)!, ...fields, updatedAt: new Date().toISOString() };
    await saveOwner(updated);
    set((s) => ({ owners: s.owners.map((o) => (o.id === id ? updated : o)) }));
  },

  removeOwner: async (id) => {
    await dbDeleteOwner(id);
    set((s) => ({
      owners: s.owners.filter((o) => o.id !== id),
      selectedOwnerId: s.selectedOwnerId === id ? null : s.selectedOwnerId,
      activeLeases: s.selectedOwnerId === id ? [] : s.activeLeases,
      activeContacts: s.selectedOwnerId === id ? [] : s.activeContacts,
      activeDocs: s.selectedOwnerId === id ? [] : s.activeDocs,
    }));
  },

  addLease: async (lease) => {
    await saveLease(lease);
    set((s) => ({ activeLeases: [...s.activeLeases, lease] }));
  },

  updateLease: async (id, fields) => {
    const lease = get().activeLeases.find((l) => l.id === id);
    if (!lease) return;
    const updated = { ...lease, ...fields, updatedAt: new Date().toISOString() };
    await saveLease(updated);
    set((s) => ({ activeLeases: s.activeLeases.map((l) => (l.id === id ? updated : l)) }));
  },

  removeLease: async (id) => {
    await dbDeleteLease(id);
    set((s) => ({
      activeLeases: s.activeLeases.filter((l) => l.id !== id),
      activeDocs: s.activeDocs.filter((d) => d.leaseId !== id),
    }));
  },

  addContact: async (entry) => {
    await saveContact(entry);
    const contacts = await loadContactsForOwner(entry.ownerId);
    set({ activeContacts: contacts });
  },

  removeContact: async (id) => {
    await dbDeleteContact(id);
    set((s) => ({ activeContacts: s.activeContacts.filter((c) => c.id !== id) }));
  },

  addDoc: async (doc) => {
    await saveOwnerDoc(doc);
    set((s) => ({ activeDocs: [...s.activeDocs, doc] }));
  },

  removeDoc: async (id) => {
    await dbDeleteDoc(id);
    set((s) => ({ activeDocs: s.activeDocs.filter((d) => d.id !== id) }));
  },

  setSearch: (q) => set({ searchQuery: q }),
  setStatusFilter: (s) => set({ statusFilter: s }),
  setSort: (field) =>
    set((s) => ({
      sortField: field,
      sortDirection: s.sortField === field && s.sortDirection === 'asc' ? 'desc' : 'asc',
    })),
  setDetailTab: (tab) => set({ detailTab: tab }),
}));
