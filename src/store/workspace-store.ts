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
  validateOwnershipGraph,
} from '../title-math';
import type { Audit, ResultWarning } from '../types/result';
import { createBlankTitleIssue } from '../types/title-issue';
import {
  captureCascadeBundle,
  captureCascadeReapply,
  planOwnerRecordCleanup,
  reapplyCascadeBundle,
  restoreCascadeBundle,
  type CascadeBundle,
  type CascadeReapplyBundle,
} from '../storage/undo-cascade-bundle';
import {
  clearTitleRedoStack,
  clearTitleUndoStack,
  popTitleRedoEntry,
  popTitleUndoEntry,
  pushTitleRedoEntry,
  pushTitleUndoEntry,
  titleUndoLabel,
} from './title-undo-stack';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWriteLeaseStore,
} from './write-lease-store';
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
  const { useOwnerStore } = await import('./owner-store');
  // The undo capture uses the same planner, so what gets captured before this
  // cleanup and what the cleanup deletes can never disagree.
  const { ownerIdsToRemove, leaseIdsToRemove } = planOwnerRecordCleanup(
    removedNodes,
    survivingNodes,
    useOwnerStore.getState().leases
  );
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
        | 'grossAcres'
        | 'pooledAcres'
        | 'description'
        | 'unitName'
        | 'unitCode'
        // DA2-M: the GeoJSON feature→tract matcher writes the ArcGIS link here
        // (and may confirm the tract id). Not a title-math field; not journaled.
        | 'tractId'
        | 'externalRefs'
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
  /**
   * Append a node to a specific desk map by id (not the active one). Used by the
   * multi-tract lease editor so a lessee node lands in its own tract's desk map,
   * the same placement rule `attachLease` follows for the parent's tract.
   */
  addNodeToDeskMap: (nodeId: string, deskMapId: string) => void;
  /**
   * Restore the title slice (`nodes` + `deskMaps`) to a prior snapshot WITHOUT
   * journaling. Used by the title read cutover to roll back a parity-diverged
   * mutation so the live store never holds state the durable ledger rejected.
   */
  restoreTitleSlice: (before: WorkspaceData) => void;
  /**
   * Undo the most recent title mutation (operator undo button). Restores the
   * entry's before-snapshot and journals the restore as a NEW mutation, so the
   * durable ledger stays append-only and store==ledger holds. For destructive
   * mutations the captured cascade rows (documents, owner records, map and
   * curative links) are put back too. Returns false when there is nothing to
   * undo, the tab is read-only, or cutover vetoed the restore.
   */
  undoLastTitleMutation: () => Promise<boolean>;
  /**
   * Re-apply the most recently undone title mutation. The redo restore is a
   * fresh journaled mutation (append-only ledger), the entry returns to the
   * undo stack, and a destructive mutation's cascade is re-applied from the
   * post-cascade row snapshot captured at undo time. Any new mutation clears
   * the redo stack. Returns false when there is nothing to redo, the tab is
   * read-only, or cutover vetoed the restore.
   */
  redoLastTitleMutation: () => Promise<boolean>;

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
  hydrateNodeAttachments: (options?: { strict?: boolean }) => Promise<void>;
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

/**
 * DA-M1: a conveyance that recites more than the grantor holds is booked at the
 * grantor's remainder (the engine captures the stated amount on the node), and
 * the divergence is surfaced as a tracked title issue rather than rejected.
 * Raising it here covers both the Convey modal and the AI conveyance path, and
 * is idempotent per node so re-deriving the same mutation does not duplicate it.
 */
function raiseOverConveyanceIssue(
  newNodeId: string,
  deskMapId: string | null,
  form: Partial<OwnershipNode>,
  warning: ResultWarning
): void {
  const curative = useCurativeStore.getState();
  const alreadyFlagged = curative.titleIssues.some(
    (issue) =>
      issue.issueType === 'Over-conveyance' && issue.affectedNodeId === newNodeId
  );
  if (alreadyFlagged) return;

  const granteeLabel = (form.grantee ?? '').trim() || 'grantee';
  const issue = createBlankTitleIssue(curative.workspaceId ?? '', {
    id: `over-conveyance-${newNodeId}`,
    title: `Over-conveyance to ${granteeLabel}`,
    issueType: 'Over-conveyance',
    priority: 'High',
    affectedNodeId: newNodeId,
    affectedDeskMapId: deskMapId,
    sourceDocNo: (form.docNo ?? '').trim(),
    requiredCurativeAction:
      'Confirm the deed language and reconcile the over-stated grant; the engine '
      + 'booked the grantor remainder and captured the stated amount for review.',
    notes: warning.message,
  });
  // Do NOT swallow a persistence failure: the over-conveyance was BOOKED (a
  // capped number), so losing its warning silently would be the exact "silent
  // cap" the warn-don't-cap rule forbids. If the title-issue write fails, the
  // booking still stands -- surface it as lastError (the store's idiom) so the
  // operator can re-flag it instead of relying on an unmarked transfer order.
  void curative.addIssue(issue).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    useWorkspaceStore.setState({
      lastError:
        `Over-conveyance booked for "${granteeLabel}" but its title issue could not be saved `
        + `(${message}). The booking stands; re-flag the over-conveyance before relying on the `
        + `transfer order.`,
    });
  });
}

/**
 * DA-M2 / LLA-H03: raw `addNode`/`updateNode` (e.g. DeskMap "Add Root") bypass the
 * structured ops' `validateCalcGraph` gate, so a negative / non-finite / malformed
 * fraction, a duplicate id, or a cycle could land silently. After a raw write,
 * surface each such defect as a curative title issue — warn-don't-cap: the entry
 * STANDS, the downstream math gates it. Idempotent per (code, node) so re-edits
 * don't pile up. Over-100% / multi-root is NOT a `validateCalcGraph` defect (it is
 * an allowed Title Theory, already warned on the coverage card), so it never lands
 * here — only genuine structural invalids do.
 */
function flagRawWriteStructuralDefects(state: WorkspaceState): void {
  const validation = validateOwnershipGraph(state.nodes);
  if (validation.valid) return;
  const curative = useCurativeStore.getState();
  for (const issue of validation.issues) {
    if (!issue.nodeId) continue;
    const issueId = `structural-${issue.code}-${issue.nodeId}`;
    if (curative.titleIssues.some((ti) => ti.id === issueId)) continue;
    const node = state.nodes.find((n) => n.id === issue.nodeId) ?? null;
    const deskMapId =
      state.deskMaps.find((dm) => dm.nodeIds.includes(issue.nodeId as string))?.id ?? null;
    const titleIssue = createBlankTitleIssue(curative.workspaceId ?? '', {
      id: issueId,
      title: `Invalid node entry: ${(node?.grantee ?? '').trim() || issue.nodeId}`,
      issueType: 'Other',
      priority: 'High',
      affectedNodeId: issue.nodeId,
      affectedDeskMapId: deskMapId,
      requiredCurativeAction:
        'A title card was entered directly with a structurally invalid value; fix it so the '
        + `ownership math is reliable. ${issue.message}`,
      notes: issue.message,
    });
    void curative.addIssue(titleIssue).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      useWorkspaceStore.setState({
        lastError:
          `A node was entered with an invalid value (${issue.message}) but its title issue could `
          + `not be saved (${message}). The entry stands; re-flag it before relying on the math.`,
      });
    });
  }
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
/**
 * Provenance of a title mutation (DA-M3 / ACT-M01). Direct UI edits are
 * `'user'`; the AI approval executor tags `'ai'`, the staged-import apply path
 * tags `'import'`, and the synthetic load-time baseline is `'system'`. Without
 * this the durable audit chain recorded every mutation as `'user'`, so the
 * AI-gate assertion never saw an AI origin at runtime.
 */
export type MutationOrigin = 'user' | 'ai' | 'import' | 'system';

export interface MutationOriginContext {
  origin: MutationOrigin;
  /** AI tool / import session id, surfaced as the audit event `actorId`. */
  aiToolName?: string;
}

const DEFAULT_MUTATION_ORIGIN: MutationOriginContext = { origin: 'user' };
let currentMutationOriginContext: MutationOriginContext = DEFAULT_MUTATION_ORIGIN;

/**
 * Run `fn` with the active mutation origin set to `origin`. The store mutators
 * fire the journal hook synchronously inside `set()`, and the AI/import callers
 * invoke the store action synchronously within `fn`, so the hook reads the
 * intended origin off this module-scoped context without any async leakage
 * (the `finally` restores the prior context before `fn`'s returned promise
 * resolves). Nesting is supported: the prior context is restored, not reset.
 */
export function withMutationOrigin<T>(
  origin: MutationOrigin,
  fn: () => T,
  aiToolName?: string
): T {
  const previous = currentMutationOriginContext;
  currentMutationOriginContext = { origin, aiToolName };
  try {
    return fn();
  } finally {
    currentMutationOriginContext = previous;
  }
}

/** The origin context the next journaled mutation will be recorded under. */
export function readMutationOriginContext(): MutationOriginContext {
  return currentMutationOriginContext;
}

export type TitleJournalHook = (
  mutation: string,
  beforeWorkspace: WorkspaceData,
  afterWorkspace: WorkspaceData,
  context: MutationOriginContext
) => { rolledBack: boolean } | void;

/** Surfaced as `lastError` when a cutover rollback vetoes a mutation (DA-H3). */
export const CUTOVER_ROLLBACK_ERROR =
  'Mutation reverted: cutover parity divergence. The store matches the durable '
  + 'ledger; see the title ledger banner before retrying.';
export type TitleActionLogResetHook = () => void;

let titleJournalHook: TitleJournalHook | null = null;
let titleActionLogResetHook: TitleActionLogResetHook | null = null;

export function setTitleJournalHook(hook: TitleJournalHook | null): void {
  titleJournalHook = hook;
}

export function setTitleActionLogResetHook(hook: TitleActionLogResetHook | null): void {
  titleActionLogResetHook = hook;
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
 * Snapshot the current live workspace as `WorkspaceData`. Read-only; used by the
 * title cutover readiness gate to compute math/round-trip parity against the
 * durable ledger without the action layer reaching into the store internals.
 */
export function readCurrentWorkspaceData(): WorkspaceData {
  return snapshotWorkspaceData(useWorkspaceStore.getState());
}

/**
 * Element-wise reference equality over the undo-relevant slice. Actions like
 * clearLinkedOwner always build new arrays even when nothing matched; a
 * semantic no-op must not push an undo entry (e.g. the owner-cleanup cascade
 * after a delete would otherwise bury the delete's own entry under no-ops).
 */
function sameTitleUndoSlice(before: WorkspaceState, after: WorkspaceState): boolean {
  const sameArray = <T,>(a: readonly T[], b: readonly T[]) =>
    a === b || (a.length === b.length && a.every((item, index) => item === b[index]));
  return (
    sameArray(before.nodes, after.nodes)
    && sameArray(before.deskMaps, after.deskMaps)
    && sameArray(before.leaseholdAssignments, after.leaseholdAssignments)
    && sameArray(before.leaseholdOrris, after.leaseholdOrris)
    && sameArray(
      before.leaseholdTransferOrderEntries,
      after.leaseholdTransferOrderEntries
    )
    && before.activeDeskMapId === after.activeDeskMapId
    && before.activeUnitCode === after.activeUnitCode
  );
}

interface JournalTitleMutationOptions {
  /**
   * Destructive mutators (delete cascades) claim the undo entry's cascade
   * slot: the returned resolver must be called (with the captured doomed-row
   * bundle or null) AFTER their cascades settle — undo awaits the slot, so a
   * late resolve is what keeps an immediate undo from racing in-flight
   * deletes. Without this flag the slot resolves to null immediately.
   */
  deferUndoCascade?: boolean;
  /** Undo/redo's own restore journals must not push a new undo entry. */
  suppressUndoPush?: boolean;
}

/**
 * Hand-off to the title journal. `beforeState` is the store state captured
 * before `set()` (its arrays are retained, not mutated, by Zustand's replace),
 * `afterState` is the post-`set()` state.
 *
 * Returns the hook's verdict (DA-H3): `{ rolledBack: true }` means the cutover
 * parity check vetoed the mutation and the hook already restored the title
 * slice — the calling mutator must report failure and skip its cascades. A
 * rollback also surfaces `CUTOVER_ROLLBACK_ERROR` as `lastError` here so every
 * mutator gets the UI signal without repeating it. An unexpected hook
 * exception is surfaced as `lastError` (no longer silently swallowed); the
 * store stays canonical in that case — the hook handles its own cutover-path
 * failures by rolling back before it returns.
 *
 * Accepted (non-rolled-back, non-suppressed) mutations also push an entry on
 * the in-memory undo stack, reusing the snapshot built for the hook.
 */
function journalTitleMutation(
  mutation: string,
  beforeState: WorkspaceState,
  afterState: WorkspaceState,
  options: JournalTitleMutationOptions = {}
): {
  rolledBack: boolean;
  resolveUndoCascade: ((bundle: CascadeBundle | null) => void) | null;
} {
  const beforeWorkspace = snapshotWorkspaceData(beforeState);
  let rolledBack = false;
  if (titleJournalHook) {
    try {
      const verdict = titleJournalHook(
        mutation,
        beforeWorkspace,
        snapshotWorkspaceData(afterState),
        readMutationOriginContext()
      ) ?? { rolledBack: false };
      rolledBack = verdict.rolledBack;
      if (rolledBack) {
        useWorkspaceStore.setState({ lastError: CUTOVER_ROLLBACK_ERROR });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[workspace-store] title journal hook threw:', err);
      useWorkspaceStore.setState({
        lastError: `Title journal hook failed for ${mutation}: ${message}. The mutation stands; review the title ledger before relying on cutover readiness.`,
      });
    }
  }
  if (
    rolledBack
    || options.suppressUndoPush
    || sameTitleUndoSlice(beforeState, afterState)
  ) {
    return { rolledBack, resolveUndoCascade: null };
  }
  let resolveUndoCascade: ((bundle: CascadeBundle | null) => void) | null =
    null;
  const cascade: Promise<CascadeBundle | null> = options.deferUndoCascade
    ? new Promise((resolve) => {
        resolveUndoCascade = resolve;
      })
    : Promise.resolve(null);
  pushTitleUndoEntry({
    mutation,
    label: titleUndoLabel(mutation),
    beforeWorkspace,
    cascade,
  });
  // A genuinely new mutation forks history: the undone future is no longer
  // re-playable. Undo/redo journal with suppressUndoPush, so they never land
  // here and the redo stack survives chained undos/redos.
  clearTitleRedoStack();
  return { rolledBack, resolveUndoCascade };
}

function resetTitleActionLogForWorkspaceReplacement(): void {
  titleActionLogResetHook?.();
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
    const before = get();
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
    // Title-visible when initialNodeIds is non-empty (membership lands in
    // interest_reference.deskMapIds) — e.g. Add Root creating its first tract.
    journalTitleMutation('update', before, get());
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
    // DA-H3: skip the destructive cascades when the cutover veto rolled back.
    const verdict = journalTitleMutation('deleteNode', state, get(), {
      deferUndoCascade: true,
    });
    if (verdict.rolledBack) return;

    void (async () => {
      // Undo capture FIRST: read the rows these cascades are about to destroy.
      let cascadeBundle: CascadeBundle | null = null;
      try {
        const { useOwnerStore } = await import('./owner-store');
        cascadeBundle = await captureCascadeBundle({
          workspaceId: state.workspaceId,
          removedNodes,
          survivingNodes,
          leases: useOwnerStore.getState().leases,
        });
      } catch (err) {
        console.warn(
          '[workspace-store] undo capture failed; undo will restore title cards only:',
          err
        );
      }
      try {
        await cascadeDeleteDocsForRemovedNodes(removedNodes).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn('[workspace-store] document cascade delete failed:', err);
          set({
            lastError: `Document cleanup failed after clearing tract: ${message}. Save a backup and retry cleanup before relying on document registry state.`,
          });
        });
        await Promise.all(
          deletedIds.map((nodeId) => useMapStore.getState().unlinkNode(nodeId))
        ).catch(() => {});
        for (const nodeId of deletedIds) {
          useCurativeStore.getState().unlinkNode(nodeId);
        }
        await cleanupOwnerRecordsForRemovedNodes(removedNodes, survivingNodes).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn('[workspace-store] owner cleanup failed after clearing tract:', err);
          set({
            lastError: `Owner/lease cleanup failed after clearing tract: ${message}. Review Owners and Leasehold for stale linked records before relying on side-panel data.`,
          });
        });
      } finally {
        // Resolve only after the cascades settle: undo awaits this slot, so
        // a late resolve is what keeps an immediate undo from restoring rows
        // an in-flight cascade is still deleting.
        verdict.resolveUndoCascade?.(cascadeBundle);
      }
    })();
  },

  deleteDeskMap: (id) => {
    const before = get();
    set((state) => {
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
    });
    // Cascades run only after the journal accepts the mutation (DA-H3).
    const verdict = journalTitleMutation('update', before, get(), {
      deferUndoCascade: true,
    });
    if (verdict.rolledBack) return;
    void (async () => {
      // Capture the map/curative rows whose desk-map links the unlinks below
      // are about to null, so undo can restore them.
      let cascadeBundle: CascadeBundle | null = null;
      try {
        const { useOwnerStore } = await import('./owner-store');
        cascadeBundle = await captureCascadeBundle({
          workspaceId: before.workspaceId,
          removedNodes: [],
          survivingNodes: get().nodes,
          leases: useOwnerStore.getState().leases,
          removedDeskMapId: id,
        });
      } catch (err) {
        console.warn(
          '[workspace-store] undo capture failed; undo will restore title cards only:',
          err
        );
      }
      try {
        await useMapStore.getState().unlinkDeskMap(id);
        useCurativeStore.getState().unlinkDeskMap(id);
      } finally {
        // Resolve only after the unlinks settle (undo awaits this slot).
        verdict.resolveUndoCascade?.(cascadeBundle);
      }
    })();
  },

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
      if (journalTitleMutation('convey', state, get()).rolledBack) return false;
      // DA-M1: surface a booked over-conveyance as a tracked title issue.
      if (result.warning?.code === 'over_conveyance') {
        raiseOverConveyanceIssue(newNodeId, targetDeskMapId ?? null, form, result.warning);
      }
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
      if (journalTitleMutation('createNpri', state, get()).rolledBack) return false;
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
      if (journalTitleMutation('createRootNode', state, get()).rolledBack) return false;
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
      if (journalTitleMutation('update', state, get()).rolledBack) return false;
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
      if (journalTitleMutation('precede', state, get()).rolledBack) return false;
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
      if (journalTitleMutation('graftToParent', state, get()).rolledBack) return false;
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
    if (journalTitleMutation('graftToParent', before, get()).rolledBack) {
      return {
        ok: false,
        attached: [],
        failed: items.map((item) => ({
          nodeId: item.activeNodeId,
          reason: CUTOVER_ROLLBACK_ERROR,
        })),
      };
    }
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
    if (journalTitleMutation('attachLease', state, get()).rolledBack) return null;
    return newId;
  },

  addNode: (node) => {
    const before = get();
    set((state) => ({ nodes: [...state.nodes, node] }));
    journalTitleMutation('update', before, get());
    flagRawWriteStructuralDefects(get());
  },

  updateNode: (id, fields) => {
    const before = get();
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...fields } : n)),
    }));
    journalTitleMutation('update', before, get());
    flagRawWriteStructuralDefects(get());
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
    // DA-H3: a cutover rollback restored the nodes — firing the cascades would
    // permanently delete the restored nodes' documents and owner records.
    const verdict = journalTitleMutation('deleteNode', state, get(), {
      deferUndoCascade: true,
    });
    if (verdict.rolledBack) return;
    void (async () => {
      // Undo capture FIRST: read the rows these cascades are about to destroy
      // so undoLastTitleMutation can put them back verbatim.
      let cascadeBundle: CascadeBundle | null = null;
      try {
        const { useOwnerStore } = await import('./owner-store');
        cascadeBundle = await captureCascadeBundle({
          workspaceId: state.workspaceId,
          removedNodes,
          survivingNodes,
          leases: useOwnerStore.getState().leases,
        });
      } catch (err) {
        console.warn(
          '[workspace-store] undo capture failed; undo will restore title cards only:',
          err
        );
      }
      try {
        await cascadeDeleteDocsForRemovedNodes(removedNodes).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn('[workspace-store] document cascade delete failed:', err);
          set({
            lastError: `Document cleanup failed after deleting branch: ${message}. Save a backup and retry cleanup before relying on document registry state.`,
          });
        });
        await Promise.all(
          removedIds.map((removedId) => useMapStore.getState().unlinkNode(removedId))
        ).catch(() => {});
        for (const removedId of removedIds) {
          useCurativeStore.getState().unlinkNode(removedId);
        }
        await cleanupOwnerRecordsForRemovedNodes(removedNodes, survivingNodes).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn('[workspace-store] owner cleanup failed after deleting branch:', err);
          set({
            lastError: `Owner/lease cleanup failed after deleting branch: ${message}. Review Owners and Leasehold for stale linked records before relying on side-panel data.`,
          });
        });
      } finally {
        // Resolve only after the cascades settle (undo awaits this slot).
        verdict.resolveUndoCascade?.(cascadeBundle);
      }
    })();
  },

  clearLinkedOwner: (ownerId) => {
    const before = get();
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.linkedOwnerId === ownerId ? { ...node, linkedOwnerId: null } : node
      ),
    }));
    // Cascade runs only after the journal accepts the mutation (DA-H3).
    if (journalTitleMutation('update', before, get()).rolledBack) return;
    useCurativeStore.getState().unlinkOwner(ownerId);
  },

  clearLinkedLease: (leaseId) => {
    const before = get();
    set((state) => ({
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
    }));
    // Cascade runs only after the journal accepts the mutation (DA-H3).
    if (journalTitleMutation('update', before, get()).rolledBack) return;
    useCurativeStore.getState().unlinkLease(leaseId);
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

  addNodeToActiveDeskMap: (nodeId) => {
    const before = get();
    set((state) => {
      const targetDeskMapId = resolveActiveDeskMapId(state.deskMaps, state.activeDeskMapId);
      if (!targetDeskMapId) return {};
      // Membership guard (mirrors addNodeToDeskMap): a re-add of a node already
      // on the target desk map must not append a duplicate nodeId, which would
      // render the same card twice.
      const target = state.deskMaps.find((dm) => dm.id === targetDeskMapId);
      if (target?.nodeIds.includes(nodeId)) {
        return state.activeDeskMapId === targetDeskMapId
          ? {}
          : { activeDeskMapId: targetDeskMapId };
      }
      return {
        activeDeskMapId: targetDeskMapId,
        deskMaps: state.deskMaps.map((dm) =>
          dm.id === targetDeskMapId
            ? { ...dm, nodeIds: [...dm.nodeIds, nodeId] }
            : dm
        ),
      };
    });
    journalTitleMutation('update', before, get());
  },

  addNodeToDeskMap: (nodeId, deskMapId) => {
    const before = get();
    set((state) => {
      const target = state.deskMaps.find((dm) => dm.id === deskMapId);
      if (!target) {
        return { lastError: `Desk map ${deskMapId} not found` };
      }
      if (target.nodeIds.includes(nodeId)) return {};
      return {
        deskMaps: state.deskMaps.map((dm) =>
          dm.id === deskMapId ? { ...dm, nodeIds: [...dm.nodeIds, nodeId] } : dm
        ),
      };
    });
    journalTitleMutation('update', before, get());
  },

  restoreTitleSlice: (before) =>
    set((state) => {
      const survivingIds = new Set(before.nodes.map((node) => node.id));
      return {
        nodes: before.nodes,
        deskMaps: before.deskMaps,
        // DA-H3: a vetoed mutation may also have moved the active selections;
        // restore them with the slice so the UI lands back where it was.
        activeDeskMapId: before.activeDeskMapId,
        activeUnitCode: before.activeUnitCode,
        // clearDeskMapNodes/deleteDeskMap delete the desk map's leasehold rows
        // in the same set() as the title slice — a veto must bring them back
        // too, or the rollback silently loses leasehold work (review fix).
        leaseholdAssignments: before.leaseholdAssignments ?? state.leaseholdAssignments,
        leaseholdOrris: before.leaseholdOrris ?? state.leaseholdOrris,
        leaseholdTransferOrderEntries:
          before.leaseholdTransferOrderEntries ?? state.leaseholdTransferOrderEntries,
        activeNodeId:
          state.activeNodeId && survivingIds.has(state.activeNodeId)
            ? state.activeNodeId
            : null,
        lastError: null,
      };
    }),

  undoLastTitleMutation: async () => {
    if (useWriteLeaseStore.getState().role === 'reader') {
      set({ lastError: READ_ONLY_WORKSPACE_EDIT_TITLE });
      return false;
    }
    const entry = popTitleUndoEntry();
    if (!entry) return false;

    const before = get();
    get().restoreTitleSlice(entry.beforeWorkspace);
    // The restore is itself a journaled mutation (append-only ledger); it must
    // not push a fresh undo entry or undo would ping-pong with itself (and it
    // must not clear the redo stack — only genuinely new mutations do).
    const { rolledBack } = journalTitleMutation('update', before, get(), {
      suppressUndoPush: true,
    });
    if (rolledBack) return false;

    // Resolves only after the destructive cascades settled (producer contract).
    const bundle = await entry.cascade;
    let cascadeReapply: CascadeReapplyBundle | null = null;
    if (bundle) {
      // Snapshot the post-cascade form of the captured rows BEFORE restoring
      // the originals: redo re-applies that exact form (deleted rows
      // re-deleted, nulled links re-nulled) without re-running cascade logic.
      cascadeReapply = await captureCascadeReapply(bundle).catch(() => null);
      try {
        const result = await restoreCascadeBundle(bundle);
        if (result.warning) set({ lastError: result.warning });
        // Refresh the attachment chips from the restored Dexie rows.
        await get().hydrateNodeAttachments().catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({
          lastError: `Undo restored the title cards, but some deleted documents or owner records could not be restored: ${message}.`,
        });
      }
    }
    pushTitleRedoEntry({
      mutation: entry.mutation,
      label: entry.label,
      // `before` is the pre-undo state = the state the original mutation
      // produced; redo restores exactly it.
      afterWorkspace: snapshotWorkspaceData(before),
      cascadeBundle: bundle,
      cascadeReapply,
    });
    return true;
  },

  redoLastTitleMutation: async () => {
    if (useWriteLeaseStore.getState().role === 'reader') {
      set({ lastError: READ_ONLY_WORKSPACE_EDIT_TITLE });
      return false;
    }
    const entry = popTitleRedoEntry();
    if (!entry) return false;

    const before = get();
    get().restoreTitleSlice(entry.afterWorkspace);
    // Same append-only rule as undo: the redo restore journals as a fresh
    // mutation but never pushes/clears stacks through the chokepoint.
    const { rolledBack } = journalTitleMutation('update', before, get(), {
      suppressUndoPush: true,
    });
    if (rolledBack) return false;

    if (entry.cascadeReapply) {
      try {
        const result = await reapplyCascadeBundle(entry.cascadeReapply);
        if (result.warning) set({ lastError: result.warning });
        await get().hydrateNodeAttachments().catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        set({
          lastError: `Redo restored the title cards, but some related document or owner records could not be re-applied: ${message}.`,
        });
      }
    }
    // Hand the entry back to the undo stack so the redo can itself be undone;
    // the original bundle still restores the cascade-deleted rows verbatim.
    pushTitleUndoEntry({
      mutation: entry.mutation,
      label: entry.label,
      beforeWorkspace: snapshotWorkspaceData(before),
      cascade: Promise.resolve(entry.cascadeBundle),
    });
    return true;
  },

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
    const before = get();
    set((current) => ({
      nodes: current.nodes.map((n) =>
        n.id === nodeId ? { ...n, attachments: [...n.attachments, summary] } : n
      ),
    }));
    // Title-visible when this becomes the node's first attachment: the adapter
    // maps attachments[0].docId to instrument_record.documentId.
    journalTitleMutation('update', before, get());
    return summary;
  },

  detachDocFromNode: async (nodeId, attachmentId) => {
    const state = get();
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const target = node.attachments.find((a) => a.attachmentId === attachmentId);
    if (!target) return;
    await detachDocFromEntity(target.attachmentId);
    const before = get();
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
    journalTitleMutation('update', before, get());
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
    await reorderAttachments(state.workspaceId, 'node', nodeId, orderedAttachmentIds);
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
    const before = get();
    set((current) => ({
      nodes: current.nodes.map((n) =>
        n.id === nodeId ? { ...n, attachments: reordered } : n
      ),
    }));
    // Reordering can change attachments[0], which the adapter maps to
    // instrument_record.documentId.
    journalTitleMutation('update', before, get());
  },

  hydrateNodeAttachments: async (options) => {
    const strict = options?.strict ?? false;
    const state = get();
    if (state.nodes.length === 0) return;
    const nodeIds = state.nodes.map((n) => n.id);
    const byNodeId = await listAttachmentsForNodes(state.workspaceId, nodeIds);
    if (byNodeId.size === 0 && !strict) {
      // No documents touched anything in this workspace — leave the
      // existing in-memory attachments[] alone so a transient Dexie
      // read miss doesn't blank the badges for an already-loaded view.
      return;
    }
    set((current) => ({
      nodes: current.nodes.map((node) => {
        const fresh = byNodeId.get(node.id);
        if (!fresh) {
          return strict && node.attachments.length > 0
            ? { ...node, attachments: [] }
            : node;
        }
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

  loadWorkspace: (data) => {
    resetTitleActionLogForWorkspaceReplacement();
    // A replaced workspace invalidates every undo snapshot (different nodes,
    // different ledger); the AI turn-level undo restore also lands here.
    clearTitleUndoStack();
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
    });
  },
}));
