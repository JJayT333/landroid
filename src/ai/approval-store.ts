import { create } from 'zustand';
import { withMutationOrigin } from '../store/workspace-store';
import { captureSnapshot, useAIUndoStore } from './undo-store';
import {
  buildAIApprovalDetails,
  recordAIActionResult,
  type AIApprovalDetail,
} from './action-journal';
import {
  assertAIApprovalPreviewCanApply,
  buildAIApprovalPreview,
  type AIApprovalPreview,
} from './approval-preview';

export interface AIApprovalProposal {
  id: string;
  toolName: string;
  input: unknown;
  summary: string;
  details: AIApprovalDetail[];
  preview: AIApprovalPreview;
  createdAt: number;
}

interface AIApprovalState {
  proposals: AIApprovalProposal[];
  enqueue: (proposal: Omit<AIApprovalProposal, 'id' | 'createdAt'>) => AIApprovalProposal;
  remove: (id: string) => void;
  clear: () => void;
  /**
   * Recompute every queued proposal's preview from the CURRENT workspace state.
   * Previews are computed once at enqueue time, so a card can drift stale if the
   * user edits the graph before approving — the displayed before/after numbers
   * and the `canApprove` gate would still reflect enqueue-time state (DA-M12).
   * The panel calls this on relevant store changes to keep cards live.
   */
  refreshPreviews: () => void;
}

type MutationExecutor = (input: unknown) => Promise<unknown>;

const mutationExecutors = new Map<string, MutationExecutor>();

/**
 * Order-stable serialization of a proposal's input so two structurally-equal
 * inputs compare equal regardless of key order. Used to collapse duplicate
 * pending proposals at enqueue time.
 */
function stableInputKey(input: unknown): string {
  return JSON.stringify(input, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
          a.localeCompare(b)
        )
      );
    }
    return value;
  });
}

export const useAIApprovalStore = create<AIApprovalState>()((set, get) => ({
  proposals: [],
  enqueue: (proposal) => {
    // Collapse an identical still-pending proposal (same tool + same input)
    // instead of queuing a second visually-identical approval card — e.g. when
    // the model proposes the same change twice within one tool loop.
    const duplicate = get().proposals.find(
      (existing) =>
        existing.toolName === proposal.toolName
        && stableInputKey(existing.input) === stableInputKey(proposal.input)
    );
    if (duplicate) return duplicate;
    const queued: AIApprovalProposal = {
      ...proposal,
      id: `ai-proposal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    set({ proposals: [...get().proposals, queued] });
    return queued;
  },
  remove: (id) =>
    set({ proposals: get().proposals.filter((proposal) => proposal.id !== id) }),
  clear: () => set({ proposals: [] }),
  refreshPreviews: () =>
    set({
      proposals: get().proposals.map((proposal) => ({
        ...proposal,
        preview: buildAIApprovalPreview(proposal.toolName, proposal.input),
      })),
    }),
}));

export function registerAIMutationExecutor(
  toolName: string,
  executor: MutationExecutor
): void {
  mutationExecutors.set(toolName, executor);
}

export function queueAIApprovalProposal(
  toolName: string,
  input: unknown,
  summary: string
): {
  ok: true;
  approvalRequired: true;
  proposalId: string;
  toolName: string;
  summary: string;
  preview: {
    canApprove: boolean;
    validationStatus: AIApprovalPreview['validation']['status'];
    validationMessage: string;
    issueCount: number;
  };
} {
  const preview = buildAIApprovalPreview(toolName, input);
  const proposal = useAIApprovalStore.getState().enqueue({
    toolName,
    input,
    summary,
    details: buildAIApprovalDetails(toolName, input),
    preview,
  });
  return {
    ok: true,
    approvalRequired: true,
    proposalId: proposal.id,
    toolName,
    summary,
    preview: {
      canApprove: preview.canApprove,
      validationStatus: preview.validation.status,
      validationMessage: preview.validation.message,
      issueCount: preview.validation.issueCount,
    },
  };
}

// Approvals in flight by proposal id. A second approve() for the same id while
// the first is still awaiting its executor returns the SAME promise instead of
// running the mutation twice (the proposal is only removed after the executor
// resolves, so a fast double-trigger would otherwise both find it and apply).
const inFlightApprovals = new Map<string, Promise<unknown>>();

export function approveAIProposal(id: string): Promise<unknown> {
  const existing = inFlightApprovals.get(id);
  if (existing) return existing;
  const run = runApproval(id);
  inFlightApprovals.set(id, run);
  return run.finally(() => inFlightApprovals.delete(id));
}

async function runApproval(id: string): Promise<unknown> {
  const proposal = useAIApprovalStore
    .getState()
    .proposals.find((item) => item.id === id);
  if (!proposal) {
    throw new Error(`AI proposal ${id} not found.`);
  }

  const executor = mutationExecutors.get(proposal.toolName);
  if (!executor) {
    throw new Error(`No approval executor registered for ${proposal.toolName}.`);
  }

  const undoLabel = `Approved AI: ${proposal.summary}`;
  // Capture the rollback point first, then re-assert applicability against the
  // exact state we are about to mutate, so the recheck and the executed
  // mutation see the same workspace rather than a snapshot taken in between
  // (DA-M12). A wasted snapshot on a rare abort is cheaper than executing a
  // mutation validated against different state.
  const snapshot = await captureSnapshot(undoLabel);
  assertAIApprovalPreviewCanApply(proposal.id, proposal.toolName, proposal.input);
  // DA-M3: tag the durable ledger with the real provenance. The executor calls
  // the store mutation synchronously, which fires the title journal hook inline,
  // so this `withMutationOrigin` scope is the one the hook reads — the awaited
  // promise resolves after the synchronous store call has already recorded.
  const result = await withMutationOrigin(
    'ai',
    () => executor(proposal.input),
    proposal.toolName
  );
  useAIApprovalStore.getState().remove(id);
  recordAIActionResult({
    proposalId: proposal.id,
    toolName: proposal.toolName,
    summary: proposal.summary,
    input: proposal.input,
    result,
    undoLabel,
  });

  if (
    snapshot
    && result
    && typeof result === 'object'
    && (result as { ok?: unknown }).ok !== false
  ) {
    useAIUndoStore.getState().setSnapshot(snapshot);
  }

  return result;
}
