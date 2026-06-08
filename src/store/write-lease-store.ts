/**
 * Reactive view of this tab's single-writer lease role (Phase 0.5).
 *
 * The runtime lease controller in `storage/workspace-write-lease.ts` pushes
 * role transitions here; the UI subscribes to surface the read-only banner.
 * Keeping this a thin store (no Dexie/BroadcastChannel) lets the banner react
 * without importing the storage layer.
 */
import { create } from 'zustand';
import type { WorkspaceWriteRole } from '../storage/workspace-write-lease';

interface WriteLeaseState {
  role: WorkspaceWriteRole;
  workspaceId: string | null;
  setRole: (role: WorkspaceWriteRole, workspaceId: string | null) => void;
}

export const useWriteLeaseStore = create<WriteLeaseState>((set) => ({
  role: 'idle',
  workspaceId: null,
  setRole: (role, workspaceId) => set({ role, workspaceId }),
}));

export const READ_ONLY_WORKSPACE_EDIT_TITLE =
  'Read-only: another tab holds the workspace write lease. Take over editing to make changes.';

/**
 * Read-only is the reader role only. `idle` (lease not yet engaged) and
 * `writer` both allow edits, so the banner stays hidden until another tab is
 * confirmed to hold the lease.
 */
export function isWorkspaceReadOnly(role: WorkspaceWriteRole): boolean {
  return role === 'reader';
}

export function useWorkspaceReadOnly(): boolean {
  const role = useWriteLeaseStore((state) => state.role);
  return isWorkspaceReadOnly(role);
}
