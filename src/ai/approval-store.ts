import { create } from 'zustand';
import { captureSnapshot, useAIUndoStore } from './undo-store';

export interface AIApprovalProposal {
  id: string;
  toolName: string;
  input: unknown;
  summary: string;
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
} {
  const proposal = useAIApprovalStore.getState().enqueue({
    toolName,
    input,
    summary,
  });
  return {
    ok: true,
    approvalRequired: true,
    proposalId: proposal.id,
    toolName,
    summary,
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

  const snapshot = await captureSnapshot(`Approved AI: ${proposal.summary}`);
  const result = await executor(proposal.input);
  useAIApprovalStore.getState().remove(id);

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
