import { describe, expect, it } from 'vitest';
import { MUTATING_TOOL_NAMES, landroidTools, readOnlyLandroidTools } from '../tools';

describe('readOnlyLandroidTools (hosted-mode guard)', () => {
  it('contains no tool whose name is in MUTATING_TOOL_NAMES', () => {
    const exposed = Object.keys(readOnlyLandroidTools);
    const leaked = exposed.filter((name) => MUTATING_TOOL_NAMES.has(name));
    expect(leaked).toEqual([]);
  });

  it('is a strict subset of landroidTools', () => {
    const all = new Set(Object.keys(landroidTools));
    for (const name of Object.keys(readOnlyLandroidTools)) {
      expect(all.has(name)).toBe(true);
    }
  });

  it('covers every non-mutating tool (no accidental read-only drops)', () => {
    const expected = Object.keys(landroidTools).filter(
      (name) => !MUTATING_TOOL_NAMES.has(name)
    );
    expect(Object.keys(readOnlyLandroidTools).sort()).toEqual(expected.sort());
  });

  it('MUTATING_TOOL_NAMES is non-empty (sanity)', () => {
    expect(MUTATING_TOOL_NAMES.size).toBeGreaterThan(0);
  });
});
