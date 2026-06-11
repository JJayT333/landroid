/**
 * In-memory, per-session undo/redo stacks for title mutations (operator
 * request, 2026-06-10; redo added 2026-06-11). Undo entries are pushed from
 * the journal chokepoint (`journalTitleMutation`) with the before-snapshot the
 * hook already builds, so coverage is exactly the journaled mutation set.
 * Undoing applies that snapshot as a NEW journaled mutation — the durable
 * ledger stays append-only and the store==ledger invariant holds (see
 * docs/title-tree-read-cutover.md). Redo mirrors it: undo moves the entry to
 * the redo stack carrying the state the original mutation produced; redoing
 * restores that state as another fresh journaled mutation and hands the entry
 * back to the undo stack. Any genuinely new mutation clears the redo stack
 * (the classic divergent-future rule); the journal chokepoint owns that, so
 * undo/redo's own suppressed journals never clear it.
 *
 * Destructive mutations attach their captured cascade bundle asynchronously
 * (the doomed Dexie rows are read before the delete cascades fire, and the
 * promise resolves only after those cascades settle). Undo derives the
 * restore from the bundle and snapshots the post-cascade row forms for redo's
 * exact re-apply.
 *
 * Both stacks are per-tab and never persisted: a reload clears them. The
 * durable title ledger remains the permanent record either way.
 */
import { create } from 'zustand';
import type {
  CascadeBundle,
  CascadeReapplyBundle,
} from '../storage/undo-cascade-bundle';
import type { WorkspaceData } from '../storage/workspace-persistence';

export interface TitleUndoEntry {
  mutation: string;
  /** Human label, e.g. "delete branch" — shown as "Undo: delete branch". */
  label: string;
  beforeWorkspace: WorkspaceData;
  /**
   * Resolves once the destructive mutation's cascades settle: the captured
   * doomed-row bundle, or null when the title-slice restore is the whole
   * undo. Resolving after the cascades is load-bearing — an immediate undo
   * must not restore rows a still-running cascade is about to delete.
   */
  cascade: Promise<CascadeBundle | null>;
}

export interface TitleRedoEntry {
  mutation: string;
  label: string;
  /** The state the original mutation produced (captured at undo time). */
  afterWorkspace: WorkspaceData;
  /** The original doomed-row bundle — handed back to undo after a redo. */
  cascadeBundle: CascadeBundle | null;
  /** Post-cascade row snapshot: redo re-applies this exact form. */
  cascadeReapply: CascadeReapplyBundle | null;
}

export const TITLE_UNDO_STACK_LIMIT = 20;

interface TitleUndoStackState {
  entries: TitleUndoEntry[];
  redoEntries: TitleRedoEntry[];
}

export const useTitleUndoStack = create<TitleUndoStackState>()(() => ({
  entries: [],
  redoEntries: [],
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

export function pushTitleRedoEntry(entry: TitleRedoEntry): void {
  useTitleUndoStack.setState((state) => ({
    redoEntries: [
      ...state.redoEntries.slice(-(TITLE_UNDO_STACK_LIMIT - 1)),
      entry,
    ],
  }));
}

export function popTitleRedoEntry(): TitleRedoEntry | null {
  const { redoEntries } = useTitleUndoStack.getState();
  const last = redoEntries.at(-1) ?? null;
  if (last) {
    useTitleUndoStack.setState({ redoEntries: redoEntries.slice(0, -1) });
  }
  return last;
}

export function clearTitleRedoStack(): void {
  useTitleUndoStack.setState({ redoEntries: [] });
}

export function clearTitleUndoStack(): void {
  useTitleUndoStack.setState({ entries: [], redoEntries: [] });
}

/** Reactive entry count for the Undo button's enabled state. */
export function useTitleUndoCount(): number {
  return useTitleUndoStack((state) => state.entries.length);
}

/** Reactive peek label for the Undo button's tooltip. */
export function useTitleUndoPeekLabel(): string | null {
  return useTitleUndoStack((state) => state.entries.at(-1)?.label ?? null);
}

/** Reactive entry count for the Redo button's enabled state. */
export function useTitleRedoCount(): number {
  return useTitleUndoStack((state) => state.redoEntries.length);
}

/** Reactive peek label for the Redo button's tooltip. */
export function useTitleRedoPeekLabel(): string | null {
  return useTitleUndoStack((state) => state.redoEntries.at(-1)?.label ?? null);
}
