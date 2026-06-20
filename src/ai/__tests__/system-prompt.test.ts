import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLandroidSystemPrompt,
  LANDROID_ADVISORY_SYSTEM_PROMPT,
  LANDROID_SYSTEM_PROMPT,
} from '../system-prompt';
import { HOSTED_BLOCKED_TOOL_NAMES, UNDO_MUTATING_TOOL_NAMES } from '../tools';

/** Every tool the model can name in the tool build. */
const ALL_TOOL_NAMES = [...UNDO_MUTATING_TOOL_NAMES, ...HOSTED_BLOCKED_TOOL_NAMES];

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

  it('exposes the default tool-build prompt via the builder unchanged', () => {
    expect(LANDROID_SYSTEM_PROMPT).toBe(
      buildLandroidSystemPrompt({ toolsAvailable: true })
    );
  });
});

describe('LANDroid advisory (hosted, no-tools) system prompt', () => {
  it('preserves the shared non-negotiable safety invariants', () => {
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('Texas-only active math');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain(
      'Federal/BLM records are reference-only inventory'
    );
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('Deterministic math owns truth');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('No invented citations');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain(
      'Hosted read-only context counts as project context'
    );
    // Conceptual math help must still work without tools.
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('# Reference: LANDroid Math Baseline');
  });

  it('keeps exactly 10 non-negotiable rules', () => {
    const start = LANDROID_ADVISORY_SYSTEM_PROMPT.indexOf('# Core rules');
    const end = LANDROID_ADVISORY_SYSTEM_PROMPT.indexOf('\n# What you can and cannot do');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const coreRules = LANDROID_ADVISORY_SYSTEM_PROMPT.slice(start, end);
    expect(coreRules.match(/^\d+\./gm) ?? []).toHaveLength(10);
  });

  it('never promises a tool, an approval queue, or an undo snapshot', () => {
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toContain('Mutating tools are approval-gated');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toContain('# Mutating tools — what each one does');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toContain('approval-gated');
    // Not 'mutating tools' anywhere — including the rule-9 tail, which names a
    // write path in the tool build but must not in the advisory build.
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toContain('mutating tools');
    // Pin the real undo/approval invariant, not a punctuation accident: the
    // tool build's positive promises must be absent, and the advisory negating
    // clause must be present.
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toContain('Each approved batch');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toContain('gets one undo snapshot');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain(
      'no approval queue, tool call, or undo snapshot available to you here'
    );
    // No mutating/focus tool may be named as something the model can call.
    for (const name of ALL_TOOL_NAMES) {
      expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toContain(`- '${name}'`);
    }
  });

  it('grounds computed numbers in the read-only packet so it can still relay coverage totals', () => {
    // Resolves the rule-6 ("never claim a number unless from a tool call") vs
    // rule-7 ("may answer about coverage totals in the packet") tension on the
    // no-tools path — without forking the golden-pinned rules.
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('source of truth for computed numbers');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('never recompute them yourself');
  });

  it('tells the model it cannot edit and must instruct instead', () => {
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('You have no editing tools on this path');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('# What you can and cannot do on this path');
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toContain('Never state or imply');
  });

  it('differs from the tool-build prompt only where capabilities differ', () => {
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).not.toBe(LANDROID_SYSTEM_PROMPT);
    expect(LANDROID_ADVISORY_SYSTEM_PROMPT).toBe(
      buildLandroidSystemPrompt({ toolsAvailable: false })
    );
  });
});
