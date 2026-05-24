import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANDROID_SYSTEM_PROMPT } from '../system-prompt';
import { HOSTED_BLOCKED_TOOL_NAMES, UNDO_MUTATING_TOOL_NAMES } from '../tools';

function extractCoreRules(prompt: string): string {
  const start = prompt.indexOf('# Core rules');
  const end = prompt.indexOf('\n# Mutating tools');

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return prompt.slice(start, end).trim();
}

describe('LANDroid system prompt', () => {
  it('matches the Phase 0 core-rules golden snapshot', () => {
    const snapshot = readFileSync(
      resolve(process.cwd(), 'fixtures/phase-0/ai/system-prompt.snapshot.md'),
      'utf8'
    ).trim();

    expect(extractCoreRules(LANDROID_SYSTEM_PROMPT)).toBe(snapshot);
  });

  it('keeps exactly 10 non-negotiable rules', () => {
    const coreRules = extractCoreRules(LANDROID_SYSTEM_PROMPT);
    const numberedRules = coreRules.match(/^\d+\./gm) ?? [];

    expect(numberedRules).toHaveLength(10);
  });

  it('keeps critical safety language in the system prompt', () => {
    expect(LANDROID_SYSTEM_PROMPT).toContain('Texas-only active math');
    expect(LANDROID_SYSTEM_PROMPT).toContain('Federal/BLM records are reference-only inventory');
    expect(LANDROID_SYSTEM_PROMPT).toContain('Deterministic math owns truth');
    expect(LANDROID_SYSTEM_PROMPT).toContain('Mutating tools are approval-gated');
    expect(LANDROID_SYSTEM_PROMPT).toContain('No invented citations');
    expect(LANDROID_SYSTEM_PROMPT).toContain('# Reference: LANDroid Math Baseline');
  });

  it('documents every undo-mutating tool in the prompt tool section', () => {
    for (const name of UNDO_MUTATING_TOOL_NAMES) {
      expect(LANDROID_SYSTEM_PROMPT).toContain(`- '${name}'`);
    }
  });

  it('documents hosted-blocked focus switching without treating it as undo-mutating', () => {
    expect(UNDO_MUTATING_TOOL_NAMES.has('setActiveDeskMap')).toBe(false);
    expect(HOSTED_BLOCKED_TOOL_NAMES.has('setActiveDeskMap')).toBe(true);
    expect(LANDROID_SYSTEM_PROMPT).toContain("- 'setActiveDeskMap'");
    expect(LANDROID_SYSTEM_PROMPT).toContain('does not create an AI undo snapshot');
  });
});
