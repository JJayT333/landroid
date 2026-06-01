/**
 * Phase 4 title cutover — MathInputView parity gate (item 5). The math computed
 * from the action-derived node set must equal the live store AND the Phase 0
 * goldens (decimal/fraction, lease allocation order, warning-only states,
 * jurisdiction isolation). No flip is proposable until this is green.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMathInputView } from '../projections';
import { recordTitleMutation } from '../action-layer/title-command-sourcing';
import {
  assertTitleMathParity,
  buildActionDerivedMathInputView,
  runTitleMathParity,
} from '../action-layer/title-math-parity';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  TITLE_WS,
  titleContext,
  titleOwnerData,
  titleWorkspace,
} from './title-cutover-fixtures';
import type { WorkspaceData } from '../../storage/workspace-persistence';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'phase-0');
const NOW = '2026-06-01T12:00:00.000Z';

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, name), 'utf8')) as T;
}

describe('Phase 4 title MathInputView parity — synthetic', () => {
  it('action-derived MathInputView equals the live store MathInputView', async () => {
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

    const parity = runTitleMathParity({
      liveWorkspace: titleWorkspace(),
      records: [result.actionRecord],
      ownerData: titleOwnerData(),
      generatedAt: TITLE_NOW,
      projectId: TITLE_WS,
    });
    expect(parity.clean).toBe(true);
    expect(parity.divergentKeys).toEqual([]);
    expect(() =>
      assertTitleMathParity({
        liveWorkspace: titleWorkspace(),
        records: [result.actionRecord],
        ownerData: titleOwnerData(),
        generatedAt: TITLE_NOW,
        projectId: TITLE_WS,
      })
    ).not.toThrow();
  });
});

describe('Phase 4 title MathInputView parity — Phase 0 goldens (Vulcan Mesa)', () => {
  type DemoOwnerData = NonNullable<Parameters<typeof buildMathInputView>[0]['ownerData']>;
  type DemoFixture = WorkspaceData & { ownerData: DemoOwnerData };

  function loadDemoWorkspace(): { workspace: WorkspaceData; ownerData: DemoOwnerData } {
    const fixture = readJson<DemoFixture>('demo.landroid');
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

  it('reconstructs the demo nodes and matches live + frozen leasehold goldens', async () => {
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
      context: {
        workspaceId: workspace.workspaceId,
        projectId: workspace.workspaceId,
        generatedAt: NOW,
        revision: 0,
        source: 'local',
        syncState: 'local_only',
      },
      appliedAt: NOW,
      beforeWorkspace: before,
      afterWorkspace: workspace,
      ownerData,
    });

    // (1) action-derived MathInputView == live MathInputView (covers
    //     jurisdiction isolation + warning-only states + nodeDisplays).
    const parity = runTitleMathParity({
      liveWorkspace: workspace,
      records: [result.actionRecord],
      ownerData,
      generatedAt: NOW,
      projectId: workspace.workspaceId,
    });
    expect(parity.divergentKeys).toEqual([]);
    expect(parity.clean).toBe(true);
    expect(parity.liveView.preconditions.jurisdictionIsolation.status).toBe('passed');

    // (2) action-derived decimal/fraction + lease allocation order == frozen
    //     Phase 0 goldens (all demo leases are tx_fee, so the MathInputView
    //     Texas filter keeps the same set the golden was frozen with).
    const golden = readJson<{
      unitRows: unknown;
      transferOrderReview: unknown;
    }>('demo.leasehold-decimals.json');
    const actionView = buildActionDerivedMathInputView({
      liveWorkspace: workspace,
      records: [result.actionRecord],
      ownerData,
      generatedAt: NOW,
      projectId: workspace.workspaceId,
    });
    expect(actionView.decimalRows).toEqual(golden.unitRows);
    expect(actionView.transferOrderReview).toEqual(golden.transferOrderReview);
  });

  it('detects when an action-derived node diverges from the live math (teeth)', async () => {
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
      context: {
        workspaceId: workspace.workspaceId,
        projectId: workspace.workspaceId,
        generatedAt: NOW,
        revision: 0,
        source: 'local',
        syncState: 'local_only',
      },
      appliedAt: NOW,
      beforeWorkspace: before,
      afterWorkspace: workspace,
      ownerData,
    });

    // Mutate the LIVE workspace fractions so the action-derived (frozen) nodes
    // no longer match: parity must flag a divergence rather than pass silently.
    const tamperedLive: WorkspaceData = {
      ...workspace,
      nodes: workspace.nodes.map((node, index) =>
        index === 0 ? { ...node, fraction: '0.123456789' } : node
      ),
    };
    const parity = runTitleMathParity({
      liveWorkspace: tamperedLive,
      records: [result.actionRecord],
      ownerData,
      generatedAt: NOW,
      projectId: workspace.workspaceId,
    });
    expect(parity.clean).toBe(false);
  });
});
