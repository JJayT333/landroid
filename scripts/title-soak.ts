/**
 * Title-ledger soak harness (SHADOW verification - read-only).
 *
 * Synthesizes one whole-workspace `createRootNode` title mutation via
 * `recordTitleMutation` (empty -> full), then proves the durable title
 * ActionRecord it produces is self-sufficient:
 *   1. replay == adapter - `replayTitleProjection(records)` must equal the
 *      adapter's title slice (`titleRecordsFromWorkspace`).
 *   2. math parity - the node set reconstructed from the record snapshots must
 *      drive the identical `MathInputView` as the live workspace.
 * The soak fails (non-zero exit) if either check diverges. It exercises the
 * record/replay/projection primitives, NOT the live `useTitleActionLog` store or
 * `ensureTitleBaseline` - it is replay/math evidence, not live-recording-path or
 * whole-workspace-baseline coverage.
 *
 * GUARDRAILS:
 * - This NEVER flips a live read path. It only records the shadow ledger and
 *   compares projections. The Zustand store stays canonical.
 * - This script ships NO real data and references NO real file path. Synthetic
 *   Vulcan Mesa is the default. A real `.landroid` is supplied at runtime via
 *   `--file <path>` by the operator and is read, never written.
 *
 * Usage:
 *   npx tsx scripts/title-soak.ts
 *   npx tsx scripts/title-soak.ts --file <path>
 *   npx tsx scripts/title-soak.ts --json
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { OwnerWorkspaceData } from '../src/storage/owner-persistence';
import type { WorkspaceData } from '../src/storage/workspace-persistence';
import { importLandroidFile } from '../src/storage/workspace-persistence';
import { buildVulcanMesaWorkspaceData } from '../src/storage/seed-vulcan-mesa';
import { canonicalJson } from '../src/project-records/action-layer/canonical-json';
import { titleRecordsFromWorkspace } from '../src/project-records/action-layer/title-projection';
import { replayTitleProjection } from '../src/project-records/action-layer/title-replay';
import { runTitleMathParity } from '../src/project-records/action-layer/title-math-parity';
import type { BackendSpineCoreRecord } from '../src/backend-spine/contracts';
import { recordTitleMutation } from '../src/project-records/action-layer/title-command-sourcing';

type OwnerSlice = Pick<OwnerWorkspaceData, 'owners' | 'leases'>;

interface SoakInput {
  label: string;
  workspace: WorkspaceData;
  ownerData: OwnerSlice;
}

function sortedCanonical(records: readonly BackendSpineCoreRecord[]): string {
  return canonicalJson(
    [...records].sort((a, b) =>
      a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0
    )
  );
}

function firstRecordDivergence(
  replayed: readonly BackendSpineCoreRecord[],
  adapter: readonly BackendSpineCoreRecord[]
): string | null {
  const adapterById = new Map(adapter.map((record) => [record.recordId, record]));
  const replayedById = new Map(
    replayed.map((record) => [record.recordId, record])
  );
  for (const record of replayed) {
    const adapterRecord = adapterById.get(record.recordId);
    if (!adapterRecord) return `${record.recordId} (in replay, not in adapter)`;
    if (canonicalJson(record) !== canonicalJson(adapterRecord)) {
      return `${record.recordId} (content differs)`;
    }
  }
  for (const record of adapter) {
    if (!replayedById.has(record.recordId)) {
      return `${record.recordId} (in adapter, not in replay)`;
    }
  }
  return null;
}

async function loadFromFile(path: string): Promise<SoakInput> {
  const bytes = await readFile(path);
  const file = new File([new Uint8Array(bytes)], basename(path), {
    type: 'application/json',
  });
  const data = await importLandroidFile(file);
  return {
    label: `file: ${path}`,
    workspace: data,
    ownerData: {
      owners: data.ownerData?.owners ?? [],
      leases: data.ownerData?.leases ?? [],
    },
  };
}

function loadSynthetic(): SoakInput {
  const vm = buildVulcanMesaWorkspaceData();
  const { ownerData, ...workspaceFields } = vm;
  return {
    label: 'synthetic: Vulcan Mesa',
    workspace: workspaceFields as unknown as WorkspaceData,
    ownerData: { owners: ownerData.owners, leases: ownerData.leases },
  };
}

function emptyWorkspace(workspace: WorkspaceData): WorkspaceData {
  return {
    ...workspace,
    nodes: [],
    deskMaps: workspace.deskMaps.map((deskMap) => ({ ...deskMap, nodeIds: [] })),
  };
}

interface SoakReport {
  source: string;
  workspaceId: string;
  nodeCount: number;
  adapterTitleRecordCount: number;
  recordCount: number;
  replayClean: boolean;
  replayedRecordCount: number;
  replayFirstDivergence: string | null;
  mathClean: boolean;
  mathDivergentKeys: string[];
  elapsedMs: number;
  peakRssMb: number;
  pass: boolean;
}

async function runSoak(input: SoakInput): Promise<SoakReport> {
  const t0 = Date.now();
  const generatedAt = new Date().toISOString();
  const baseline = await recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'system',
    approvedBy: 'system',
    context: {
      workspaceId: input.workspace.workspaceId,
      projectId: input.workspace.workspaceId,
      generatedAt,
      revision: 0,
      source: 'local',
      syncState: 'local_only',
    },
    appliedAt: generatedAt,
    beforeWorkspace: emptyWorkspace(input.workspace),
    afterWorkspace: input.workspace,
    ownerData: input.ownerData,
  });
  const records = [baseline.actionRecord] as BackendSpineCoreRecord[];

  const replayed = replayTitleProjection(records);

  const adapter = titleRecordsFromWorkspace({
    workspace: input.workspace,
    ownerData: input.ownerData,
    projectId: input.workspace.workspaceId,
    generatedAt,
  });

  const replayClean = sortedCanonical(replayed) === sortedCanonical(adapter);
  const replayFirstDivergence = replayClean
    ? null
    : firstRecordDivergence(replayed, adapter);

  const math = runTitleMathParity({
    liveWorkspace: input.workspace,
    records,
    ownerData: input.ownerData,
    projectId: input.workspace.workspaceId,
    generatedAt,
  });

  const pass =
    replayClean &&
    math.clean;

  return {
    source: input.label,
    workspaceId: input.workspace.workspaceId,
    nodeCount: input.workspace.nodes.length,
    adapterTitleRecordCount: adapter.length,
    recordCount: records.length,
    replayClean,
    replayedRecordCount: replayed.length,
    replayFirstDivergence,
    mathClean: math.clean,
    mathDivergentKeys: math.divergentKeys,
    elapsedMs: Date.now() - t0,
    peakRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    pass,
  };
}

function printHuman(report: SoakReport): void {
  const ok = (value: boolean) => (value ? 'PASS' : 'FAIL');
  const lines = [
    'LANDroid title-ledger soak',
    `  source                : ${report.source}`,
    `  workspace             : ${report.workspaceId}`,
    `  nodes                 : ${report.nodeCount}`,
    `  adapter title records : ${report.adapterTitleRecordCount}`,
    `  synthesized records   : ${report.recordCount}`,
    `  [replay == adapter]   : ${ok(report.replayClean)} (replayed ${report.replayedRecordCount} vs adapter ${report.adapterTitleRecordCount})`,
    ...(report.replayFirstDivergence
      ? [`      first divergence  : ${report.replayFirstDivergence}`]
      : []),
    `  [math parity]         : ${ok(report.mathClean)}${
      report.mathDivergentKeys.length
        ? ` (divergent keys: ${report.mathDivergentKeys.join(', ')})`
        : ''
    }`,
    `  elapsed               : ${(report.elapsedMs / 1000).toFixed(2)}s   peak rss: ${report.peakRssMb} MB`,
    `  RESULT                : ${ok(report.pass)}`,
  ];
  console.log(lines.join('\n'));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--file');
  const filePath = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
  const asJson = args.includes('--json');

  if (fileIdx >= 0 && !filePath) {
    throw new Error('--file requires a path argument');
  }

  const input = filePath ? await loadFromFile(filePath) : loadSynthetic();
  const report = await runSoak(input);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  process.exit(report.pass ? 0 : 1);
}

void main().catch((err) => {
  console.error('[title-soak] aborted:', err);
  process.exit(2);
});
