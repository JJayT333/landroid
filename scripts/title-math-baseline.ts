/**
 * Characterization-baseline CLI for the unified title-math engine.
 *
 *   npx tsx scripts/title-math-baseline.ts --write   # freeze baselines
 *   npx tsx scripts/title-math-baseline.ts --check    # diff fresh vs frozen (default)
 *
 * WHAT THIS DOES AND DOES NOT PROVE (read before citing a green result):
 *
 * This is now a REPRODUCIBILITY / SELF-CONSISTENCY lock, NOT an old-vs-new
 * differential. It froze its value as a true old-vs-new check during the port
 * (rewrite Phases A-E): the Phase-A baselines were captured from the REAL
 * pre-rewrite modules (before the Phase-F cutover), and the unified engine was
 * verified byte-identical against them then. That history is real.
 *
 * AFTER the Phase-F cutover the four old modules became shims re-exporting
 * src/title-math, so `oldEngineBundle` and `newEngineBundle` resolve to the SAME
 * code, and every feature commit re-froze the baselines from the new engine. So
 * a green `--check` today proves the engine still reproduces a frozen snapshot of
 * ITSELF -- it does NOT prove old == new, and it cannot fail for a uniform math
 * change. Do not cite green here as evidence the math is correct.
 *
 * It is genuinely useful as a regression LOCK on the read path: an accidental
 * change to a captured leasehold/coverage/node-display number will diverge from
 * the frozen value and be caught. It is BLIND to: (1) any final-output error
 * below the 9th decimal (quantized to the same string); (2) the mutation ops
 * (executeConveyance/Rebalance/etc.) and calculateShare, which the capture never
 * invokes -- those are guarded ONLY by src/engine/__tests__/math-engine.test.ts;
 * (3) the over-conveyance/double-fraction/statedFraction features, which no
 * fixture exercises -- guarded only by their unit tests. Correctness of the new
 * features rests on those unit tests + hand audit, not on a green baseline.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { canonicalJson } from '../src/project-records/action-layer/canonical-json';
import { captureWorkspaceNumbers, type CapturedNumbers } from '../src/title-math/__diff__/capture';
import {
  newEngineBundle,
  oldEngineBundle,
  type EngineBundle,
} from '../src/title-math/__diff__/engine-bundle';
import { diffCaptured, summarizeDivergences } from '../src/title-math/__diff__/numbers-diff';
import { PROJECT_LOADERS } from '../src/title-math/__diff__/projects';

const BASELINE_DIR = join('fixtures', 'baseline');

function baselinePath(id: string): string {
  return join(BASELINE_DIR, `${id}.json`);
}

/** Stable, key-sorted, pretty JSON (canonical order, human-diffable). */
function stablePretty(value: unknown): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`;
}

async function writeBaselines(): Promise<void> {
  await mkdir(BASELINE_DIR, { recursive: true });
  for (const loader of PROJECT_LOADERS) {
    const captured = captureWorkspaceNumbers(loader.load(), oldEngineBundle);
    await writeFile(baselinePath(loader.id), stablePretty(captured), 'utf8');
    console.log(
      `wrote ${baselinePath(loader.id)} (nodes=${captured.nodeDisplays.length}, tracts=${Object.keys(captured.coverageByTractCode).length})`
    );
  }
}

async function checkBaselines(bundle: EngineBundle, engineLabel: string): Promise<void> {
  // The frozen baselines were re-captured from the unified engine at each feature
  // commit, so post-cutover BOTH bundles resolve to that same engine: this is a
  // self-consistency reproducibility check, not an old-vs-new differential (see
  // the file header). Springhill staying clean here means "still reproduces its
  // frozen snapshot," not "matches the pre-rewrite engine." A value/structural
  // divergence still means a genuine, unintended change to a captured number --
  // investigate it -- but a green result is not a correctness proof.
  let failed = false;
  console.log(`checking ${engineLabel} engine against frozen baselines:`);
  for (const loader of PROJECT_LOADERS) {
    const path = baselinePath(loader.id);
    if (!existsSync(path)) {
      console.error(`MISSING baseline ${path} — run with --write first`);
      failed = true;
      continue;
    }
    const frozen = JSON.parse(await readFile(path, 'utf8')) as CapturedNumbers;
    const fresh = captureWorkspaceNumbers(loader.load(), bundle);
    const divergences = diffCaptured(frozen, fresh);
    const summary = summarizeDivergences(divergences);
    const status =
      summary.total === 0
        ? 'OK'
        : loader.oracle
          ? summary.oracleClean
            ? 'ORACLE BYTE-ONLY'
            : 'ORACLE DRIFT'
          : 'CHANGED';
    console.log(
      `  ${loader.id}: ${status} (byte=${summary.byte} value=${summary.value} structural=${summary.structural})`
    );
    for (const divergence of divergences.slice(0, 25)) {
      console.log(
        `    [${divergence.kind}] ${divergence.path}: ${JSON.stringify(divergence.a)} -> ${JSON.stringify(divergence.b)}`
      );
    }
    if (divergences.length > 25) {
      console.log(`    ... and ${divergences.length - 25} more`);
    }
    // Oracle: any non-clean is a hard failure. Demos: only a real (value/
    // structural) divergence fails; benign byte-only residue is informational.
    if (loader.oracle ? summary.total > 0 : !summary.oracleClean) {
      failed = true;
    }
  }
  if (failed) {
    process.exitCode = 1;
  } else {
    console.log('done.');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const mode = args.find((arg) => arg === '--write' || arg === '--check') ?? '--check';
  const useNew = args.includes('new') || args.includes('--engine=new') || args.includes('--new');
  if (mode === '--write') {
    await writeBaselines();
  } else {
    await checkBaselines(
      useNew ? newEngineBundle : oldEngineBundle,
      useNew ? 'NEW (title-math)' : 'OLD (oracle)'
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
