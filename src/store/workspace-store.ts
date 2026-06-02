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
import {
  deleteDocsForAttachments,
  detachDocFromEntity,
  listAttachmentsForNodes,
  reorderAttachments,
  renameDoc,
  saveDoc,
} from '../storage/document-store';

/**
 * Remove attachment links from deleted nodes and delete only the documents
 * that have no surviving links. Fired after a `removeNode` /
 * `clearDeskMapNodes` set so the v9 document rows don't leak, while shared
 * documents remain attached to surviving entities.
 *
 * The storage cleanup is atomic across all affected attachment IDs. The
 * in-memory node delete has already happened when this runs, so callers must
 * surface failures through `lastError`.
 */
async function cascadeDeleteDocsForRemovedNodes(
  removedNodes: ReadonlyArray<{
    attachments: ReadonlyArray<{ attachmentId: string }>;
  }>
): Promise<void> {
  const attachmentIds = new Set<string>();
  for (const node of removedNodes) {
    for (const a of node.attachments) attachmentIds.add(a.attachmentId);
  }
  if (attachmentIds.size === 0) return;
  await deleteDocsForAttachments([...attachmentIds]);
}
import type { OwnershipNode, DeskMap, NodeAttachmentSummary } from '../types/node';
import { normalizeDeskMap, normalizeOwnershipNode } from '../types/node';
import type { DocumentKind } from '../types/document';
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
import type { WorkspaceData } from '../storage/workspace-persistence';

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

async function cleanupOwnerRecordsForRemovedNodes(
  removedNodes: OwnershipNode[],
  survivingNodes: OwnershipNode[]
): Promise<void> {
  const removedOwnerIds = new Set(
    removedNodes
      .map((node) => node.linkedOwnerId)
      .filter((id): id is string => Boolean(id))
  );
  const removedLeaseIds = new Set(
    removedNodes
      .map((node) => node.linkedLeaseId)
      .filter((id): id is string => Boolean(id))
  );
  if (removedOwnerIds.size === 0 && removedLeaseIds.size === 0) return;

  const survivingOwnerIds = new Set(
    survivingNodes
      .map((node) => node.linkedOwnerId)
      .filter((id): id is string => Boolean(id))
  );
  const survivingLeaseIds = new Set(
    survivingNodes
      .map((node) => node.linkedLeaseId)
      .filter((id): id is string => Boolean(id))
  );

  const { useOwnerStore } = await import('./owner-store');
  const leases = useOwnerStore.getState().leases;
  for (const lease of leases) {
    if (survivingLeaseIds.has(lease.id)) {
      survivingOwnerIds.add(lease.ownerId);
    }
  }

  const ownerIdsToRemove = [...removedOwnerIds].filter(
    (ownerId) => !survivingOwnerIds.has(ownerId)
  );
  const ownerIdsToRemoveSet = new Set(ownerIdsToRemove);
  const leaseIdsToRemove = [...removedLeaseIds].filter((leaseId) => {
    if (survivingLeaseIds.has(leaseId)) return false;
    const lease = leases.find((candidate) => candidate.id === leaseId);
    return !lease || !ownerIdsToRemoveSet.has(lease.ownerId);
  });

  for (const leaseId of leaseIdsToRemove) {
    await useOwnerStore.getState().removeLease(leaseId);
  }
  for (const ownerId of ownerIdsToRemove) {
    await useOwnerStore.getState().removeOwner(ownerId);
  }
}

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
  /**
   * Atomic batch attach (audit M1).
   *
   * Either every item attaches or the store is not mutated at all. Returns
   * which orphans would attach (`attached`) and which would fail (`failed`)
   * with per-orphan reasons. On failure the store is NOT mutated — caller
   * must read `failed` and retry after fixing the input.
   */
  batchAttachConveyance: (
    items: Array<{
      activeNodeId: string;
      attachParentId: string;
      calcShare: string;
      form: Partial<OwnershipNode>;
    }>
  ) => {
    ok: boolean;
    attached: string[];
    failed: Array<{ nodeId: string; reason: string }>;
  };
  attachLease: (mineralNodeId: string, lease: Lease, leaseNodeId?: string) => string | null;

  // CRUD
  addNode: (node: OwnershipNode) => void;
  updateNode: (id: string, fields: Partial<OwnershipNode>) => void;
  removeNode: (id: string) => void;
  clearLinkedOwner: (ownerId: string) => void;
  clearLinkedLease: (leaseId: string) => void;
  syncLeaseNodesFromRecord: (lease: Lease) => void;
  addNodeToActiveDeskMap: (nodeId: string) => void;

  // Document attachments (Phase 5 / ADR 0004)
  /**
   * Attach a file to `nodeId` as a new document. Persists through the
   * document-store and appends a summary to the node's `attachments[]`
   * cache. Returns the newly-created summary so callers can show the
   * fresh chip without re-reading.
   */
  attachDocToNode: (
    nodeId: string,
    file: File | Blob,
    options?: { fileName?: string; kind?: DocumentKind }
  ) => Promise<NodeAttachmentSummary | null>;
  /**
   * Remove one attachment link from a node. The underlying document stays in
   * the registry and on any other entities that reference it.
   */
  detachDocFromNode: (nodeId: string, attachmentId: string) => Promise<void>;
  /** Rename a document. Updates every node's `attachments[]` cache. */
  renameDocOnNode: (docId: string, newFileName: string) => Promise<void>;
  /**
   * Reorder a node's attachments. Persists through the document-store
   * and reflects the new order in the node's `attachments[]` cache.
   */
  reorderNodeAttachments: (
    nodeId: string,
    orderedAttachmentIds: ReadonlyArray<string>
  ) => Promise<void>;
  /**
   * Re-read attachment metadata from Dexie and refresh every node's
   * `attachments[]` cache. Call after `loadWorkspace` (initial boot,
   * `.landroid` import) so chips render with the current data.
   * No-op when there are no nodes in state.
   */
  hydrateNodeAttachments: () => Promise<void>;
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

/**
 * Phase 4 title cutover — shadow journal hook (write-path ledger).
 *
 * `title-action-log.ts` registers this at app startup so every successful title
 * mutation is recorded as a durable ActionRecord alongside the canonical store.
 * It is dependency-injected (not imported here) to avoid a cycle, defaults to
 * null (no recording), and is invoked fire-and-forget AFTER the canonical
 * `set()` — it can never change the store's result or state. See
 * docs/phase-4-title-cutover-notes.md.
 */
export type TitleJournalHook = (
  mutation: string,
  beforeWorkspace: WorkspaceData,
  afterWorkspace: WorkspaceData
) => void;

let titleJournalHook: TitleJournalHook | null = null;

export function setTitleJournalHook(hook: TitleJournalHook | null): void {
  titleJournalHook = hook;
}

function snapshotWorkspaceData(state: WorkspaceState): WorkspaceData {
  return {
    workspaceId: state.workspaceId,
    projectName: state.projectName,
    nodes: state.nodes,
    deskMaps: state.deskMaps,
    leaseholdUnit: state.leaseholdUnit,
    leaseholdAssignments: state.leaseholdAssignments,
    leaseholdOrris: state.leaseholdOrris,
    leaseholdTransferOrderEntries: state.leaseholdTransferOrderEntries,
    activeDeskMapId: state.activeDeskMapId,
    activeUnitCode: state.activeUnitCode,
    instrumentTypes: state.instrumentTypes,
  };
}

/**
 * Fire-and-forget hand-off to the shadow journal. `beforeState` is the store
 * state captured before `set()` (its arrays are retained, not mutated, by
 * Zustand's replace), `afterState` is the post-`set()` state. Wrapped so a
 * journal failure can never affect the canonical store.
 */
function journalTitleMutation(
  mutation: string,
  beforeState: WorkspaceState,
  afterState: WorkspaceState
): void {
  if (!titleJournalHook) return;
  try {
    titleJournalHook(
      mutation,
      snapshotWorkspaceData(beforeState),
      snapshotWorkspaceData(afterState)
    );
  } catch (err) {
    console.error('[workspace-store] title journal hook threw (ignored):', err);
  }
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
    const removedNodes = state.nodes.filter((node) => deletedIdSet.has(node.id));
    const survivingNodes = state.nodes.filter((node) => !deletedIdSet.has(node.id));

    set({
      nodes: survivingNodes,
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

    void cascadeDeleteDocsForRemovedNodes(removedNodes).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[workspace-store] document cascade delete failed:', err);
      set({
        lastError: `Document cleanup failed after clearing tract: ${message}. Save a backup and retry cleanup before relying on document registry state.`,
      });
    });
    for (const nodeId of deletedIds) {
      void useMapStore.getState().unlinkNode(nodeId);
      useCurativeStore.getState().unlinkNode(nodeId);
    }
    void cleanupOwnerRecordsForRemovedNodes(removedNodes, survivingNodes).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[workspace-store] owner cleanup failed after clearing tract:', err);
      set({
        lastError: `Owner/lease cleanup failed after clearing tract: ${message}. Review Owners and Leasehold for stale linked records before relying on side-panel data.`,
      });
    });
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
      journalTitleMutation('convey', state, get());
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
      journalTitleMutation('createNpri', state, get());
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  createRootNode: (newNodeId, initialFraction, form, deskMapId) => {
    const state = get();
    // Audit M2: when caller passes an explicit deskMapId it must exist.
    // Silently falling back to the active map lets a mistyped ID attach a
    // root to the wrong tract without any signal to the user. Reject loudly
    // and let the caller retry with a valid ID (or omit it to fall back).
    if (deskMapId !== undefined && !state.deskMaps.some((dm) => dm.id === deskMapId)) {
      set({ lastError: `Desk map not found: ${deskMapId}` });
      return false;
    }
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
      journalTitleMutation('createRootNode', state, get());
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  rebalance: (nodeId, newInitialFraction, formFields) => {
    const state = get();
    const parentId = findParentId(state.nodes, nodeId);
    const result = executeRebalance({ allNodes: state.nodes, nodeId, newInitialFraction, parentId: parentId ?? undefined, formFields });
    if (result.ok) {
      set({
        nodes: result.data.map((node) => normalizeOwnershipNode(node)),
        lastAudit: result.audit,
        lastError: null,
      });
      journalTitleMutation('update', state, get());
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
      journalTitleMutation('precede', state, get());
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  attachConveyance: (activeNodeId, attachParentId, calcShare, form) => {
    const state = get();
    const result = executeAttachConveyance({ allNodes: state.nodes, activeNodeId, attachParentId, calcShare, form });
    if (result.ok) {
      set({
        nodes: result.data.map((node) => normalizeOwnershipNode(node)),
        lastAudit: result.audit,
        lastError: null,
      });
      journalTitleMutation('graftToParent', state, get());
      return true;
    }
    set({ lastError: result.error.message });
    return false;
  },

  batchAttachConveyance: (items) => {
    // Audit M1: either every item attaches or the store is not mutated.
    // We simulate the batch on an in-memory candidate graph; only after all
    // grafts succeed do we commit the result with a single set().
    const before = get();
    const initial = before.nodes;
    let candidate: OwnershipNode[] = initial;
    const attached: string[] = [];
    const failed: Array<{ nodeId: string; reason: string }> = [];
    let lastAudit: Audit | null = null;

    for (const { activeNodeId, attachParentId, calcShare, form } of items) {
      const result = executeAttachConveyance({
        allNodes: candidate,
        activeNodeId,
        attachParentId,
        calcShare,
        form,
      });
      if (result.ok) {
        candidate = result.data;
        lastAudit = result.audit;
        attached.push(activeNodeId);
      } else {
        failed.push({ nodeId: activeNodeId, reason: result.error.message });
      }
    }

    if (failed.length > 0) {
      set({
        lastError: `Batch attach aborted — ${failed.length} of ${items.length} invalid. No change committed.`,
      });
      return { ok: false, attached: [], failed };
    }

    set({
      nodes: candidate.map((node) => normalizeOwnershipNode(node)),
      lastAudit: lastAudit,
      lastError: null,
    });
    journalTitleMutation('graftToParent', before, get());
    return { ok: true, attached, failed: [] };
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
    journalTitleMutation('attachLease', state, get());
    return newId;
  },

  addNode: (node) => {
    const before = get();
    set((state) => ({ nodes: [...state.nodes, node] }));
    journalTitleMutation('update', before, get());
  },

  updateNode: (id, fields) => {
    const before = get();
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)),
    }));
    journalTitleMutation('update', before, get());
  },

  removeNode: (id) => {
    const state = get();
    const result = executeDeleteBranch({ allNodes: state.nodes, nodeId: id });
    if (!result.ok) {
      set({ lastError: result.error.message });
      return;
    }

    const remainingIds = new Set(result.data.map((node) => node.id));
    const removedNodes = state.nodes.filter((node) => !remainingIds.has(node.id));
    const survivingNodes = result.data.map((node) => normalizeOwnershipNode(node));
    const removedIds = removedNodes.map((node) => node.id);
    set({
      nodes: survivingNodes,
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
    journalTitleMutation('deleteNode', state, get());
    void cascadeDeleteDocsForRemovedNodes(removedNodes).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[workspace-store] document cascade delete failed:', err);
      set({
        lastError: `Document cleanup failed after deleting branch: ${message}. Save a backup and retry cleanup before relying on document registry state.`,
      });
    });
    for (const removedId of removedIds) {
      void useMapStore.getState().unlinkNode(removedId);
      useCurativeStore.getState().unlinkNode(removedId);
    }
    void cleanupOwnerRecordsForRemovedNodes(removedNodes, survivingNodes).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[workspace-store] owner cleanup failed after deleting branch:', err);
      set({
        lastError: `Owner/lease cleanup failed after deleting branch: ${message}. Review Owners and Leasehold for stale linked records before relying on side-panel data.`,
      });
    });
  },

  clearLinkedOwner: (ownerId) => {
    const before = get();
    set((state) => {
      useCurativeStore.getState().unlinkOwner(ownerId);
      return {
        nodes: state.nodes.map((node) =>
          node.linkedOwnerId === ownerId ? { ...node, linkedOwnerId: null } : node
        ),
      };
    });
    journalTitleMutation('update', before, get());
  },

  clearLinkedLease: (leaseId) => {
    const before = get();
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
    });
    journalTitleMutation('update', before, get());
  },

  syncLeaseNodesFromRecord: (lease) => {
    const before = get();
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
    });
    journalTitleMutation('update', before, get());
  },

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

  attachDocToNode: async (nodeId, file, options) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    const fileName =
      options?.fileName?.trim()
      || (file instanceof File ? file.name : 'document.pdf');
    const { document, attachment } = await saveDoc({
      workspaceId: state.workspaceId,
      file,
      fileName,
      kind: options?.kind,
      entityKind: 'node',
      entityId: nodeId,
    });
    const summary: NodeAttachmentSummary = {
      docId: document.docId,
      attachmentId: attachment.attachmentId,
      fileName: document.fileName,
      kind: document.kind,
    };
    set((current) => ({
      nodes: current.nodes.map((n) =>
        n.id === nodeId ? { ...n, attachments: [...n.attachments, summary] } : n
      ),
    }));
    return summary;
  },

  detachDocFromNode: async (nodeId, attachmentId) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const target = node.attachments.find((a) => a.attachmentId === attachmentId);
    if (!target) return;
    await detachDocFromEntity(target.attachmentId);
    set((current) => ({
      nodes: current.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              attachments: n.attachments.filter(
                (a) => a.attachmentId !== attachmentId
              ),
            }
          : n
      ),
    }));
  },

  renameDocOnNode: async (docId, newFileName) => {
    const trimmed = newFileName.trim();
    if (!trimmed) return;
    await renameDoc(docId, trimmed);
    set((current) => ({
      nodes: current.nodes.map((n) =>
        n.attachments.some((a) => a.docId === docId)
          ? {
              ...n,
              attachments: n.attachments.map((a) =>
                a.docId === docId ? { ...a, fileName: trimmed } : a
              ),
            }
          : n
      ),
    }));
  },

  reorderNodeAttachments: async (nodeId, orderedAttachmentIds) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    await reorderAttachments('node', nodeId, orderedAttachmentIds);
    const byId = new Map(node.attachments.map((a) => [a.attachmentId, a] as const));
    const seen = new Set<string>();
    const reordered: NodeAttachmentSummary[] = [];
    for (const id of orderedAttachmentIds) {
      const found = byId.get(id);
      if (found && !seen.has(id)) {
        reordered.push(found);
        seen.add(id);
      }
    }
    for (const a of node.attachments) {
      if (!seen.has(a.attachmentId)) reordered.push(a);
    }
    set((current) => ({
      nodes: current.nodes.map((n) =>
        n.id === nodeId ? { ...n, attachments: reordered } : n
      ),
    }));
  },

  hydrateNodeAttachments: async () => {
    const state = get();
    if (state.nodes.length === 0) return;
    const nodeIds = state.nodes.map((n) => n.id);
    const byNodeId = await listAttachmentsForNodes(state.workspaceId, nodeIds);
    if (byNodeId.size === 0) {
      // No documents touched anything in this workspace — leave the
      // existing in-memory attachments[] alone so a transient Dexie
      // read miss doesn't blank the badges for an already-loaded view.
      return;
    }
    set((current) => ({
      nodes: current.nodes.map((node) => {
        const fresh = byNodeId.get(node.id);
        if (!fresh) return node;
        return {
          ...node,
          attachments: fresh.map((entry) => ({
            docId: entry.docId,
            attachmentId: entry.attachmentId,
            fileName: entry.fileName,
            kind: entry.kind,
          })),
        };
      }),
    }));
  },

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
