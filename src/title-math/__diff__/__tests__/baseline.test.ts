import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { canonicalJson } from '../../../project-records/action-layer/canonical-json';
import { captureWorkspaceNumbers } from '../capture';
import { oldEngineBundle } from '../engine-bundle';
import { diffCaptured, summarizeDivergences } from '../numbers-diff';
import { loadSpringhill, loadVulcanMesa, PROJECT_LOADERS } from '../projects';

const PHASE_0_DIR = join(process.cwd(), 'fixtures', 'phase-0');
const BASELINE_DIR = join(process.cwd(), 'fixtures', 'baseline');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('title-math characterization harness', () => {
  it('capture is a pure function of the workspace (same input -> identical output)', () => {
    const input = loadVulcanMesa();
    const a = captureWorkspaceNumbers(input, oldEngineBundle);
    const b = captureWorkspaceNumbers(input, oldEngineBundle);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it('reconciles Vulcan Mesa leasehold capture with the committed demo.leasehold-decimals.json golden', () => {
    const captured = captureWorkspaceNumbers(loadVulcanMesa(), oldEngineBundle);
    const golden = readJson(join(PHASE_0_DIR, 'demo.leasehold-decimals.json')) as {
      unitRows: unknown;
      focusedRowsByTractCode: unknown;
      transferOrderReview: unknown;
    };
    expect(canonicalJson(captured.unitRows)).toBe(canonicalJson(golden.unitRows));
    expect(canonicalJson(captured.focusedRowsByTractCode)).toBe(
      canonicalJson(golden.focusedRowsByTractCode)
    );
    expect(canonicalJson(captured.transferOrderReview)).toBe(
      canonicalJson(golden.transferOrderReview)
    );
  });

  it('reconciles Vulcan Mesa coverage capture with the committed demo.coverage-summary.json golden', () => {
    const captured = captureWorkspaceNumbers(loadVulcanMesa(), oldEngineBundle);
    const golden = readJson(join(PHASE_0_DIR, 'demo.coverage-summary.json')) as {
      tracts: Array<{ code: string; summary: unknown }>;
    };
    for (const tract of golden.tracts) {
      expect(canonicalJson(captured.coverageByTractCode[tract.code])).toBe(
        canonicalJson(tract.summary)
      );
    }
  });

  it('captures the Springhill oracle anchor numbers (TR1 0.225 / 0.775, fully leased)', () => {
    const captured = captureWorkspaceNumbers(loadSpringhill(), oldEngineBundle);
    const tractOne = captured.leaseholdSummary.tracts.find((tract) => tract.code === 'TR1');
    expect(tractOne).toBeDefined();
    expect(tractOne).toMatchObject({
      leasedOwnership: '1',
      weightedRoyaltyRate: '0.225',
      nriBeforeOrriRate: '0.775',
    });
  });

  it.each(PROJECT_LOADERS)(
    'frozen baseline for $id matches a fresh capture (drift tripwire)',
    ({ id, load }) => {
      const frozen = readJson(join(BASELINE_DIR, `${id}.json`));
      const fresh = captureWorkspaceNumbers(load(), oldEngineBundle);
      const divergences = diffCaptured(frozen, fresh);
      const summary = summarizeDivergences(divergences);
      if (summary.total > 0) {
        // Surface the first few so a failure is actionable.
        console.error(
          `${id} baseline drift:`,
          divergences.slice(0, 10).map((divergence) => divergence.path)
        );
      }
      expect(summary.total).toBe(0);
    }
  );
});
