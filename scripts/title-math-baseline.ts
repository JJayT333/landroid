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
  // The frozen baselines are always the live (old) engine -- the oracle. With
  // the old bundle this is a reproducibility check (expect zero divergence);
  // with the new bundle it is the real differential: Springhill must stay
  // oracle-clean (no value/structural divergence); demo 'value'/'structural'
  // divergences are signals to investigate.
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
