/**
 * Characterization-baseline CLI for the unified title-math rewrite.
 *
 *   npx tsx scripts/title-math-baseline.ts --write   # freeze baselines
 *   npx tsx scripts/title-math-baseline.ts --check    # diff fresh vs frozen (default)
 *
 * `--write` captures every derived number for Springhill (oracle), Vulcan Mesa,
 * and Raven Forest and freezes them under fixtures/baseline/. `--check`
 * re-captures and diffs against the frozen files using the two-tolerance
 * classifier. During Phase A both sides use the live engine, so ANY divergence
 * is a reproducibility failure. In later phases this same script runs the new
 * engine against the frozen (old) baseline to surface real divergence.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { canonicalJson } from '../src/project-records/action-layer/canonical-json';
import { captureWorkspaceNumbers, type CapturedNumbers } from '../src/title-math/__diff__/capture';
import { oldEngineBundle } from '../src/title-math/__diff__/engine-bundle';
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

async function checkBaselines(): Promise<void> {
  let failed = false;
  for (const loader of PROJECT_LOADERS) {
    const path = baselinePath(loader.id);
    if (!existsSync(path)) {
      console.error(`MISSING baseline ${path} — run with --write first`);
      failed = true;
      continue;
    }
    const frozen = JSON.parse(await readFile(path, 'utf8')) as CapturedNumbers;
    const fresh = captureWorkspaceNumbers(loader.load(), oldEngineBundle);
    const divergences = diffCaptured(frozen, fresh);
    const summary = summarizeDivergences(divergences);
    const status =
      summary.total === 0 ? 'OK' : loader.oracle ? 'ORACLE DRIFT' : 'CHANGED';
    console.log(
      `${loader.id}: ${status} (byte=${summary.byte} value=${summary.value} structural=${summary.structural})`
    );
    for (const divergence of divergences.slice(0, 25)) {
      console.log(
        `  [${divergence.kind}] ${divergence.path}: ${JSON.stringify(divergence.a)} -> ${JSON.stringify(divergence.b)}`
      );
    }
    if (divergences.length > 25) {
      console.log(`  ... and ${divergences.length - 25} more`);
    }
    if (summary.total > 0) {
      failed = true;
    }
  }
  if (failed) {
    process.exitCode = 1;
  } else {
    console.log('all baselines reproduce exactly.');
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? '--check';
  if (mode === '--write') {
    await writeBaselines();
  } else {
    await checkBaselines();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
