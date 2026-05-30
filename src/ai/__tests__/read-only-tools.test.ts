import { describe, expect, it } from 'vitest';
import {
  AI_UNDO_MUTATING_TOOL_NAMES,
  HOSTED_BLOCKED_TOOL_NAMES,
  landroidTools,
  readOnlyLandroidTools,
  UNDO_MUTATING_TOOL_NAMES,
} from '../tools';

describe('readOnlyLandroidTools (hosted-mode guard)', () => {
  it('contains no tool whose name is blocked in hosted mode', () => {
    const exposed = Object.keys(readOnlyLandroidTools);
    const leaked = exposed.filter((name) => HOSTED_BLOCKED_TOOL_NAMES.has(name));
    expect(leaked).toEqual([]);
  });

  it('is a strict subset of landroidTools', () => {
    const all = new Set(Object.keys(landroidTools));
    for (const name of Object.keys(readOnlyLandroidTools)) {
      expect(all.has(name)).toBe(true);
    }
  });

  it('covers every non-blocked tool (no accidental read-only drops)', () => {
    const expected = Object.keys(landroidTools).filter(
      (name) => !HOSTED_BLOCKED_TOOL_NAMES.has(name)
    );
    expect(Object.keys(readOnlyLandroidTools).sort()).toEqual(expected.sort());
  });

  it('keeps setActiveDeskMap out of hosted tools without burning the AI undo slot', () => {
    expect(UNDO_MUTATING_TOOL_NAMES.has('setActiveDeskMap')).toBe(false);
    expect(HOSTED_BLOCKED_TOOL_NAMES.has('setActiveDeskMap')).toBe(true);
    expect(readOnlyLandroidTools).not.toHaveProperty('setActiveDeskMap');
    expect(landroidTools).toHaveProperty('setActiveDeskMap');
  });

  it('hosted blocked tools include every undo-mutating tool', () => {
    for (const name of UNDO_MUTATING_TOOL_NAMES) {
      expect(HOSTED_BLOCKED_TOOL_NAMES.has(name)).toBe(true);
    }
  });

  it('keeps the undo-mutating registry aligned with registered tools', () => {
    expect([...UNDO_MUTATING_TOOL_NAMES].sort()).toEqual(
      [...AI_UNDO_MUTATING_TOOL_NAMES].sort()
    );

    for (const name of AI_UNDO_MUTATING_TOOL_NAMES) {
      expect(landroidTools).toHaveProperty(name);
    }
  });

  it('UNDO_MUTATING_TOOL_NAMES is non-empty (sanity)', () => {
    expect(UNDO_MUTATING_TOOL_NAMES.size).toBeGreaterThan(0);
  });
});
