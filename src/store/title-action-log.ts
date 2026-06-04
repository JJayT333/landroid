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
} from '../backend-spine/contracts';
import type { OwnerWorkspaceData } from '../storage/owner-persistence';
import type { WorkspaceData } from '../storage/workspace-persistence';
import { ParityDivergenceError } from '../project-records/action-layer/parity';
import { setTitleCutoverRuntimeStateReader } from '../project-records/action-layer/title-cutover-gate';
import {
  recordTitleMutation,
  TITLE_MUTATIONS,
  type TitleMutation,
} from '../project-records/action-layer/title-command-sourcing';
import { useOwnerStore } from './owner-store';
import { setTitleActionLogResetHook, setTitleJournalHook } from './workspace-store';

type OwnerSlice = Pick<OwnerWorkspaceData, 'owners' | 'leases'>;

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

export const useTitleActionLog = create<TitleActionLogState>()((set, get) => ({
  enabled: true,
  actionRecords: [],
  auditEvents: [],
  headHash: undefined,
  recordedMutationCount: 0,
  lastDivergence: null,
  lastError: null,

  setEnabled: (enabled) => set({ enabled }),

  reset: () => {
    ledgerGeneration += 1;
    recordingChain = Promise.resolve();
    set({
      actionRecords: [],
      auditEvents: [],
      headHash: undefined,
      recordedMutationCount: 0,
      lastDivergence: null,
      lastError: null,
    });
  },

  hydrate: ({ actionRecords, auditEvents }) => {
    ledgerGeneration += 1;
    recordingChain = Promise.resolve();
    set({
      actionRecords: [...actionRecords],
      auditEvents: [...auditEvents],
      headHash: auditEvents.at(-1)?.eventHash,
      recordedMutationCount: actionRecords.length,
      lastDivergence: null,
      lastError: null,
    });
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
  if (!useTitleActionLog.getState().enabled) return;
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
});

setTitleActionLogResetHook(() => {
  useTitleActionLog.getState().reset();
});
