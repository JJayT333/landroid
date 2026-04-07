/**
 * Core workspace state — nodes, deskmaps, active selections.
 *
 * Uses Zustand for minimal reactive state management.
 * All math operations go through the engine and produce immutable updates.
 */
import { create } from 'zustand';
import { buildLeaseNode, isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import { useMapStore } from './map-store';
import type { OwnershipNode, DeskMap } from '../types/node';
import { normalizeDeskMap, normalizeOwnershipNode } from '../types/node';
import {
  createBlankLeaseholdAssignment,
  createBlankLeaseholdTransferOrderEntry,
  createBlankLeaseholdUnit,
  normalizeLeaseholdAssignment,
  normalizeLeaseholdAssignments,
  normalizeLeaseholdOrri,
  normalizeLeaseholdOrris,
  normalizeLeaseholdTransferOrderEntries,
  normalizeLeaseholdTransferOrderEntry,
  type LeaseholdAssignment,
  normalizeLeaseholdUnit,
  type LeaseholdOrri,
  type LeaseholdTransferOrderEntry,
  type LeaseholdUnit,
} from '../types/leasehold';
import type { Lease } from '../types/owner';
import {
  executeConveyance,
  executeCreateNpri,
  executeRebalance,
  executePredecessorInsert,
  executeAttachConveyance,
  executeDeleteBranch,
} from '../engine/math-engine';
import type { Audit } from '../types/result';
import { createWorkspaceId } from '../utils/workspace-id';

const DEFAULT_INSTRUMENT_TYPES = [
  'Deed',
  'Mineral Deed',
  'Royalty Deed',
  'Special Warranty Deed',
  'Warranty Deed',
  'Quitclaim Deed',
  'Oil & Gas Lease',
  'Surface Use Agreement',
  'Order',
  'Probate',
  'Will',
  'Affidavit of Heirship',
  'Death Certificate',
  'Correction Deed',
  'Release',
];

interface WorkspaceState {
  // Data
  workspaceId: string;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit: LeaseholdUnit;
  leaseholdAssignments: LeaseholdAssignment[];
  leaseholdOrris: LeaseholdOrri[];
  leaseholdTransferOrderEntries: LeaseholdTransferOrderEntry[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];

  // Lifecycle
  _hydrated: boolean;

  // UI
  activeNodeId: string | null;
  lastAudit: Audit | null;
  lastError: string | null;
  startupWarning: string | null;

  // Actions
  setProjectName: (name: string) => void;
  updateLeaseholdUnit: (fields: Partial<LeaseholdUnit>) => void;
  addLeaseholdAssignment: (assignment?: Partial<LeaseholdAssignment>) => string;
  updateLeaseholdAssignment: (id: string, fields: Partial<LeaseholdAssignment>) => void;
  removeLeaseholdAssignment: (id: string) => void;
  addLeaseholdOrri: (orri?: Partial<LeaseholdOrri>) => string;
  updateLeaseholdOrri: (id: string, fields: Partial<LeaseholdOrri>) => void;
  removeLeaseholdOrri: (id: string) => void;
  upsertLeaseholdTransferOrderEntry: (
    entry: Pick<LeaseholdTransferOrderEntry, 'sourceRowId'>
      & Partial<Omit<LeaseholdTransferOrderEntry, 'sourceRowId'>>
  ) => string | null;
  removeLeaseholdTransferOrderEntry: (sourceRowId: string) => void;
  setActiveNode: (id: string | null) => void;
  setActiveDeskMap: (id: string) => void;
  addInstrumentType: (type: string) => void;

  // Desk map management
  createDeskMap: (name: string, code: string, initialNodeIds?: string[]) => string;
  renameDeskMap: (id: string, name: string) => void;
  updateDeskMapDetails: (
    id: string,
    fields: Partial<Pick<DeskMap, 'grossAcres' | 'pooledAcres' | 'description'>>
  ) => void;
  deleteDeskMap: (id: string) => void;
  getActiveDeskMapNodes: () => OwnershipNode[];

  // Math operations (delegate to engine, replace nodes on success)
  convey: (parentId: string, newNodeId: string, share: string, form: Partial<OwnershipNode>) => boolean;
  createNpri: (parentId: string, newNodeId: string, share: string, form: Partial<OwnershipNode>) => boolean;
  rebalance: (nodeId: string, newInitialFraction: string, formFields?: Partial<OwnershipNode>) => boolean;
  insertPredecessor: (activeNodeId: string, newPredecessorId: string, newInitialFraction: string, form: Partial<OwnershipNode>) => boolean;
  attachConveyance: (activeNodeId: string, attachParentId: string, calcShare: string, form: Partial<OwnershipNode>) => boolean;

  // CRUD
  addNode: (node: OwnershipNode) => void;
  updateNode: (id: string, fields: Partial<OwnershipNode>) => void;
  removeNode: (id: string) => void;
  clearLinkedOwner: (ownerId: string) => void;
  clearLinkedLease: (leaseId: string) => void;
  syncLeaseNodesFromRecord: (lease: Lease) => void;
  addNodeToActiveDeskMap: (nodeId: string) => void;
  setHydrated: () => void;
  setStartupWarning: (message: string | null) => void;
  loadWorkspace: (data: {
    workspaceId: string;
    projectName: string;
    nodes: OwnershipNode[];
    deskMaps: DeskMap[];
    leaseholdUnit?: LeaseholdUnit;
    leaseholdAssignments?: LeaseholdAssignment[];
    leaseholdOrris?: LeaseholdOrri[];
    leaseholdTransferOrderEntries?: LeaseholdTransferOrderEntry[];
    activeDeskMapId: string | null;
    instrumentTypes?: string[];
  }) => void;
}

function findParentId(nodes: OwnershipNode[], nodeId: string): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  return node?.parentId ?? null;
}

function resolveActiveDeskMapId(
  deskMaps: DeskMap[],
  preferredDeskMapId: string | null | undefined
): string | null {
  if (
    preferredDeskMapId
    && deskMaps.some((deskMap) => deskMap.id === preferredDeskMapId)
  ) {
    return preferredDeskMapId;
  }

  return deskMaps[0]?.id ?? null;
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspaceId: createWorkspaceId(),
  projectName: 'Untitled Workspace',
  nodes: [],
  deskMaps: [],
  leaseholdUnit: createBlankLeaseholdUnit(),
  leaseholdAssignments: [],
  leaseholdOrris: [],
  leaseholdTransferOrderEntries: [],
  activeDeskMapId: null,
  instrumentTypes: [...DEFAULT_INSTRUMENT_TYPES],
  _hydrated: false,
  activeNodeId: null,
  lastAudit: null,
  lastError: null,
  startupWarning: null,

  setProjectName: (name) => set({ projectName: name }),
  updateLeaseholdUnit: (fields) =>
    set((state) => ({
      leaseholdUnit: normalizeLeaseholdUnit({
        ...state.leaseholdUnit,
        ...fields,
      }),
    })),
  addLeaseholdAssignment: (assignment = {}) => {
    const next = normalizeLeaseholdAssignment({
      ...createBlankLeaseholdAssignment(),
      ...assignment,
    });
    set((state) => ({
      leaseholdAssignments: [...state.leaseholdAssignments, next],
    }));
    return next.id;
  },
  updateLeaseholdAssignment: (id, fields) =>
    set((state) => {
      const validDeskMapIds = new Set(state.deskMaps.map((deskMap) => deskMap.id));
      return {
        leaseholdAssignments: state.leaseholdAssignments.map((assignment) =>
          assignment.id === id
            ? normalizeLeaseholdAssignment(
                {
                  ...assignment,
                  ...fields,
                },
                { validDeskMapIds }
              )
            : assignment
        ),
      };
    }),
  removeLeaseholdAssignment: (id) =>
    set((state) => ({
      leaseholdAssignments: state.leaseholdAssignments.filter(
        (assignment) => assignment.id !== id
      ),
      leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries.filter(
        (entry) => entry.sourceRowId !== `assignment-${id}`
      ),
    })),
  addLeaseholdOrri: (orri = {}) => {
    const next = normalizeLeaseholdOrri(orri);
    set((state) => ({
      leaseholdOrris: [...state.leaseholdOrris, next],
    }));
    return next.id;
  },
  updateLeaseholdOrri: (id, fields) =>
    set((state) => {
      const validDeskMapIds = new Set(state.deskMaps.map((deskMap) => deskMap.id));
      return {
        leaseholdOrris: state.leaseholdOrris.map((orri) =>
          orri.id === id
            ? normalizeLeaseholdOrri(
                {
                  ...orri,
                  ...fields,
                },
                { validDeskMapIds }
              )
            : orri
        ),
      };
    }),
  removeLeaseholdOrri: (id) =>
    set((state) => ({
      leaseholdOrris: state.leaseholdOrris.filter((orri) => orri.id !== id),
      leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries.filter(
        (entry) => entry.sourceRowId !== `orri-${id}`
      ),
    })),
  upsertLeaseholdTransferOrderEntry: (entry) => {
    const normalized = normalizeLeaseholdTransferOrderEntry({
      ...createBlankLeaseholdTransferOrderEntry(),
      ...entry,
    });
    if (!normalized.sourceRowId) {
      return null;
    }
    const shouldRemove =
      normalized.status === 'draft'
      && !normalized.ownerNumber
      && !normalized.notes;

    if (shouldRemove) {
      set((state) => ({
        leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries.filter(
          (candidate) => candidate.sourceRowId !== normalized.sourceRowId
        ),
      }));
      return null;
    }

    set((state) => {
      const existing = state.leaseholdTransferOrderEntries.find(
        (candidate) => candidate.sourceRowId === normalized.sourceRowId
      );

      return {
        leaseholdTransferOrderEntries: existing
          ? state.leaseholdTransferOrderEntries.map((candidate) =>
              candidate.sourceRowId === normalized.sourceRowId
                ? normalizeLeaseholdTransferOrderEntry({
                    ...candidate,
                    ...normalized,
                    id: candidate.id,
                  })
                : candidate
            )
          : [...state.leaseholdTransferOrderEntries, normalized],
      };
    });

    return normalized.id;
  },
  removeLeaseholdTransferOrderEntry: (sourceRowId) =>
    set((state) => ({
      leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries.filter(
        (entry) => entry.sourceRowId !== sourceRowId
      ),
    })),
  setActiveNode: (id) => set({ activeNodeId: id }),
  setActiveDeskMap: (id) =>
    set((state) => ({
      activeDeskMapId: resolveActiveDeskMapId(state.deskMaps, id),
    })),
  addInstrumentType: (type) =>
    set((state) => ({
      instrumentTypes: state.instrumentTypes.includes(type)
        ? state.instrumentTypes
        : [...state.instrumentTypes, type],
    })),

  createDeskMap: (name, code, initialNodeIds) => {
    const id = `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      deskMaps: [
        ...state.deskMaps,
        normalizeDeskMap(
          {
            id,
            name,
            code,
            tractId: null,
            grossAcres: '',
            pooledAcres: '',
            description: '',
            nodeIds: initialNodeIds ?? [],
          },
          name
        ),
      ],
      activeDeskMapId: id,
    }));
    return id;
  },

  renameDeskMap: (id, name) =>
    set((state) => ({
      deskMaps: state.deskMaps.map((dm) => (dm.id === id ? { ...dm, name } : dm)),
    })),

  updateDeskMapDetails: (id, fields) =>
    set((state) => ({
      deskMaps: state.deskMaps.map((deskMap) =>
        deskMap.id === id
          ? normalizeDeskMap(
              {
                ...deskMap,
                ...fields,
              },
              deskMap.name
            )
          : deskMap
      ),
    })),

  deleteDeskMap: (id) =>
    set((state) => {
      void useMapStore.getState().unlinkDeskMap(id);
      const remainingDeskMaps = state.deskMaps.filter((dm) => dm.id !== id);
      return {
        deskMaps: remainingDeskMaps,
        leaseholdAssignments: state.leaseholdAssignments.filter(
          (assignment) => assignment.deskMapId !== id
        ),
        leaseholdOrris: state.leaseholdOrris.filter((orri) => orri.deskMapId !== id),
        leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries.filter(
          (entry) => !entry.sourceRowId.startsWith(`royalty-${id}-`)
        ),
        activeDeskMapId: state.activeDeskMapId === id
          ? (remainingDeskMaps[0]?.id ?? null)
          : state.activeDeskMapId,
      };
    }),

  getActiveDeskMapNodes: () => {
    const { nodes, deskMaps, activeDeskMapId } = get();
    const resolvedDeskMapId = resolveActiveDeskMapId(deskMaps, activeDeskMapId);
    if (!resolvedDeskMapId) return [];
    const dm = deskMaps.find((d) => d.id === resolvedDeskMapId);
    if (!dm) return [];
    if (dm.nodeIds.length === 0) return [];
    const idSet = new Set(dm.nodeIds);
    return nodes.filter((n) => idSet.has(n.id));
  },

  convey: (parentId, newNodeId, share, form) => {
    const state = get();
    const result = executeConveyance({ allNodes: state.nodes, parentId, newNodeId, share, form });
    if (result.ok) {
      const targetDeskMapId = resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
      const dmUpdate = targetDeskMapId
        ? {
            deskMaps: state.deskMaps.map((dm) =>
              dm.id === targetDeskMapId
                ? { ...dm, nodeIds: [...dm.nodeIds, newNodeId] }
                : dm
            ),
            activeDeskMapId: targetDeskMapId,
          }
        : {};
      set({
        nodes: result.data.map((node) => normalizeOwnershipNode(node)),
        lastAudit: result.audit,
        lastError: null,
        ...dmUpdate,
      });
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  createNpri: (parentId, newNodeId, share, form) => {
    const state = get();
    const result = executeCreateNpri({
      allNodes: state.nodes,
      parentId,
      newNodeId,
      share,
      form,
    });
    if (result.ok) {
      const targetDeskMapId = resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
      const dmUpdate = targetDeskMapId
        ? {
            deskMaps: state.deskMaps.map((dm) =>
              dm.id === targetDeskMapId
                ? { ...dm, nodeIds: [...dm.nodeIds, newNodeId] }
                : dm
            ),
            activeDeskMapId: targetDeskMapId,
          }
        : {};
      set({
        nodes: result.data.map((node) => normalizeOwnershipNode(node)),
        lastAudit: result.audit,
        lastError: null,
        ...dmUpdate,
      });
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  rebalance: (nodeId, newInitialFraction, formFields) => {
    const { nodes } = get();
    const parentId = findParentId(nodes, nodeId);
    const result = executeRebalance({ allNodes: nodes, nodeId, newInitialFraction, parentId: parentId ?? undefined, formFields });
    if (result.ok) {
      set({
        nodes: result.data.map((node) => normalizeOwnershipNode(node)),
        lastAudit: result.audit,
        lastError: null,
      });
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  insertPredecessor: (activeNodeId, newPredecessorId, newInitialFraction, form) => {
    const state = get();
    const parentId = findParentId(state.nodes, activeNodeId);
    const result = executePredecessorInsert({
      allNodes: state.nodes,
      activeNodeId,
      activeNodeParentId: parentId,
      newPredecessorId,
      newInitialFraction,
      form,
    });
    if (result.ok) {
      const targetDeskMapId = resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
      const dmUpdate = targetDeskMapId
        ? {
            deskMaps: state.deskMaps.map((dm) =>
              dm.id === targetDeskMapId
                ? { ...dm, nodeIds: [...dm.nodeIds, newPredecessorId] }
                : dm
            ),
            activeDeskMapId: targetDeskMapId,
          }
        : {};
      set({
        nodes: result.data.map((node) => normalizeOwnershipNode(node)),
        lastAudit: result.audit,
        lastError: null,
        ...dmUpdate,
      });
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  attachConveyance: (activeNodeId, attachParentId, calcShare, form) => {
    const { nodes } = get();
    const result = executeAttachConveyance({ allNodes: nodes, activeNodeId, attachParentId, calcShare, form });
    if (result.ok) {
      set({
        nodes: result.data.map((node) => normalizeOwnershipNode(node)),
        lastAudit: result.audit,
        lastError: null,
      });
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),

  updateNode: (id, fields) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)),
    })),

  removeNode: (id) => {
    const state = get();
    const result = executeDeleteBranch({ allNodes: state.nodes, nodeId: id });
    if (!result.ok) {
      set({ lastError: result.error.message });
      return;
    }

    const remainingIds = new Set(result.data.map((node) => node.id));
    const removedIds = state.nodes
      .filter((node) => !remainingIds.has(node.id))
      .map((node) => node.id);
    set({
      nodes: result.data.map((node) => normalizeOwnershipNode(node)),
      deskMaps: state.deskMaps.map((dm) => ({
        ...dm,
        nodeIds: dm.nodeIds.filter((nodeId) => remainingIds.has(nodeId)),
      })),
      activeNodeId:
        state.activeNodeId && remainingIds.has(state.activeNodeId)
          ? state.activeNodeId
          : null,
      lastAudit: result.audit,
      lastError: null,
    });
    for (const removedId of removedIds) {
      void useMapStore.getState().unlinkNode(removedId);
    }
  },

  clearLinkedOwner: (ownerId) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.linkedOwnerId === ownerId ? { ...node, linkedOwnerId: null } : node
      ),
    })),

  clearLinkedLease: (leaseId) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.linkedLeaseId === leaseId ? { ...node, linkedLeaseId: null } : node
      ),
    })),

  syncLeaseNodesFromRecord: (lease) =>
    set((state) => {
      const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
      let changed = false;

      const nextNodes = state.nodes.map((node) => {
        if (!isLeaseNode(node) || node.linkedLeaseId !== lease.id) {
          return node;
        }

        const parentNode = node.parentId ? nodeById.get(node.parentId) ?? null : null;
        if (!parentNode) {
          return node;
        }

        changed = true;
        return normalizeOwnershipNode(
          buildLeaseNode({
            id: node.id,
            parentNode,
            lease,
            existingNode: node,
          })
        );
      });

      return changed ? { nodes: nextNodes } : {};
    }),

  addNodeToActiveDeskMap: (nodeId) =>
    set((state) => {
      const targetDeskMapId = resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
      if (!targetDeskMapId) return {};
      return {
        activeDeskMapId: targetDeskMapId,
        deskMaps: state.deskMaps.map((dm) =>
          dm.id === targetDeskMapId
            ? { ...dm, nodeIds: [...dm.nodeIds, nodeId] }
            : dm
        ),
      };
    }),

  setHydrated: () => set({ _hydrated: true }),
  setStartupWarning: (startupWarning) => set({ startupWarning }),

  loadWorkspace: (data) =>
    set(() => {
      const normalizedNodes = data.nodes.map((node) => normalizeOwnershipNode(node));
      const nodeIdSet = new Set(normalizedNodes.map((node) => node.id));
      const normalizedDeskMaps = data.deskMaps.map((deskMap, index) =>
        normalizeDeskMap(
          {
            ...deskMap,
            nodeIds: deskMap.nodeIds.filter((nodeId) => nodeIdSet.has(nodeId)),
          },
          `Tract ${index + 1}`
        )
      );
      const validDeskMapIds = new Set(normalizedDeskMaps.map((deskMap) => deskMap.id));

      return {
        workspaceId: data.workspaceId,
        projectName: data.projectName,
        nodes: normalizedNodes,
        deskMaps: normalizedDeskMaps,
        leaseholdUnit: normalizeLeaseholdUnit(data.leaseholdUnit),
        leaseholdAssignments: normalizeLeaseholdAssignments(data.leaseholdAssignments, {
          validDeskMapIds,
        }),
        leaseholdOrris: normalizeLeaseholdOrris(data.leaseholdOrris, { validDeskMapIds }),
        leaseholdTransferOrderEntries: normalizeLeaseholdTransferOrderEntries(
          data.leaseholdTransferOrderEntries
        ),
        activeDeskMapId: resolveActiveDeskMapId(
          normalizedDeskMaps,
          data.activeDeskMapId
        ),
        instrumentTypes: data.instrumentTypes?.length
          ? data.instrumentTypes
          : [...DEFAULT_INSTRUMENT_TYPES],
        _hydrated: true,
        activeNodeId: null,
        lastAudit: null,
        lastError: null,
        startupWarning: null,
      };
    }),
}));
