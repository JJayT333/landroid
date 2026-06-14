import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { captureWorkspaceNumbers } from '../capture';
import { newEngineBundle } from '../engine-bundle';
import { diffCaptured, summarizeDivergences } from '../numbers-diff';
import { PROJECT_LOADERS } from '../projects';

const BASELINE_DIR = join(process.cwd(), 'fixtures', 'baseline');

/**
 * The unified engine (src/title-math) must reproduce the frozen baselines (the
 * live engine's output). Springhill is the byte-identity oracle: zero
 * divergence of any kind. Demo projects must be oracle-clean (no value /
 * structural divergence); benign byte-only residue from re-ordered arithmetic
 * would be allowed there, but the faithful-transcription phases produce none.
 */
describe('unified engine differential vs frozen baseline', () => {
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
