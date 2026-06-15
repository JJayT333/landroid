import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { captureWorkspaceNumbers } from '../capture';
import { newEngineBundle } from '../engine-bundle';
import { diffCaptured, summarizeDivergences } from '../numbers-diff';
import { PROJECT_LOADERS } from '../projects';

const BASELINE_DIR = join(process.cwd(), 'fixtures', 'baseline');

/**
 * REPRODUCIBILITY lock (not an old-vs-new differential -- see
 * scripts/title-math-baseline.ts for "what this proves"). Post-cutover the
 * frozen baselines are snapshots of THIS engine, re-frozen at every feature
 * commit, so this asserts the engine still reproduces its own frozen captured
 * numbers. It catches an accidental change to a captured leasehold/coverage/
 * node-display value; it does NOT prove the math matches the pre-rewrite engine,
 * and it is blind to sub-1e-9 errors, the mutation ops, and the new-feature
 * fields (those are guarded by the unit suites). A regression in a captured
 * number still trips this, so keep it green -- just don't read green as a
 * correctness proof.
 */
describe('unified engine differential vs frozen baseline (reproducibility lock)', () => {
  it.each(PROJECT_LOADERS)('$id: new engine matches the oracle baseline', ({ id, load, oracle }) => {
    const frozen = JSON.parse(readFileSync(join(BASELINE_DIR, `${id}.json`), 'utf8'));
    const fresh = captureWorkspaceNumbers(load(), newEngineBundle);
    const divergences = diffCaptured(frozen, fresh);
    const summary = summarizeDivergences(divergences);
    if (!summary.oracleClean || (oracle && summary.total > 0)) {
      console.error(
        `${id} divergence:`,
        divergences.slice(0, 10).map((divergence) => `[${divergence.kind}] ${divergence.path}`)
      );
    }
    expect(summary.oracleClean).toBe(true);
    if (oracle) {
      expect(summary.total).toBe(0);
    }
  });
});
