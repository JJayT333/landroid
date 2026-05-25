import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface BaselineStatus {
  machineProfile: {
    status: string;
    profilePath: string;
  };
  baselines: Array<{
    id: string;
    status: string;
    result: Record<string, unknown>;
    rawProfilePath: string;
    machineProfilePath: string;
    visualReviewPath?: string;
    driftBudget: string;
  }>;
}

const EXPECTED_PERF_IDS = [
  'PERF-01',
  'PERF-02',
  'PERF-03',
  'PERF-04',
  'PERF-05',
  'PERF-06',
  'PERF-07',
  'PERF-08',
];

function fixturePath(path: string): string {
  return resolve(process.cwd(), path);
}

describe('Phase 0 performance baselines', () => {
  it('keeps the baseline catalog complete and linked to raw artifacts', () => {
    const status = JSON.parse(
      readFileSync(fixturePath('fixtures/phase-0/perf/baseline-status.json'), 'utf8')
    ) as BaselineStatus;

    expect(status.machineProfile.status).toBe('captured');
    expect(existsSync(fixturePath(status.machineProfile.profilePath))).toBe(true);
    expect(status.baselines.map((baseline) => baseline.id)).toEqual(EXPECTED_PERF_IDS);

    for (const baseline of status.baselines) {
      expect(baseline.status).toBe('captured');
      expect(Object.keys(baseline.result).length).toBeGreaterThan(0);
      expect(baseline.driftBudget).toMatch(/^\+\/- \d+%$/);
      expect(existsSync(fixturePath(baseline.rawProfilePath))).toBe(true);
      expect(existsSync(fixturePath(baseline.machineProfilePath))).toBe(true);
      if (baseline.visualReviewPath) {
        expect(existsSync(fixturePath(baseline.visualReviewPath))).toBe(true);
      }
    }
  });
});
