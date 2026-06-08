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
 *   3. .landroid round trip - the same ledger is exported into an in-memory
 *      `.landroid` bundle, re-imported, replayed, and compared back to the
 *      adapter/title math output. The computed result feeds a diagnostic-only
 *      `TitleTreeCutoverGate.setLandroidRoundTripClean(...)` readiness snapshot.
 * The soak fails (non-zero exit) if any check diverges. It exercises the
 * record/replay/projection/file-format primitives, NOT the live
 * `useTitleActionLog` store or `ensureTitleBaseline` - it is replay/math/
 * round-trip evidence, not live-recording-path or whole-workspace-baseline
 * coverage.
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
import { exportLandroidFile, importLandroidFile } from '../src/storage/workspace-persistence';
import { buildVulcanMesaWorkspaceData } from '../src/storage/seed-vulcan-mesa';
import { canonicalJson } from '../src/project-records/action-layer/canonical-json';
import { titleRecordsFromWorkspace } from '../src/project-records/action-layer/title-projection';
import { replayTitleProjection } from '../src/project-records/action-layer/title-replay';
import { runTitleMathParity } from '../src/project-records/action-layer/title-math-parity';
import type {
  ActionRecord,
  AuditEventRecord,
  BackendSpineCoreRecord,
} from '../src/backend-spine/contracts';
import { recordTitleMutation } from '../src/project-records/action-layer/title-command-sourcing';
import {
  TitleTreeCutoverGate,
  type TitleCutoverReadiness,
} from '../src/project-records/action-layer/title-cutover-gate';
import type { ParityReport } from '../src/project-records/action-layer/parity';

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

function titleParityReport(input: {
  clean: boolean;
  adapterCount: number;
  replayedCount: number;
  firstDivergence: string | null;
}): ParityReport {
  return {
    workflow: 'title_tree',
    clean: input.clean,
    expectedCount: input.adapterCount,
    derivedCount: input.replayedCount,
    divergences: input.clean
      ? []
      : [
          {
            kind: 'changed_record',
            recordId: input.firstDivergence ?? 'unknown',
            recordType: null,
            detail: 'title soak replay diverged before .landroid round-trip gating',
          },
        ],
  };
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
  landroidRoundTripClean: boolean;
  landroidRoundTripLedgerPresent: boolean;
  landroidRoundTripOriginalLedgerClean: boolean;
  landroidRoundTripReplayClean: boolean;
  landroidRoundTripMathClean: boolean;
  landroidRoundTripImportedActionRecordCount: number;
  landroidRoundTripImportedAuditEventCount: number;
  landroidRoundTripFirstDivergence: string | null;
  readiness: TitleCutoverReadiness;
  elapsedMs: number;
  peakRssMb: number;
  pass: boolean;
}

interface LandroidRoundTripReport {
  clean: boolean;
  ledgerPresent: boolean;
  originalLedgerClean: boolean;
  replayClean: boolean;
  mathClean: boolean;
  importedActionRecordCount: number;
  importedAuditEventCount: number;
  firstDivergence: string | null;
}

async function runLandroidRoundTrip(input: {
  soakInput: SoakInput;
  generatedAt: string;
  actionRecords: readonly ActionRecord[];
  auditEvents: readonly AuditEventRecord[];
  adapter: readonly BackendSpineCoreRecord[];
}): Promise<LandroidRoundTripReport> {
  const blob = await exportLandroidFile(
    {
      ...input.soakInput.workspace,
      ownerData: {
        owners: input.soakInput.ownerData.owners,
        leases: input.soakInput.ownerData.leases,
        contacts: [],
        docs: [],
      },
    },
    {
      actionRecords: input.actionRecords,
      auditEvents: input.auditEvents,
    }
  );
  const text = await blob.text();
  const imported = await importLandroidFile(
    new File([text], 'title-soak-roundtrip.landroid', {
      type: 'application/json',
    })
  );
  const ledgerRecords = imported.actionLedger?.records ?? [];
  const importedActionRecords = ledgerRecords.filter(
    (record): record is ActionRecord => record.recordType === 'action_record'
  );
  const importedAuditEvents = ledgerRecords.filter(
    (record): record is AuditEventRecord => record.recordType === 'audit_event'
  );
  const importedReplay = replayTitleProjection(importedActionRecords);
  const firstDivergence = firstRecordDivergence(importedReplay, input.adapter);
  const replayClean = firstDivergence === null;
  const math = runTitleMathParity({
    liveWorkspace: input.soakInput.workspace,
    records: importedActionRecords,
    ownerData: input.soakInput.ownerData,
    projectId: input.soakInput.workspace.workspaceId,
    generatedAt: input.generatedAt,
  });
  const originalLedgerClean =
    sortedCanonical(importedActionRecords) === sortedCanonical(input.actionRecords) &&
    sortedCanonical(importedAuditEvents) === sortedCanonical(input.auditEvents);

  return {
    clean:
      imported.actionLedger !== undefined &&
      originalLedgerClean &&
      replayClean &&
      math.clean,
    ledgerPresent: imported.actionLedger !== undefined,
    originalLedgerClean,
    replayClean,
    mathClean: math.clean,
    importedActionRecordCount: importedActionRecords.length,
    importedAuditEventCount: importedAuditEvents.length,
    firstDivergence,
  };
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
  const actionRecords = [baseline.actionRecord];
  const auditEvents = [baseline.auditEvent];
  const records = actionRecords as BackendSpineCoreRecord[];

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

  const landroidRoundTrip = await runLandroidRoundTrip({
    soakInput: input,
    generatedAt,
    actionRecords,
    auditEvents,
    adapter,
  });

  const gate = new TitleTreeCutoverGate();
  const report = titleParityReport({
    clean: replayClean,
    adapterCount: adapter.length,
    replayedCount: replayed.length,
    firstDivergence: replayFirstDivergence,
  });
  if (report.clean) {
    gate.recordPassedParity([report]);
  }
  gate.setMathParityClean(math.clean);
  gate.setLandroidRoundTripClean(landroidRoundTrip.clean);
  const readiness = gate.readiness();

  const pass =
    replayClean &&
    math.clean &&
    landroidRoundTrip.clean &&
    readiness.landroidRoundTripClean === landroidRoundTrip.clean;

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
    landroidRoundTripClean: landroidRoundTrip.clean,
    landroidRoundTripLedgerPresent: landroidRoundTrip.ledgerPresent,
    landroidRoundTripOriginalLedgerClean: landroidRoundTrip.originalLedgerClean,
    landroidRoundTripReplayClean: landroidRoundTrip.replayClean,
    landroidRoundTripMathClean: landroidRoundTrip.mathClean,
    landroidRoundTripImportedActionRecordCount:
      landroidRoundTrip.importedActionRecordCount,
    landroidRoundTripImportedAuditEventCount:
      landroidRoundTrip.importedAuditEventCount,
    landroidRoundTripFirstDivergence: landroidRoundTrip.firstDivergence,
    readiness,
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
    `  [.landroid round trip]: ${ok(report.landroidRoundTripClean)} (ledger ${report.landroidRoundTripLedgerPresent ? 'present' : 'missing'}, imported ${report.landroidRoundTripImportedActionRecordCount} actions / ${report.landroidRoundTripImportedAuditEventCount} audit events)`,
    `  [round-trip replay]   : ${ok(report.landroidRoundTripReplayClean)}${
      report.landroidRoundTripFirstDivergence
        ? ` (first divergence: ${report.landroidRoundTripFirstDivergence})`
        : ''
    }`,
    `  [round-trip ledger]   : ${ok(report.landroidRoundTripOriginalLedgerClean)}`,
    `  [round-trip math]     : ${ok(report.landroidRoundTripMathClean)}`,
    `  [readiness .landroid] : ${ok(report.readiness.landroidRoundTripClean)} (ready: ${report.readiness.ready ? 'YES' : 'NO'}, parities ${report.readiness.passedParities}/${report.readiness.threshold})`,
    `      readiness reason  : ${report.readiness.reason}`,
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
