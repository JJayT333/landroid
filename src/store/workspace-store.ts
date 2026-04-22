/**
 * Core workspace state — nodes, deskmaps, active selections.
 *
 * Uses Zustand for minimal reactive state management.
 * All math operations go through the engine and produce immutable updates.
 */
import { create } from 'zustand';
import { buildLeaseNode, isLeaseNode } from '../components/deskmap/deskmap-lease-node';
import { useCurativeStore } from './curative-store';
import { useMapStore } from './map-store';
import { deletePdf } from '../storage/pdf-store';
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
import { isTexasMathLease, type Lease } from '../types/owner';
import {
  executeConveyance,
  executeCreateNpri,
  executeCreateRootNode,
  executeRebalance,
  executePredecessorInsert,
  executeAttachConveyance,
  executeDeleteBranch,
} from '../engine/math-engine';
import type { Audit } from '../types/result';
import { createWorkspaceId } from '../utils/workspace-id';
import { resolveActiveUnitCode } from '../utils/desk-map-units';

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
  activeUnitCode: string | null;
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
  setActiveUnitCode: (unitCode: string | null) => void;
  addInstrumentType: (type: string) => void;

  // Desk map management
  createDeskMap: (
    name: string,
    code: string,
    initialNodeIds?: string[],
    fields?: Partial<
      Pick<
        DeskMap,
        'tractId' | 'grossAcres' | 'pooledAcres' | 'description' | 'unitName' | 'unitCode'
      >
    >
  ) => string;
  renameDeskMap: (id: string, name: string) => void;
  updateDeskMapDetails: (
    id: string,
    fields: Partial<
      Pick<
        DeskMap,
        'grossAcres' | 'pooledAcres' | 'description' | 'unitName' | 'unitCode'
      >
    >
  ) => void;
  clearDeskMapNodes: (id: string) => void;
  deleteDeskMap: (id: string) => void;
  getActiveDeskMapNodes: () => OwnershipNode[];

  // Math operations (delegate to engine, replace nodes on success)
  convey: (parentId: string, newNodeId: string, share: string, form: Partial<OwnershipNode>) => boolean;
  createNpri: (parentId: string, newNodeId: string, share: string, form: Partial<OwnershipNode>) => boolean;
  createRootNode: (newNodeId: string, initialFraction: string, form: Partial<OwnershipNode>, deskMapId?: string) => boolean;
  rebalance: (nodeId: string, newInitialFraction: string, formFields?: Partial<OwnershipNode>) => boolean;
  insertPredecessor: (activeNodeId: string, newPredecessorId: string, newInitialFraction: string, form: Partial<OwnershipNode>) => boolean;
  attachConveyance: (activeNodeId: string, attachParentId: string, calcShare: string, form: Partial<OwnershipNode>) => boolean;
  attachLease: (mineralNodeId: string, lease: Lease, leaseNodeId?: string) => string | null;

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
    activeUnitCode?: string | null;
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

function collectDescendantIds(
  nodes: OwnershipNode[],
  rootIds: Set<string>
): Set<string> {
  const childrenByParentId = new Map<string, string[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const children = childrenByParentId.get(node.parentId) ?? [];
    children.push(node.id);
    childrenByParentId.set(node.parentId, children);
  }

  const collected = new Set(rootIds);
  const stack = [...rootIds];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    for (const childId of childrenByParentId.get(currentId) ?? []) {
      if (collected.has(childId)) continue;
      collected.add(childId);
      stack.push(childId);
    }
  }
  return collected;
}

function collectAncestorIds(
  nodes: OwnershipNode[],
  startIds: Set<string>
): Set<string> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const ancestors = new Set<string>();

  for (const id of startIds) {
    let parentId = nodeById.get(id)?.parentId ?? null;
    while (parentId) {
      if (ancestors.has(parentId)) break;
      ancestors.add(parentId);
      parentId = nodeById.get(parentId)?.parentId ?? null;
    }
  }

  return ancestors;
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
  activeUnitCode: null,
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
    const state = get();
    const validUnitCodes = new Set(
      state.deskMaps.flatMap((deskMap) => (deskMap.unitCode ? [deskMap.unitCode] : []))
    );
    const next = normalizeLeaseholdAssignment({
      ...createBlankLeaseholdAssignment(),
      unitCode: assignment.scope === 'tract' ? null : state.activeUnitCode,
      ...assignment,
    }, { validUnitCodes });
    set((state) => ({
      leaseholdAssignments: [...state.leaseholdAssignments, next],
    }));
    return next.id;
  },
  updateLeaseholdAssignment: (id, fields) =>
    set((state) => {
      const validDeskMapIds = new Set(state.deskMaps.map((deskMap) => deskMap.id));
      const validUnitCodes = new Set(
        state.deskMaps.flatMap((deskMap) => (deskMap.unitCode ? [deskMap.unitCode] : []))
      );
      return {
        leaseholdAssignments: state.leaseholdAssignments.map((assignment) =>
          assignment.id === id
            ? normalizeLeaseholdAssignment(
                {
                  ...assignment,
                  ...fields,
                  unitCode:
                    fields.scope === 'tract'
                      ? null
                      : fields.scope === 'unit' && fields.unitCode === undefined
                        ? state.activeUnitCode
                        : fields.unitCode ?? assignment.unitCode,
                },
                { validDeskMapIds, validUnitCodes }
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
    const state = get();
    const validUnitCodes = new Set(
      state.deskMaps.flatMap((deskMap) => (deskMap.unitCode ? [deskMap.unitCode] : []))
    );
    const next = normalizeLeaseholdOrri({
      unitCode: orri.scope === 'tract' ? null : state.activeUnitCode,
      ...orri,
    }, { validUnitCodes });
    set((state) => ({
      leaseholdOrris: [...state.leaseholdOrris, next],
    }));
    return next.id;
  },
  updateLeaseholdOrri: (id, fields) =>
    set((state) => {
      const validDeskMapIds = new Set(state.deskMaps.map((deskMap) => deskMap.id));
      const validUnitCodes = new Set(
        state.deskMaps.flatMap((deskMap) => (deskMap.unitCode ? [deskMap.unitCode] : []))
      );
      return {
        leaseholdOrris: state.leaseholdOrris.map((orri) =>
          orri.id === id
            ? normalizeLeaseholdOrri(
                {
                  ...orri,
                  ...fields,
                  unitCode:
                    fields.scope === 'tract'
                      ? null
                      : fields.scope === 'unit' && fields.unitCode === undefined
                        ? state.activeUnitCode
                        : fields.unitCode ?? orri.unitCode,
                },
                { validDeskMapIds, validUnitCodes }
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
    set((state) => {
      const activeDeskMapId = resolveActiveDeskMapId(state.deskMaps, id);
      const activeDeskMap = activeDeskMapId
        ? state.deskMaps.find((deskMap) => deskMap.id === activeDeskMapId) ?? null
        : null;
      return {
        activeDeskMapId,
        activeUnitCode: activeDeskMap?.unitCode
          ? activeDeskMap.unitCode
          : resolveActiveUnitCode(state.deskMaps, state.activeUnitCode, activeDeskMapId),
      };
    }),
  setActiveUnitCode: (unitCode) =>
    set((state) => {
      const activeUnitCode = resolveActiveUnitCode(
        state.deskMaps,
        unitCode,
        state.activeDeskMapId
      );
      const activeDeskMapId = activeUnitCode
        ? state.deskMaps.find((deskMap) => deskMap.unitCode === activeUnitCode)?.id
          ?? state.activeDeskMapId
        : state.activeDeskMapId;

      return {
        activeUnitCode,
        activeDeskMapId: resolveActiveDeskMapId(state.deskMaps, activeDeskMapId),
      };
    }),
  addInstrumentType: (type) =>
    set((state) => ({
      instrumentTypes: state.instrumentTypes.includes(type)
        ? state.instrumentTypes
        : [...state.instrumentTypes, type],
    })),

  createDeskMap: (name, code, initialNodeIds, fields = {}) => {
    const id = `dm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const normalized = normalizeDeskMap(
      {
        id,
        name,
        code,
        tractId: fields.tractId ?? null,
        grossAcres: fields.grossAcres ?? '',
        pooledAcres: fields.pooledAcres ?? '',
        description: fields.description ?? '',
        nodeIds: initialNodeIds ?? [],
        unitName: fields.unitName,
        unitCode: fields.unitCode,
      },
      name
    );
    set((state) => ({
      deskMaps: [...state.deskMaps, normalized],
      activeDeskMapId: id,
      activeUnitCode: normalized.unitCode
        ? normalized.unitCode
        : resolveActiveUnitCode([...state.deskMaps, normalized], state.activeUnitCode, id),
    }));
    return id;
  },

  renameDeskMap: (id, name) =>
    set((state) => ({
      deskMaps: state.deskMaps.map((dm) => (dm.id === id ? { ...dm, name } : dm)),
    })),

  updateDeskMapDetails: (id, fields) =>
    set((state) => {
      const deskMaps = state.deskMaps.map((deskMap) =>
        deskMap.id === id
          ? normalizeDeskMap(
              {
                ...deskMap,
                ...fields,
              },
              deskMap.name
            )
          : deskMap
      );
      return {
        deskMaps,
        activeUnitCode: resolveActiveUnitCode(
          deskMaps,
          state.activeUnitCode,
          state.activeDeskMapId
        ),
      };
    }),

  clearDeskMapNodes: (id) => {
    const state = get();
    const targetDeskMap = state.deskMaps.find((deskMap) => deskMap.id === id);
    if (!targetDeskMap) {
      set({ lastError: `Desk map ${id} not found` });
      return;
    }

    const activeIds = new Set(targetDeskMap.nodeIds);
    if (activeIds.size === 0) {
      set({ lastError: null });
      return;
    }

    const idsReferencedElsewhere = new Set(
      state.deskMaps
        .filter((deskMap) => deskMap.id !== id)
        .flatMap((deskMap) => deskMap.nodeIds)
    );
    const deleteCandidates = collectDescendantIds(state.nodes, activeIds);
    const protectedAncestors = collectAncestorIds(state.nodes, idsReferencedElsewhere);

    for (const protectedId of idsReferencedElsewhere) {
      deleteCandidates.delete(protectedId);
    }
    for (const protectedId of protectedAncestors) {
      deleteCandidates.delete(protectedId);
    }

    const deletedIds = [...deleteCandidates];
    const deletedIdSet = new Set(deletedIds);

    set({
      nodes: state.nodes.filter((node) => !deletedIdSet.has(node.id)),
      deskMaps: state.deskMaps.map((deskMap) =>
        deskMap.id === id
          ? { ...deskMap, nodeIds: [] }
          : {
              ...deskMap,
              nodeIds: deskMap.nodeIds.filter((nodeId) => !deletedIdSet.has(nodeId)),
            }
      ),
      leaseholdAssignments: state.leaseholdAssignments.filter(
        (assignment) => assignment.deskMapId !== id
      ),
      leaseholdOrris: state.leaseholdOrris.filter((orri) => orri.deskMapId !== id),
      leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries.filter(
        (entry) => !entry.sourceRowId.startsWith(`royalty-${id}-`)
      ),
      activeNodeId:
        state.activeNodeId && activeIds.has(state.activeNodeId)
          ? null
          : state.activeNodeId,
      lastAudit: null,
      lastError: null,
    });

    for (const nodeId of deletedIds) {
      void deletePdf(nodeId);
      void useMapStore.getState().unlinkNode(nodeId);
      useCurativeStore.getState().unlinkNode(nodeId);
    }
  },

  deleteDeskMap: (id) =>
    set((state) => {
      void useMapStore.getState().unlinkDeskMap(id);
      useCurativeStore.getState().unlinkDeskMap(id);
      const remainingDeskMaps = state.deskMaps.filter((dm) => dm.id !== id);
      const activeDeskMapId = state.activeDeskMapId === id
        ? (remainingDeskMaps[0]?.id ?? null)
        : state.activeDeskMapId;
      const activeUnitCode = resolveActiveUnitCode(
        remainingDeskMaps,
        state.activeUnitCode,
        activeDeskMapId
      );
      return {
        deskMaps: remainingDeskMaps,
        leaseholdAssignments: state.leaseholdAssignments.filter(
          (assignment) => assignment.deskMapId !== id
        ),
        leaseholdOrris: state.leaseholdOrris.filter((orri) => orri.deskMapId !== id),
        leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries.filter(
          (entry) => !entry.sourceRowId.startsWith(`royalty-${id}-`)
        ),
        activeDeskMapId: activeUnitCode
          ? remainingDeskMaps.find((deskMap) => deskMap.unitCode === activeUnitCode)?.id
            ?? activeDeskMapId
          : activeDeskMapId,
        activeUnitCode,
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
      // Child always lives in the same tract as its parent. Falls back to the
      // active desk map only when the parent has somehow been orphaned from
      // every tract (shouldn't happen via the AI tools, but possible in
      // legacy workspaces).
      const parentDeskMap = state.deskMaps.find((dm) => dm.nodeIds.includes(parentId));
      const targetDeskMapId = parentDeskMap?.id
        ?? resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
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
      const parentDeskMap = state.deskMaps.find((dm) => dm.nodeIds.includes(parentId));
      const targetDeskMapId = parentDeskMap?.id
        ?? resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
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

  createRootNode: (newNodeId, initialFraction, form, deskMapId) => {
    const state = get();
    const result = executeCreateRootNode({
      allNodes: state.nodes,
      newNodeId,
      initialFraction,
      form,
    });
    if (result.ok) {
      const explicitDeskMapExists =
        deskMapId !== undefined
        && state.deskMaps.some((dm) => dm.id === deskMapId);
      const targetDeskMapId = explicitDeskMapExists
        ? deskMapId!
        : resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
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
      // Predecessor joins the same tract as the node it now parents.
      const childDeskMap = state.deskMaps.find((dm) => dm.nodeIds.includes(activeNodeId));
      const targetDeskMapId = childDeskMap?.id
        ?? resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
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

  attachLease: (mineralNodeId, lease, leaseNodeId) => {
    const state = get();
    const parent = state.nodes.find((n) => n.id === mineralNodeId);
    if (!parent) {
      set({ lastError: `Mineral node ${mineralNodeId} not found` });
      return null;
    }
    if (parent.type === 'related') {
      set({ lastError: 'Leases must attach to a title-interest node, not a lease or document node' });
      return null;
    }
    if (parent.interestClass !== 'mineral') {
      set({ lastError: 'Leases can only attach to mineral nodes, never NPRI' });
      return null;
    }
    if (!isTexasMathLease(lease)) {
      set({
        lastError:
          'Only Texas fee/state leases can attach to Desk Map math. Keep federal/private/tribal leases in Research or Federal Leasing as reference records.',
      });
      return null;
    }
    if (parent.linkedOwnerId && lease.ownerId !== parent.linkedOwnerId) {
      set({
        lastError:
          'Lease owner does not match the mineral node linked owner. Link the correct owner or create a separate lease record before attaching.',
      });
      return null;
    }

    const newId =
      leaseNodeId
      ?? `leasenode-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (state.nodes.some((n) => n.id === newId)) {
      set({ lastError: `Node id ${newId} already exists` });
      return null;
    }

    const leaseNode = normalizeOwnershipNode(
      buildLeaseNode({ id: newId, parentNode: parent, lease })
    );
    // Lease node lives in the same tract as the mineral owner it burdens,
    // never blindly the active desk map (which may be a different tract).
    const parentDeskMap = state.deskMaps.find((dm) => dm.nodeIds.includes(mineralNodeId));
    const targetDeskMapId = parentDeskMap?.id
      ?? resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
    set({
      nodes: [...state.nodes, leaseNode],
      deskMaps: targetDeskMapId
        ? state.deskMaps.map((dm) =>
            dm.id === targetDeskMapId
              ? { ...dm, nodeIds: [...dm.nodeIds, newId] }
              : dm
          )
        : state.deskMaps,
      activeDeskMapId: targetDeskMapId ?? state.activeDeskMapId,
      lastError: null,
    });
    return newId;
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
      void deletePdf(removedId);
      void useMapStore.getState().unlinkNode(removedId);
      useCurativeStore.getState().unlinkNode(removedId);
    }
  },

  clearLinkedOwner: (ownerId) =>
    set((state) => {
      useCurativeStore.getState().unlinkOwner(ownerId);
      return {
        nodes: state.nodes.map((node) =>
          node.linkedOwnerId === ownerId ? { ...node, linkedOwnerId: null } : node
        ),
      };
    }),

  clearLinkedLease: (leaseId) =>
    set((state) => {
      useCurativeStore.getState().unlinkLease(leaseId);
      return {
        nodes: state.nodes.map((node) =>
          node.linkedLeaseId === leaseId
            ? {
                ...node,
                date: '',
                fileDate: '',
                docNo: '',
                grantee: '',
                remarks: 'Lease record removed; review or delete this lessee card.',
                linkedLeaseId: null,
              }
            : node
        ),
      };
    }),

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
      const validUnitCodes = new Set(
        normalizedDeskMaps.flatMap((deskMap) =>
          deskMap.unitCode ? [deskMap.unitCode] : []
        )
      );
      const activeDeskMapId = resolveActiveDeskMapId(
        normalizedDeskMaps,
        data.activeDeskMapId
      );
      const activeUnitCode = resolveActiveUnitCode(
        normalizedDeskMaps,
        data.activeUnitCode,
        activeDeskMapId
      );

      return {
        workspaceId: data.workspaceId,
        projectName: data.projectName,
        nodes: normalizedNodes,
        deskMaps: normalizedDeskMaps,
        leaseholdUnit: normalizeLeaseholdUnit(data.leaseholdUnit),
        leaseholdAssignments: normalizeLeaseholdAssignments(data.leaseholdAssignments, {
          validDeskMapIds,
          validUnitCodes,
        }),
        leaseholdOrris: normalizeLeaseholdOrris(data.leaseholdOrris, {
          validDeskMapIds,
          validUnitCodes,
        }),
        leaseholdTransferOrderEntries: normalizeLeaseholdTransferOrderEntries(
          data.leaseholdTransferOrderEntries
        ),
        activeDeskMapId: activeUnitCode
          ? normalizedDeskMaps.find((deskMap) => deskMap.unitCode === activeUnitCode)?.id
            ?? activeDeskMapId
          : activeDeskMapId,
        activeUnitCode,
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
