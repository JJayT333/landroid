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

/**
 * Side-store curative cascade riding a title undo/redo entry (Missing Link).
 *
 * The High `'Missing link'` issue lives in the SEPARATE `useCurativeStore`, not
 * the node slice the title journal snapshots — so the workspace-slice restore
 * alone leaves it orphaned (raised but no node) or stale-Resolved (re-opened
 * node but closed issue). These optional closures let a missing-link mutation
 * tie the issue mutation to the SAME journaled entry as the node mutation,
 * mirroring the delete path's `CascadeBundle`: `undo` reverses the issue side
 * (remove the raise / re-open the close), and `redo` re-applies it (re-raise /
 * re-close). Absent on every non-missing-link mutation, so the recorded-node
 * undo path is unchanged.
 */
export interface CurativeUndoCascade {
  /** Reverse the issue side of this mutation when its node mutation is undone. */
  undo: () => void | Promise<void>;
  /** Re-apply the issue side when the mutation is redone. */
  redo: () => void | Promise<void>;
}

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
  /** Missing Link only: reverses/re-applies the linked curative issue. */
  curativeCascade?: CurativeUndoCascade;
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
  /** Missing Link only: carried across the undo→redo→undo handoff. */
  curativeCascade?: CurativeUndoCascade;
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
  insertMissingLink: 'insert missing link',
  resolveMissingLink: 'resolve missing link',
  setPlaceholderPassthrough: 'toggle missing-link passthrough',
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

/**
 * Attach a Missing Link curative cascade to the most recently pushed undo
 * entry. The journal chokepoint pushes the entry (with the node before-snapshot)
 * inside the same synchronous `set()`; the missing-link mutator then calls this
 * to bind the issue-side reverse/re-apply to that exact entry. No-op if the
 * mutation was a same-slice no-op or a cutover rollback (no entry was pushed).
 */
export function attachCurativeUndoCascade(cascade: CurativeUndoCascade): void {
  useTitleUndoStack.setState((state) => {
    if (state.entries.length === 0) return {};
    const entries = state.entries.slice();
    const last = entries[entries.length - 1];
    entries[entries.length - 1] = { ...last, curativeCascade: cascade };
    return { entries };
  });
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
