/**
 * Cmd/Ctrl+Z / Shift+Z / Ctrl+Y routing for the title undo/redo controls. The
 * global handler must never hijack native text-editing undo, so the combos
 * only count when focus is not in an editable element. Pure and DOM-free for
 * unit testing.
 */
interface HotkeyEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target: unknown;
}

function inEditableTarget(target: unknown): boolean {
  const element = target as
    | { tagName?: string; isContentEditable?: boolean }
    | null;
  if (!element) return false;
  const tag = (element.tagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(element.isContentEditable);
}

/**
 * Classify a keydown: 'undo' (Cmd/Ctrl+Z), 'redo' (Cmd/Ctrl+Shift+Z, or
 * Ctrl+Y on Windows), or null when the combo isn't ours or focus is editable.
 */
export function classifyUndoHotkey(
  event: HotkeyEventLike
): 'undo' | 'redo' | null {
  if (event.altKey) return null;
  if (!(event.metaKey || event.ctrlKey)) return null;
  if (inEditableTarget(event.target)) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  // Windows-style redo; Shift+Y means nothing to us.
  if (key === 'y' && !event.shiftKey && event.ctrlKey && !event.metaKey) {
    return 'redo';
  }
  return null;
}

/** Back-compat predicate for the original undo-only wiring. */
export function shouldHandleUndoHotkey(event: HotkeyEventLike): boolean {
  return classifyUndoHotkey(event) === 'undo';
}
