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

interface WorkspaceState {
  // Data
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  activeDeskMapId: string | null;

  // UI
  activeNodeId: string | null;
  lastAudit: Audit | null;
  lastError: string | null;

  // Actions
  setProjectName: (name: string) => void;
  setActiveNode: (id: string | null) => void;
  setActiveDeskMap: (id: string) => void;

  // Math operations (delegate to engine, replace nodes on success)
  convey: (parentId: string, newNodeId: string, share: string, form: Partial<OwnershipNode>) => boolean;
  rebalance: (nodeId: string, newInitialFraction: string, formFields?: Partial<OwnershipNode>) => boolean;
  insertPredecessor: (activeNodeId: string, newPredecessorId: string, newInitialFraction: string, form: Partial<OwnershipNode>) => boolean;
  attachConveyance: (activeNodeId: string, attachParentId: string, calcShare: string, form: Partial<OwnershipNode>) => boolean;

  // CRUD
  addNode: (node: OwnershipNode) => void;
  updateNode: (id: string, fields: Partial<OwnershipNode>) => void;
  removeNode: (id: string) => void;
  loadWorkspace: (data: { projectName: string; nodes: OwnershipNode[]; deskMaps: DeskMap[]; activeDeskMapId: string | null }) => void;
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
  activeNodeId: null,
  lastAudit: null,
  lastError: null,

  setProjectName: (name) => set({ projectName: name }),
  setActiveNode: (id) => set({ activeNodeId: id }),
  setActiveDeskMap: (id) => set({ activeDeskMapId: id }),

  convey: (parentId, newNodeId, share, form) => {
    const { nodes } = get();
    const result = executeConveyance({ allNodes: nodes, parentId, newNodeId, share, form });
    if (result.ok) {
      set({ nodes: result.data, lastAudit: result.audit, lastError: null });
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
    const { nodes } = get();
    const parentId = findParentId(nodes, activeNodeId);
    const result = executePredecessorInsert({
      allNodes: nodes,
      activeNodeId,
      activeNodeParentId: parentId,
      newPredecessorId,
      newInitialFraction,
      form,
    });
    if (result.ok) {
      set({ nodes: result.data, lastAudit: result.audit, lastError: null });
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
      activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
    })),

  loadWorkspace: (data) =>
    set({
      projectName: data.projectName,
      nodes: data.nodes,
      deskMaps: data.deskMaps,
      activeDeskMapId: data.activeDeskMapId,
      activeNodeId: null,
      lastAudit: null,
      lastError: null,
    }),
}));
