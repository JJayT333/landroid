/**
 * Core workspace state — nodes, deskmaps, active selections.
 *
 * Uses Zustand for minimal reactive state management.
 * All math operations go through the engine and produce immutable updates.
 */
import { create } from 'zustand';
import type { OwnershipNode, DeskMap } from '../types/node';
import {
  executeConveyance,
  executeRebalance,
  executePredecessorInsert,
  executeAttachConveyance,
} from '../engine/math-engine';
import type { Audit } from '../types/result';

const DEFAULT_INSTRUMENT_TYPES = [
  'Deed',
  'Mineral Deed',
  'Royalty Deed',
  'Warranty Deed',
  'Quitclaim Deed',
  'Assignment',
  'Oil & Gas Lease',
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
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  activeDeskMapId: string | null;
  instrumentTypes: string[];

  // Lifecycle
  _hydrated: boolean;

  // UI
  activeNodeId: string | null;
  lastAudit: Audit | null;
  lastError: string | null;

  // Actions
  setProjectName: (name: string) => void;
  setActiveNode: (id: string | null) => void;
  setActiveDeskMap: (id: string) => void;
  addInstrumentType: (type: string) => void;

  // Desk map management
  createDeskMap: (name: string, code: string, initialNodeIds?: string[]) => string;
  renameDeskMap: (id: string, name: string) => void;
  deleteDeskMap: (id: string) => void;
  getActiveDeskMapNodes: () => OwnershipNode[];

  // Math operations (delegate to engine, replace nodes on success)
  convey: (parentId: string, newNodeId: string, share: string, form: Partial<OwnershipNode>) => boolean;
  rebalance: (nodeId: string, newInitialFraction: string, formFields?: Partial<OwnershipNode>) => boolean;
  insertPredecessor: (activeNodeId: string, newPredecessorId: string, newInitialFraction: string, form: Partial<OwnershipNode>) => boolean;
  attachConveyance: (activeNodeId: string, attachParentId: string, calcShare: string, form: Partial<OwnershipNode>) => boolean;

  // CRUD
  addNode: (node: OwnershipNode) => void;
  updateNode: (id: string, fields: Partial<OwnershipNode>) => void;
  removeNode: (id: string) => void;
  addNodeToActiveDeskMap: (nodeId: string) => void;
  setHydrated: () => void;
  loadWorkspace: (data: { projectName: string; nodes: OwnershipNode[]; deskMaps: DeskMap[]; activeDeskMapId: string | null; instrumentTypes?: string[] }) => void;
}

function findParentId(nodes: OwnershipNode[], nodeId: string): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  return node?.parentId ?? null;
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  projectName: 'Untitled Workspace',
  nodes: [],
  deskMaps: [],
  activeDeskMapId: null,
  instrumentTypes: [...DEFAULT_INSTRUMENT_TYPES],
  _hydrated: false,
  activeNodeId: null,
  lastAudit: null,
  lastError: null,

  setProjectName: (name) => set({ projectName: name }),
  setActiveNode: (id) => set({ activeNodeId: id }),
  setActiveDeskMap: (id) => set({ activeDeskMapId: id }),
  addInstrumentType: (type) =>
    set((state) => ({
      instrumentTypes: state.instrumentTypes.includes(type)
        ? state.instrumentTypes
        : [...state.instrumentTypes, type],
    })),

  createDeskMap: (name, code, initialNodeIds) => {
    const id = `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      deskMaps: [...state.deskMaps, { id, name, code, tractId: null, nodeIds: initialNodeIds ?? [] }],
      activeDeskMapId: id,
    }));
    return id;
  },

  renameDeskMap: (id, name) =>
    set((state) => ({
      deskMaps: state.deskMaps.map((dm) => (dm.id === id ? { ...dm, name } : dm)),
    })),

  deleteDeskMap: (id) =>
    set((state) => ({
      deskMaps: state.deskMaps.filter((dm) => dm.id !== id),
      activeDeskMapId: state.activeDeskMapId === id
        ? (state.deskMaps.find((dm) => dm.id !== id)?.id ?? null)
        : state.activeDeskMapId,
    })),

  getActiveDeskMapNodes: () => {
    const { nodes, deskMaps, activeDeskMapId } = get();
    if (!activeDeskMapId || deskMaps.length === 0) return nodes;
    const dm = deskMaps.find((d) => d.id === activeDeskMapId);
    if (!dm) return [];
    if (dm.nodeIds.length === 0) return [];
    const idSet = new Set(dm.nodeIds);
    return nodes.filter((n) => idSet.has(n.id));
  },

  convey: (parentId, newNodeId, share, form) => {
    const state = get();
    const result = executeConveyance({ allNodes: state.nodes, parentId, newNodeId, share, form });
    if (result.ok) {
      const dmUpdate = state.activeDeskMapId
        ? { deskMaps: state.deskMaps.map((dm) => dm.id === state.activeDeskMapId ? { ...dm, nodeIds: [...dm.nodeIds, newNodeId] } : dm) }
        : {};
      set({ nodes: result.data, lastAudit: result.audit, lastError: null, ...dmUpdate });
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
      set({ nodes: result.data, lastAudit: result.audit, lastError: null });
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
      const dmUpdate = state.activeDeskMapId
        ? { deskMaps: state.deskMaps.map((dm) => dm.id === state.activeDeskMapId ? { ...dm, nodeIds: [...dm.nodeIds, newPredecessorId] } : dm) }
        : {};
      set({ nodes: result.data, lastAudit: result.audit, lastError: null, ...dmUpdate });
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  attachConveyance: (activeNodeId, attachParentId, calcShare, form) => {
    const { nodes } = get();
    const result = executeAttachConveyance({ allNodes: nodes, activeNodeId, attachParentId, calcShare, form });
    if (result.ok) {
      set({ nodes: result.data, lastAudit: result.audit, lastError: null });
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

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      deskMaps: state.deskMaps.map((dm) =>
        dm.nodeIds.includes(id)
          ? { ...dm, nodeIds: dm.nodeIds.filter((nid) => nid !== id) }
          : dm
      ),
      activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
    })),

  addNodeToActiveDeskMap: (nodeId) =>
    set((state) => {
      if (!state.activeDeskMapId) return {};
      return {
        deskMaps: state.deskMaps.map((dm) =>
          dm.id === state.activeDeskMapId
            ? { ...dm, nodeIds: [...dm.nodeIds, nodeId] }
            : dm
        ),
      };
    }),

  setHydrated: () => set({ _hydrated: true }),

  loadWorkspace: (data) =>
    set({
      projectName: data.projectName,
      nodes: data.nodes,
      deskMaps: data.deskMaps,
      activeDeskMapId: data.activeDeskMapId ?? data.deskMaps[0]?.id ?? null,
      instrumentTypes: data.instrumentTypes?.length ? data.instrumentTypes : [...DEFAULT_INSTRUMENT_TYPES],
      _hydrated: true,
      activeNodeId: null,
      lastAudit: null,
      lastError: null,
    }),
}));
