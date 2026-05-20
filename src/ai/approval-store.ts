import { create } from 'zustand';
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
}

type MutationExecutor = (input: unknown) => Promise<unknown>;

const mutationExecutors = new Map<string, MutationExecutor>();

export const useAIApprovalStore = create<AIApprovalState>()((set, get) => ({
  proposals: [],
  enqueue: (proposal) => {
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

export async function approveAIProposal(id: string): Promise<unknown> {
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
  assertAIApprovalPreviewCanApply(proposal.id, proposal.toolName, proposal.input);
  const snapshot = await captureSnapshot(undoLabel);
  const result = await executor(proposal.input);
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
