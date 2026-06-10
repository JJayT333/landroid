/**
 * Phase 4 title cutover — LIVE write-path ledger (SHADOW, recording-only).
 *
 * This is the live wiring of the command-sourcing wrapper. As the user (or the
 * AI tools, which call the same store methods) performs title mutations, the
 * workspace store fires a fire-and-forget journal hook; this store turns each
 * mutation into a durable ActionRecord + hash-chained audit event via the
 * proven action-layer `recordTitleMutation`.
 *
 * Guardrails this respects:
 * - CURRENT STORE STAYS CANONICAL. Recording happens AFTER the store's canonical
 *   `set()` and never mutates it. Reads are unchanged (the read-path flip stays
 *   default-shadow). This ledger is write-side only.
 * - DIVERGENCE = FAILURE, SURFACED. `recordTitleMutation` throws on any parity
 *   divergence; we catch it, record it in `lastDivergence`, and `console.error`
 *   loudly. We do NOT append the diverged record and we do NOT roll back the
 *   canonical store (it already committed; surfacing is the correct live
 *   behavior since reads still come from the store).
 * - NO LIVE READ FLIP. Nothing here flips `title_tree` to cutover.
 * - REVERSIBLE. `enabled` defaults to true (so the step is live) but flipping it
 *   off stops all recording without a code change; not importing this module at
 *   all leaves the hook unregistered (the prior behavior).
 *
 * Scope: only mutations in the typed title catalog are journaled. That catalog
 * includes structural title mutations plus projected field edits recorded as
 * `title.update` (updateNode, rebalance, clearLinked*, syncLeaseNodesFromRecord).
 * This remains a shadow write-side ledger; reads stay on the canonical store
 * until the explicit read-path cutover gate.
 */
import { create } from 'zustand';
import type {
  ActionRecord,
  AuditEventRecord,
  BackendSpineCoreRecord,
} from '../backend-spine/contracts';
import type { OwnerWorkspaceData } from '../storage/owner-persistence';
import type { WorkspaceData } from '../storage/workspace-persistence';
import { ParityDivergenceError } from '../project-records/action-layer/parity';
import { verifyAuditChain } from '../project-records/action-layer/audit-chain';
import { setTitleCutoverRuntimeStateReader } from '../project-records/action-layer/title-cutover-gate';
import {
  checkTitleInlineParity,
  recordTitleMutation,
  TITLE_MUTATIONS,
  type TitleMutation,
} from '../project-records/action-layer/title-command-sourcing';
import {
  TitleReadPathFlag,
  type TitleReadPathMode,
} from '../project-records/action-layer/title-read-path';
import type { ProjectRecordBundle } from '../project-records/record-validation';
import {
  listTitleLedgerWorkspaceRows,
  replaceTitleLedgerWorkspaceRows,
} from '../storage/title-ledger-persistence';
import type { TitleLedgerWorkspaceRows } from '../storage/title-ledger-stores';
import { useOwnerStore } from './owner-store';
import {
  setTitleActionLogResetHook,
  setTitleJournalHook,
  useWorkspaceStore,
} from './workspace-store';

type OwnerSlice = Pick<OwnerWorkspaceData, 'owners' | 'leases'>;

export type TitleLedgerHydrationSource = 'storage' | 'file' | 'baseline';

export interface TitleLedgerLifecycleResult {
  source: TitleLedgerHydrationSource;
  actionRecordCount: number;
  auditEventCount: number;
}

export interface TitleLedgerDivergence {
  mutation: string;
  message: string;
  at: string;
}

interface TitleActionLogState {
  /** When false, the journal hook is a no-op (reversible kill switch). */
  enabled: boolean;
  actionRecords: ActionRecord[];
  auditEvents: AuditEventRecord[];
  /** Head hash to thread the next audit event off (append-only chain). */
  headHash: string | undefined;
  /** Count of mutations successfully recorded with clean inline parity. */
  recordedMutationCount: number;
  /** Last parity divergence surfaced (a bug to resolve; never silently dropped). */
  lastDivergence: TitleLedgerDivergence | null;
  /** Last non-divergence recording error (e.g. a malformed mutation). */
  lastError: string | null;
  /**
   * Live read-path mode for title records. Default `'shadow'` (store-canonical).
   * `'cutover'` sources title records from the durable ledger. Reversible.
   */
  readPathMode: TitleReadPathMode;
  setEnabled: (enabled: boolean) => void;
  reset: () => void;
  /**
   * Seed the ledger from a durable bundle (e.g. an imported v9 `.landroid`
   * `actionLedger`) so a later save preserves the chain rather than dropping it.
   * Replaces current state and bumps the generation guard like `reset`; the next
   * recorded mutation continues the chain from the hydrated head hash (and the
   * baseline-if-needed check is skipped because records already exist).
   */
  hydrate: (input: {
    actionRecords: ActionRecord[];
    auditEvents: AuditEventRecord[];
  }) => void;
  record: (input: {
    mutation: string;
    beforeWorkspace: WorkspaceData;
    afterWorkspace: WorkspaceData;
    ownerData?: OwnerSlice;
    origin?: 'user' | 'ai' | 'import' | 'system';
    approvedBy?: ActionRecord['approvedBy'];
    aiToolName?: string;
  }) => Promise<void>;
  /**
   * Flip the title record read path to cutover. Requires the readiness gates to
   * be green (`ready`) and a non-empty reviewer token; governance is enabled for
   * title_tree only. Throws {@link TitleReadFlipDisabledError} or an error when
   * blocked. Reversible via {@link revertReadPathToShadow}.
   */
  flipToCutover: (input: { reviewerApprovalToken: string; ready: boolean }) => void;
  /** Revert the title record read path to shadow. Always available. */
  revertReadPathToShadow: () => void;
}

function isTitleMutation(value: string): value is TitleMutation {
  return (TITLE_MUTATIONS as readonly string[]).includes(value);
}

function cloneWorkspaceForLedger(workspace: WorkspaceData): WorkspaceData {
  return {
    ...workspace,
    nodes: workspace.nodes.map((node) => ({ ...node })),
    deskMaps: workspace.deskMaps.map((deskMap) => ({
      ...deskMap,
      nodeIds: [...deskMap.nodeIds],
    })),
  };
}

function emptyTitleBaselineWorkspace(workspace: WorkspaceData): WorkspaceData {
  return {
    ...workspace,
    nodes: [],
    deskMaps: workspace.deskMaps.map((deskMap) => ({ ...deskMap, nodeIds: [] })),
  };
}

// Incremented on reset so in-flight recordings from a replaced workspace cannot append late.
let ledgerGeneration = 0;
let recordingChain: Promise<void> = Promise.resolve();
const pending = new Set<Promise<unknown>>();

// Governed read-path flip for the title_tree surface. DISARMED by default
// (DA-C1): the journal-coverage exit gate must be green and the operator's
// Springhill soak complete before re-arming, which is a deliberate one-line
// change calling setTitleCutoverArmed(true) — never a runtime default. The
// mode starts 'shadow'; reverting is available at any time regardless.
const titleReadPathFlag = new TitleReadPathFlag('shadow', { cutoverEnabled: false });

/**
 * Arm or disarm the cutover flip governance. Exported for tests and for the
 * deliberate post-soak re-arm; nothing in production calls this with `true`.
 */
export function setTitleCutoverArmed(enabled: boolean): void {
  titleReadPathFlag.setCutoverEnabled(enabled);
}

/** Whether the cutover flip governance is armed (DA-C1: default false). */
export function isTitleCutoverArmed(): boolean {
  return titleReadPathFlag.isCutoverEnabled();
}

export const useTitleActionLog = create<TitleActionLogState>()((set, get) => ({
  enabled: true,
  actionRecords: [],
  auditEvents: [],
  headHash: undefined,
  recordedMutationCount: 0,
  lastDivergence: null,
  lastError: null,
  readPathMode: 'shadow',

  setEnabled: (enabled) => set({ enabled }),

  reset: () => {
    ledgerGeneration += 1;
    recordingChain = Promise.resolve();
    titleReadPathFlag.revertToShadow();
    set({
      actionRecords: [],
      auditEvents: [],
      headHash: undefined,
      recordedMutationCount: 0,
      lastDivergence: null,
      lastError: null,
      readPathMode: 'shadow',
    });
  },

  hydrate: ({ actionRecords, auditEvents }) => {
    ledgerGeneration += 1;
    recordingChain = Promise.resolve();
    titleReadPathFlag.revertToShadow();
    set({
      actionRecords: [...actionRecords],
      auditEvents: [...auditEvents],
      headHash: auditEvents.at(-1)?.eventHash,
      recordedMutationCount: actionRecords.length,
      lastDivergence: null,
      lastError: null,
      readPathMode: 'shadow',
    });
  },

  flipToCutover: ({ reviewerApprovalToken, ready }) => {
    if (!ready) {
      throw new Error(
        'Title read flip blocked: cutover readiness gates are not green.'
      );
    }
    // Governed + token-checked; throws TitleReadFlipDisabledError if governance
    // were ever disabled. The store stays canonical for the live UI/math — this
    // only changes the project-records read source (Scope A).
    titleReadPathFlag.cutOver({ reviewerApprovalToken });
    set({ readPathMode: titleReadPathFlag.getMode() });
  },

  revertReadPathToShadow: () => {
    titleReadPathFlag.revertToShadow();
    set({ readPathMode: titleReadPathFlag.getMode() });
  },

  record: async ({
    mutation,
    beforeWorkspace,
    afterWorkspace,
    ownerData,
    origin = 'user',
    approvedBy = 'user',
    aiToolName,
  }) => {
    const generationAtStart = ledgerGeneration;
    // Only mutations in the typed title catalog are representable as commands.
    if (!isTitleMutation(mutation)) return;

    const generatedAt = new Date().toISOString();
    const context = {
      workspaceId: afterWorkspace.workspaceId,
      projectId: afterWorkspace.workspaceId,
      generatedAt,
      revision: 0,
      source: 'local' as const,
      syncState: 'local_only' as const,
    };

    try {
      const result = await recordTitleMutation({
        mutation,
        origin,
        approvedBy,
        context,
        appliedAt: generatedAt,
        beforeWorkspace,
        afterWorkspace,
        ownerData,
        aiToolName,
        priorHeadHash: get().headHash,
      });
      if (generationAtStart !== ledgerGeneration) return;
      // A mutation that did not change any projected title record (e.g. an edit
      // that touched only non-projected fields, or set a field to its current
      // value) produces no effects — keep it out of the ledger.
      if (result.delta.effects.length === 0) return;
      set((state) => ({
        actionRecords: [...state.actionRecords, result.actionRecord],
        auditEvents: [...state.auditEvents, result.auditEvent],
        headHash: result.auditHeadHash,
        recordedMutationCount: state.recordedMutationCount + 1,
        lastError: null,
      }));
    } catch (err) {
      if (generationAtStart !== ledgerGeneration) return;
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof ParityDivergenceError) {
        // Guardrail 3: surface, never silently shadow. The canonical store has
        // already committed; we do not append the diverged record nor roll back.
        set({ lastDivergence: { mutation, message, at: generatedAt } });
        console.error(
          '[title-action-log] PARITY DIVERGENCE — mutation kept OUT of the ledger; ' +
            'the store remains canonical. Resolve before any cutover:\n' +
            message
        );
      } else {
        set({ lastError: message });
        console.error('[title-action-log] recording failed:', err);
      }
    }
  },
}));

setTitleCutoverRuntimeStateReader(() => {
  const state = useTitleActionLog.getState();
  return {
    divergenceMessage: state.lastDivergence?.message ?? null,
    errorMessage: state.lastError,
  };
});

/**
 * The single integration seam for the title record read flip. Returns the live
 * read mode + the durable records, shaped for `buildProjectRecordsWithEvidenceVault`'s
 * `titleReadPath` (and any future project-records consumer): in `shadow` the
 * consumer keeps sourcing title records from the adapter; in `cutover` it
 * replays them from this ledger. Reading is unaffected for the live Desk Map /
 * math, which stay store-canonical.
 */
export function selectTitleReadPathInput(): {
  mode: TitleReadPathMode;
  actionRecords: readonly BackendSpineCoreRecord[];
} {
  const state = useTitleActionLog.getState();
  return { mode: state.readPathMode, actionRecords: state.actionRecords };
}

function readOwnerData(): OwnerSlice {
  const owner = useOwnerStore.getState();
  return { owners: owner.owners, leases: owner.leases };
}

async function recordBaselineIfNeeded(input: {
  workspace: WorkspaceData;
  ownerData?: OwnerSlice;
  generationAtEnqueue: number;
}): Promise<void> {
  if (input.generationAtEnqueue !== ledgerGeneration) return;
  const state = useTitleActionLog.getState();
  if (state.actionRecords.length > 0 || state.recordedMutationCount > 0) return;
  if (input.workspace.nodes.length === 0) return;

  const afterWorkspace = cloneWorkspaceForLedger(input.workspace);
  await useTitleActionLog.getState().record({
    mutation: 'baseline',
    origin: 'system',
    approvedBy: 'system',
    beforeWorkspace: emptyTitleBaselineWorkspace(afterWorkspace),
    afterWorkspace,
    ownerData: input.ownerData,
  });
}

// Queue recordings so the audit chain threads head hashes in mutation order.
// Generation checks drop any queued work from a replaced workspace.
function track(promise: Promise<unknown>): void {
  pending.add(promise);
  void promise.finally(() => pending.delete(promise));
}

/** Await all in-flight recordings (test helper; the live app never needs this). */
export async function settleTitleActionLog(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}

function cloneLedgerRows(rows: TitleLedgerWorkspaceRows): TitleLedgerWorkspaceRows {
  return {
    actionRecords: [...rows.actionRecords],
    auditEvents: [...rows.auditEvents],
  };
}

function ledgerRowsFromBundle(
  bundle: ProjectRecordBundle
): TitleLedgerWorkspaceRows {
  return {
    actionRecords: bundle.records.filter(
      (record): record is ActionRecord => record.recordType === 'action_record'
    ),
    auditEvents: bundle.records.filter(
      (record): record is AuditEventRecord => record.recordType === 'audit_event'
    ),
  };
}

function ledgerRowsBelongToWorkspace(
  rows: TitleLedgerWorkspaceRows,
  workspaceId: string
): boolean {
  return [...rows.actionRecords, ...rows.auditEvents].every(
    (record) => record.workspaceId === workspaceId
  );
}

async function verifyTitleLedgerRows(
  rows: TitleLedgerWorkspaceRows,
  workspaceId: string,
  label: string
): Promise<boolean> {
  if (!ledgerRowsBelongToWorkspace(rows, workspaceId)) {
    console.warn(
      `[title-action-log] Ignoring ${label} ledger for workspace ${workspaceId}: ` +
        'one or more records belong to another workspace.'
    );
    return false;
  }
  if (rows.auditEvents.length === 0) {
    return rows.actionRecords.length === 0;
  }
  // Undo is append-only on the audit chain: each `action_record.undone` event
  // marks an existing action record undone in place without adding a record
  // row, so the pairing rule is records == events minus undone events (DA-H2).
  const undoneEventCount = rows.auditEvents.filter(
    (event) => event.eventKind === 'action_record.undone'
  ).length;
  if (rows.actionRecords.length !== rows.auditEvents.length - undoneEventCount) {
    console.warn(
      `[title-action-log] Ignoring ${label} ledger for workspace ${workspaceId}: ` +
        `action/audit count mismatch (${rows.actionRecords.length} actions, ` +
        `${rows.auditEvents.length} audit events, ${undoneEventCount} undone).`
    );
    return false;
  }
  const verification = await verifyAuditChain(rows.auditEvents);
  if (!verification.valid) {
    console.warn(
      `[title-action-log] Ignoring ${label} ledger for workspace ${workspaceId}: ` +
        `audit chain failed at index ${verification.brokenAtIndex} ` +
        `(${verification.reason}).`
    );
    return false;
  }
  return true;
}

async function baselineAndFlushTitleLedger(
  workspace: WorkspaceData,
  ownerData?: OwnerSlice
): Promise<TitleLedgerLifecycleResult> {
  useTitleActionLog.getState().reset();
  await ensureTitleBaseline(workspace, ownerData);
  await flushTitleActionLogToStorage(workspace.workspaceId);
  const state = useTitleActionLog.getState();
  return {
    source: 'baseline',
    actionRecordCount: state.actionRecords.length,
    auditEventCount: state.auditEvents.length,
  };
}

export async function flushTitleActionLogToStorage(
  workspaceId: string
): Promise<void> {
  await settleTitleActionLog();
  const state = useTitleActionLog.getState();
  const rows: TitleLedgerWorkspaceRows = {
    actionRecords: [...state.actionRecords],
    auditEvents: [...state.auditEvents],
  };
  if (!(await verifyTitleLedgerRows(rows, workspaceId, 'live'))) {
    throw new Error(`Refusing to flush invalid title ledger for workspace ${workspaceId}.`);
  }
  await replaceTitleLedgerWorkspaceRows(workspaceId, rows);
}

export async function hydrateTitleActionLogFromStorageOrBaseline(
  workspace: WorkspaceData,
  ownerData?: OwnerSlice
): Promise<TitleLedgerLifecycleResult> {
  const storedRows = await listTitleLedgerWorkspaceRows(workspace.workspaceId);
  if (
    storedRows.actionRecords.length > 0
    || storedRows.auditEvents.length > 0
  ) {
    if (
      await verifyTitleLedgerRows(storedRows, workspace.workspaceId, 'stored')
    ) {
      const rows = cloneLedgerRows(storedRows);
      useTitleActionLog.getState().hydrate(rows);
      return {
        source: 'storage',
        actionRecordCount: rows.actionRecords.length,
        auditEventCount: rows.auditEvents.length,
      };
    }
  }
  return baselineAndFlushTitleLedger(workspace, ownerData);
}

export async function hydrateTitleActionLogFromImportedLedger(
  workspace: WorkspaceData,
  actionLedger: ProjectRecordBundle | undefined,
  ownerData?: OwnerSlice
): Promise<TitleLedgerLifecycleResult> {
  if (actionLedger) {
    const rows = ledgerRowsFromBundle(actionLedger);
    if (await verifyTitleLedgerRows(rows, workspace.workspaceId, 'imported file')) {
      useTitleActionLog.getState().hydrate(cloneLedgerRows(rows));
      await flushTitleActionLogToStorage(workspace.workspaceId);
      return {
        source: 'file',
        actionRecordCount: rows.actionRecords.length,
        auditEventCount: rows.auditEvents.length,
      };
    }
  }
  return baselineAndFlushTitleLedger(workspace, ownerData);
}

/**
 * Prepare a loaded workspace for any future title-ledger read cutover. A caller
 * that wants to read from `actionRecords` must call this with the current
 * workspace and loaded owner data, then await `settleTitleActionLog()` before
 * reading the ledger. This only records the lazy baseline; it does not flip any
 * live read path.
 */
export function ensureTitleBaseline(
  workspace: WorkspaceData,
  ownerData?: OwnerSlice
): Promise<void> {
  if (!useTitleActionLog.getState().enabled) return Promise.resolve();
  const generationAtEnqueue = ledgerGeneration;
  const workspaceAtEnqueue = cloneWorkspaceForLedger(workspace);
  recordingChain = recordingChain.then(() =>
    recordBaselineIfNeeded({
      workspace: workspaceAtEnqueue,
      ownerData,
      generationAtEnqueue,
    })
  );
  track(recordingChain);
  return recordingChain;
}

setTitleJournalHook((mutation, beforeWorkspace, afterWorkspace) => {
  const state = useTitleActionLog.getState();
  if (!state.enabled) return { rolledBack: false };

  // Read-source cutover: the ledger is authoritative for what the live UI shows,
  // so a parity-diverged mutation must not survive in the store. The parity check
  // is synchronous, so we veto and roll back to the before-snapshot here — atomic
  // with the mutation, before any read — and keep the diverged record out of the
  // ledger (the store now matches ledger state). The verdict is returned to the
  // mutator (DA-H3) so it reports failure and skips its cascades. A parity check
  // that THROWS is an unverified mutation: in cutover the ledger has veto power,
  // so that rolls back too rather than letting unverified state stand. Shadow
  // mode is unchanged below.
  if (state.readPathMode === 'cutover' && isTitleMutation(mutation)) {
    let parityClean = false;
    let failureMessage =
      'Cutover parity divergence: the mutation was rolled back so the store '
      + 'matches the durable ledger. Resolve before relying on cutover.';
    try {
      parityClean = checkTitleInlineParity({
        mutation,
        origin: 'user',
        beforeWorkspace,
        afterWorkspace,
        ownerData: readOwnerData(),
      }).clean;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failureMessage =
        `Cutover parity check failed to run (${message}): the mutation was `
        + 'rolled back because it could not be verified against the ledger.';
    }
    if (!parityClean) {
      useWorkspaceStore.getState().restoreTitleSlice(beforeWorkspace);
      useTitleActionLog.setState({
        lastDivergence: {
          mutation,
          message: failureMessage,
          at: new Date().toISOString(),
        },
      });
      console.error(
        '[title-action-log] CUTOVER ROLLBACK — mutation reverted to keep the store '
          + `equal to the ledger (read source of truth): ${mutation}.`
      );
      return { rolledBack: true };
    }
  }

  const generationAtEnqueue = ledgerGeneration;
  const ownerData = readOwnerData();
  recordingChain = recordingChain.then(async () => {
    if (generationAtEnqueue !== ledgerGeneration) return;
    await recordBaselineIfNeeded({
      workspace: beforeWorkspace,
      ownerData,
      generationAtEnqueue,
    });
    if (generationAtEnqueue !== ledgerGeneration) return;
    return useTitleActionLog.getState().record({
      mutation,
      beforeWorkspace,
      afterWorkspace,
      ownerData,
    });
  });
  track(recordingChain);
  return { rolledBack: false };
});

setTitleActionLogResetHook(() => {
  useTitleActionLog.getState().reset();
});
