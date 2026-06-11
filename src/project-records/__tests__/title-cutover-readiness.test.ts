import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  computeTitleParityGates,
  deriveTitleCutoverReadiness,
} from '../action-layer/title-cutover-readiness';
import { MIN_PASSED_TITLE_PARITIES } from '../action-layer/title-cutover-gate';
import {
  checkTitleInlineParity,
  recordTitleMutation,
} from '../action-layer/title-command-sourcing';
import type { RecordBuildContext } from '../record-helpers';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  titleContext,
  titleOwnerData,
  titleWorkspace,
} from './title-cutover-fixtures';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import type { buildMathInputView } from '../projections';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'phase-0');
type DemoOwnerData = NonNullable<Parameters<typeof buildMathInputView>[0]['ownerData']>;
type DemoFixture = WorkspaceData & { ownerData: DemoOwnerData };

/** The Phase 0 demo is a real, import-valid `.landroid`, so its export round-trips. */
function loadDemoWorkspace(): { workspace: WorkspaceData; ownerData: DemoOwnerData } {
  const fixture = JSON.parse(
    readFileSync(join(FIXTURE_DIR, 'demo.landroid'), 'utf8')
  ) as DemoFixture;
  const workspace: WorkspaceData = {
    workspaceId: fixture.workspaceId,
    projectName: fixture.projectName,
    nodes: fixture.nodes,
    deskMaps: fixture.deskMaps,
    leaseholdUnit: fixture.leaseholdUnit,
    leaseholdAssignments: fixture.leaseholdAssignments,
    leaseholdOrris: fixture.leaseholdOrris,
    leaseholdTransferOrderEntries: fixture.leaseholdTransferOrderEntries,
    activeDeskMapId: fixture.activeDeskMapId,
    activeUnitCode: fixture.activeUnitCode,
    instrumentTypes: fixture.instrumentTypes,
  };
  return { workspace, ownerData: fixture.ownerData };
}

function demoContext(workspaceId: string): RecordBuildContext {
  return {
    workspaceId,
    projectId: workspaceId,
    generatedAt: TITLE_NOW,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
  };
}

async function recordDemoLedger() {
  const { workspace, ownerData } = loadDemoWorkspace();
  const before: WorkspaceData = {
    ...workspace,
    nodes: [],
    deskMaps: workspace.deskMaps.map((deskMap) => ({ ...deskMap, nodeIds: [] })),
  };
  const result = await recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'system',
    approvedBy: 'system',
    context: demoContext(workspace.workspaceId),
    appliedAt: TITLE_NOW,
    beforeWorkspace: before,
    afterWorkspace: workspace,
    ownerData,
  });
  return {
    workspace,
    ownerData,
    actionRecords: [result.actionRecord],
    auditEvents: [result.auditEvent],
  };
}

async function recordSyntheticLedger() {
  const result = await recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'system',
    approvedBy: 'system',
    context: titleContext(),
    appliedAt: TITLE_NOW,
    beforeWorkspace: emptyTitleWorkspace(),
    afterWorkspace: titleWorkspace(),
    ownerData: titleOwnerData(),
  });
  return { actionRecords: [result.actionRecord], auditEvents: [result.auditEvent] };
}

describe('deriveTitleCutoverReadiness', () => {
  const green = {
    recordedMutationCount: MIN_PASSED_TITLE_PARITIES,
    mathParityClean: true,
    landroidRoundTripClean: true,
  };

  it('is ready only when every gate input is satisfied', () => {
    expect(deriveTitleCutoverReadiness(green).ready).toBe(true);
  });

  it('is not ready below the parity threshold', () => {
    const readiness = deriveTitleCutoverReadiness({
      ...green,
      recordedMutationCount: MIN_PASSED_TITLE_PARITIES - 1,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toMatch(/Not enough proven mutations/);
  });

  it('is not ready when math parity is dirty', () => {
    const readiness = deriveTitleCutoverReadiness({ ...green, mathParityClean: false });
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toMatch(/Math parity is not clean/);
  });

  it('is not ready when the .landroid round trip is dirty', () => {
    const readiness = deriveTitleCutoverReadiness({
      ...green,
      landroidRoundTripClean: false,
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toMatch(/round trip is not clean/);
  });

  it('is not ready while a runtime divergence is active', () => {
    const readiness = deriveTitleCutoverReadiness({
      ...green,
      runtimeDivergenceMessage: 'createRootNode: parity diverged',
    });
    expect(readiness.ready).toBe(false);
    expect(readiness.runtimeDivergence).toBe(true);
  });
});

describe('checkTitleInlineParity (synchronous cutover guard)', () => {
  it('is clean for a faithful mutation (empty -> populated title)', () => {
    const result = checkTitleInlineParity({
      mutation: 'createRootNode',
      origin: 'system',
      beforeWorkspace: emptyTitleWorkspace(),
      afterWorkspace: titleWorkspace(),
      ownerData: titleOwnerData(),
    });
    expect(result.clean).toBe(true);
    expect(result.reports.every((report) => report.clean)).toBe(true);
  });

  it('is clean for a no-op (identical before/after)', () => {
    const result = checkTitleInlineParity({
      mutation: 'update',
      origin: 'user',
      beforeWorkspace: titleWorkspace(),
      afterWorkspace: titleWorkspace(),
      ownerData: titleOwnerData(),
    });
    expect(result.clean).toBe(true);
  });
});

describe('computeTitleParityGates', () => {
  it('reports both gates clean when the ledger reproduces the live workspace', async () => {
    const demo = await recordDemoLedger();
    const gates = await computeTitleParityGates({
      liveWorkspace: demo.workspace,
      ownerData: demo.ownerData,
      actionRecords: demo.actionRecords,
      auditEvents: demo.auditEvents,
      generatedAt: TITLE_NOW,
    });
    expect(gates).toEqual({ mathParityClean: true, landroidRoundTripClean: true });
  });

  it('reports both gates clean when computed later than the recorded mutations', async () => {
    // Production reality: the banner recomputes the gates long after the
    // ledger entries were written, so the adapter envelope's lastModified
    // (stamped with generatedAt) never equals the replayed records'
    // mutation-time stamps. The gate must certify content, not clock
    // agreement — with a pinned generatedAt === TITLE_NOW this regression is
    // invisible, which is how it shipped red-forever.
    const demo = await recordDemoLedger();
    const agedGeneratedAt = new Date(
      new Date(TITLE_NOW).getTime() + 90 * 24 * 60 * 60 * 1000
    ).toISOString();
    const gates = await computeTitleParityGates({
      liveWorkspace: demo.workspace,
      ownerData: demo.ownerData,
      actionRecords: demo.actionRecords,
      auditEvents: demo.auditEvents,
      generatedAt: agedGeneratedAt,
    });
    expect(gates).toEqual({ mathParityClean: true, landroidRoundTripClean: true });
  });

  it('still reports not clean for content drift under an aged clock', async () => {
    // Guard on the lastModified exclusion: a single content field drifting
    // between ledger and live workspace must keep the round trip red even
    // when timestamps are (correctly) ignored.
    const demo = await recordDemoLedger();
    const [first, ...rest] = demo.workspace.nodes;
    const drifted: WorkspaceData = {
      ...demo.workspace,
      nodes: [{ ...first, grantee: `${first.grantee ?? ''} (drifted)` }, ...rest],
    };
    const agedGeneratedAt = new Date(
      new Date(TITLE_NOW).getTime() + 90 * 24 * 60 * 60 * 1000
    ).toISOString();
    const gates = await computeTitleParityGates({
      liveWorkspace: drifted,
      ownerData: demo.ownerData,
      actionRecords: demo.actionRecords,
      auditEvents: demo.auditEvents,
      generatedAt: agedGeneratedAt,
    });
    expect(gates.landroidRoundTripClean).toBe(false);
  });

  it('reports not clean when the ledger does not match the live workspace', async () => {
    const { workspace, ownerData } = loadDemoWorkspace();
    // A ledger built from a different (synthetic) title fails both the math
    // comparison and the round-trip replay against the live demo workspace.
    const foreign = await recordSyntheticLedger();
    const gates = await computeTitleParityGates({
      liveWorkspace: workspace,
      ownerData,
      actionRecords: foreign.actionRecords,
      auditEvents: foreign.auditEvents,
      generatedAt: TITLE_NOW,
    });
    expect(gates.mathParityClean).toBe(false);
    expect(gates.landroidRoundTripClean).toBe(false);
  });

  it('reports not clean for an empty ledger', async () => {
    const { workspace, ownerData } = loadDemoWorkspace();
    const gates = await computeTitleParityGates({
      liveWorkspace: workspace,
      ownerData,
      actionRecords: [],
      auditEvents: [],
      generatedAt: TITLE_NOW,
    });
    expect(gates).toEqual({ mathParityClean: false, landroidRoundTripClean: false });
  });
});
