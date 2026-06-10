/**
 * Cmd/Ctrl+Z routing for the title undo button. The global handler must never
 * hijack native text-editing undo, so the combo only counts when focus is not
 * in an editable element. Pure and DOM-free for unit testing.
 */
export function shouldHandleUndoHotkey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: unknown;
}): boolean {
  if (event.key.toLowerCase() !== 'z') return false;
  if (!(event.metaKey || event.ctrlKey)) return false;
  // Leave Shift/Alt combos (redo et al.) alone — there is no redo (v1).
  if (event.shiftKey || event.altKey) return false;
  const target = event.target as
    | { tagName?: string; isContentEditable?: boolean }
    | null;
  if (!target) return true;
  const tag = (target.tagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (target.isContentEditable) return false;
  return true;
}
