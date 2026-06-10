import { describe, expect, it } from 'vitest';
import { shouldHandleUndoHotkey } from '../undo-hotkey';

function event(overrides: Partial<Parameters<typeof shouldHandleUndoHotkey>[0]> = {}) {
  return {
    key: 'z',
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { tagName: 'BODY', isContentEditable: false },
    ...overrides,
  };
}

describe('shouldHandleUndoHotkey', () => {
  it('handles Cmd+Z and Ctrl+Z on non-editable targets', () => {
    expect(shouldHandleUndoHotkey(event())).toBe(true);
    expect(shouldHandleUndoHotkey(event({ metaKey: false, ctrlKey: true }))).toBe(true);
    expect(shouldHandleUndoHotkey(event({ key: 'Z' }))).toBe(true);
  });

  it('ignores plain z, other keys, and redo-style combos', () => {
    expect(shouldHandleUndoHotkey(event({ metaKey: false }))).toBe(false);
    expect(shouldHandleUndoHotkey(event({ key: 'y' }))).toBe(false);
    expect(shouldHandleUndoHotkey(event({ shiftKey: true }))).toBe(false);
    expect(shouldHandleUndoHotkey(event({ altKey: true }))).toBe(false);
  });

  it('never hijacks editable elements (native field undo wins)', () => {
    expect(shouldHandleUndoHotkey(event({ target: { tagName: 'INPUT' } }))).toBe(false);
    expect(shouldHandleUndoHotkey(event({ target: { tagName: 'TEXTAREA' } }))).toBe(false);
    expect(shouldHandleUndoHotkey(event({ target: { tagName: 'SELECT' } }))).toBe(false);
    expect(
      shouldHandleUndoHotkey(event({ target: { tagName: 'DIV', isContentEditable: true } }))
    ).toBe(false);
    expect(shouldHandleUndoHotkey(event({ target: null }))).toBe(true);
  });
});
