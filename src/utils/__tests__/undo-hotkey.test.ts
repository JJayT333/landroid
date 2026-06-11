import { describe, expect, it } from 'vitest';
import { classifyUndoHotkey, shouldHandleUndoHotkey } from '../undo-hotkey';

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

describe('classifyUndoHotkey', () => {
  it('classifies undo and redo combos', () => {
    expect(classifyUndoHotkey(event())).toBe('undo');
    expect(classifyUndoHotkey(event({ shiftKey: true }))).toBe('redo');
    expect(classifyUndoHotkey(event({ key: 'Z', shiftKey: true }))).toBe('redo');
    // Windows-style Ctrl+Y redo; Cmd+Y is not a redo on mac.
    expect(
      classifyUndoHotkey(event({ key: 'y', metaKey: false, ctrlKey: true }))
    ).toBe('redo');
    expect(classifyUndoHotkey(event({ key: 'y' }))).toBeNull();
  });

  it('refuses editable targets and alt combos for both directions', () => {
    expect(classifyUndoHotkey(event({ altKey: true, shiftKey: true }))).toBeNull();
    expect(
      classifyUndoHotkey(event({ shiftKey: true, target: { tagName: 'INPUT' } }))
    ).toBeNull();
    expect(
      classifyUndoHotkey(
        event({ key: 'y', metaKey: false, ctrlKey: true, target: { tagName: 'TEXTAREA' } })
      )
    ).toBeNull();
  });
});
