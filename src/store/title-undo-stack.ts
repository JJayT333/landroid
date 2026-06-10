/**
 * In-memory, per-session undo stack for title mutations (operator request,
 * 2026-06-10). Entries are pushed from the journal chokepoint
 * (`journalTitleMutation`) with the before-snapshot the hook already builds,
 * so coverage is exactly the journaled mutation set. Undoing applies that
 * snapshot as a NEW journaled mutation — the durable ledger stays append-only
 * and the store==ledger invariant holds (see docs/title-tree-read-cutover.md).
 *
 * Destructive mutations attach a cascade-restore thunk asynchronously (their
 * doomed Dexie rows are captured before the delete cascades fire); the entry
 * carries a promise that resolves to that thunk, or to null when there is
 * nothing beyond the title slice to restore.
 *
 * The stack is per-tab and never persisted: a reload clears it. The durable
 * title ledger remains the permanent record either way.
 */
import { create } from 'zustand';
import type { WorkspaceData } from '../storage/workspace-persistence';

/** Restores cascade-deleted rows; resolves with a warning when partial. */
export type CascadeRestoreThunk = () => Promise<{ warning?: string }>;

export interface TitleUndoEntry {
  mutation: string;
  /** Human label, e.g. "delete branch" — shown as "Undo: delete branch". */
  label: string;
  beforeWorkspace: WorkspaceData;
  /**
   * Resolves once the destructive mutation's cascade capture settles: a
   * restore thunk, or null when the title-slice restore is the whole undo.
   */
  cascadeRestore: Promise<CascadeRestoreThunk | null>;
}

export const TITLE_UNDO_STACK_LIMIT = 20;

interface TitleUndoStackState {
  entries: TitleUndoEntry[];
}

export const useTitleUndoStack = create<TitleUndoStackState>()(() => ({
  entries: [],
}));

const UNDO_LABELS: Record<string, string> = {
  convey: 'convey',
  createNpri: 'create NPRI',
  createRootNode: 'create root',
  precede: 'insert predecessor',
  graftToParent: 'attach conveyance',
  deleteNode: 'delete branch',
  attachLease: 'attach lease',
  update: 'edit',
};

export function titleUndoLabel(mutation: string): string {
  return UNDO_LABELS[mutation] ?? 'edit';
}

export function pushTitleUndoEntry(entry: TitleUndoEntry): void {
  useTitleUndoStack.setState((state) => ({
    entries: [...state.entries.slice(-(TITLE_UNDO_STACK_LIMIT - 1)), entry],
  }));
}

export function popTitleUndoEntry(): TitleUndoEntry | null {
  const { entries } = useTitleUndoStack.getState();
  const last = entries.at(-1) ?? null;
  if (last) {
    useTitleUndoStack.setState({ entries: entries.slice(0, -1) });
  }
  return last;
}

export function peekTitleUndoEntry(): TitleUndoEntry | null {
  return useTitleUndoStack.getState().entries.at(-1) ?? null;
}

export function clearTitleUndoStack(): void {
  useTitleUndoStack.setState({ entries: [] });
}

/** Reactive entry count for the Undo button's enabled state. */
export function useTitleUndoCount(): number {
  return useTitleUndoStack((state) => state.entries.length);
}

/** Reactive peek label for the Undo button's tooltip. */
export function useTitleUndoPeekLabel(): string | null {
  return useTitleUndoStack((state) => state.entries.at(-1)?.label ?? null);
}
