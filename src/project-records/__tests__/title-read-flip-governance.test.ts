/**
 * T3 read-flip governance. Synthetic fixtures only.
 *
 * Production stays default-off; this proves the existing read flip can be
 * enabled under explicit test governance only after the round-trip/parity gates
 * are clean, then reverted to shadow.
 */
import { describe, expect, it } from 'vitest';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import {
  exportLandroidFile,
  importLandroidFile,
} from '../../storage/workspace-persistence';
import { canonicalJson } from '../action-layer/canonical-json';
import { CutoverRegistry } from '../action-layer/cutover';
import { recordTitleMutation } from '../action-layer/title-command-sourcing';
import { TitleTreeCutoverGate } from '../action-layer/title-cutover-gate';
import { runTitleMathParity } from '../action-layer/title-math-parity';
import { selectTitleProjection, TitleReadPathFlag } from '../action-layer/title-read-path';
import { titleRecordsFromWorkspace } from '../action-layer/title-projection';
import { replayTitleProjection } from '../action-layer/title-replay';
import type {
  ActionRecord,
  AuditEventRecord,
  BackendSpineCoreRecord,
} from '../../backend-spine/contracts';
import type { ParityReport } from '../action-layer/parity';
import { createBlankNode, normalizeOwnershipNode } from '../../types/node';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import {
  TITLE_NOW,
  TITLE_WS,
  titleContext,
  titleOwnerData,
} from './title-cutover-fixtures';

function domainJson(records: readonly BackendSpineCoreRecord[]): string {
  return canonicalJson(
    records
      .map((record) => ({ ...record, lastModified: '<normalized>' }))
      .sort((a, b) =>
        a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0
      )
  );
}

const cleanReport: ParityReport = {
  workflow: 'title_tree',
  clean: true,
  expectedCount: 2,
  derivedCount: 2,
  divergences: [],
};

function validRoundTripWorkspace(): WorkspaceData {
  const root = normalizeOwnershipNode({
    ...createBlankNode('root'),
    grantor: 'State of Texas',
    grantee: 'Acme Minerals LLC',
    instrument: 'Patent',
    docNo: 'P-1',
    fraction: '1.000000000',
    initialFraction: '1.000000000',
    interestClass: 'mineral',
    linkedOwnerId: 'owner-1',
  });
  return {
    workspaceId: TITLE_WS,
    projectName: 'Title Read Flip Governance',
    nodes: [root],
    deskMaps: [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: 'tract-1',
        grossAcres: '100',
        pooledAcres: '100',
        description: 'Synthetic tract',
        nodeIds: [root.id],
      },
    ],
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: ['Patent'],
  };
}

function emptyRoundTripWorkspace(): WorkspaceData {
  const workspace = validRoundTripWorkspace();
  return {
    ...workspace,
    nodes: [],
    deskMaps: workspace.deskMaps.map((deskMap) => ({ ...deskMap, nodeIds: [] })),
  };
}

async function buildLedger(workspace: WorkspaceData): Promise<{
  actionRecord: ActionRecord;
  auditEvent: AuditEventRecord;
}> {
  const result = await recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'system',
    approvedBy: 'system',
    context: titleContext(),
    appliedAt: TITLE_NOW,
    beforeWorkspace: emptyRoundTripWorkspace(),
    afterWorkspace: workspace,
    ownerData: titleOwnerData(),
  });
  return {
    actionRecord: result.actionRecord,
    auditEvent: result.auditEvent,
  };
}

describe('T3 title read-flip governance', () => {
  it('proves export-import-replay before allowing test-only cutover and shadow revert', async () => {
    const workspace = validRoundTripWorkspace();
    const ownerData = titleOwnerData();
    const storeTitleRecords = titleRecordsFromWorkspace({
      workspace,
      ownerData,
      projectId: TITLE_WS,
      generatedAt: TITLE_NOW,
    });
    const { actionRecord, auditEvent } = await buildLedger(workspace);
    const blob = await exportLandroidFile(
      {
        ...workspace,
        ownerData: { ...ownerData, contacts: [], docs: [] },
      },
      {
        actionRecords: [actionRecord],
        auditEvents: [auditEvent],
      }
    );
    const imported = await importLandroidFile(
      new File([await blob.text()], 'title-read-flip-governance.landroid', {
        type: 'application/json',
      })
    );
    expect(LANDROID_FILE_VERSION).toBe(9);
    expect(imported.actionLedger).toBeDefined();
    const importedActionRecords = imported.actionLedger!.records.filter(
      (record): record is ActionRecord => record.recordType === 'action_record'
    );

    expect(domainJson(replayTitleProjection(importedActionRecords))).toBe(
      domainJson(storeTitleRecords)
    );
    expect(
      runTitleMathParity({
        liveWorkspace: workspace,
        records: importedActionRecords,
        ownerData,
        projectId: TITLE_WS,
        generatedAt: TITLE_NOW,
      }).clean
    ).toBe(true);

    const gate = new TitleTreeCutoverGate(
      new CutoverRegistry({ liveCutoverEnabled: true }),
      1
    );
    gate.recordPassedParity([cleanReport]);
    gate.setMathParityClean(true);
    gate.setLandroidRoundTripClean(true);
    gate.proposeCandidate(cleanReport);
    gate.cutOver({ reviewerApprovalToken: 'reviewer-ok' });
    expect(gate.getState()).toBe('cutover');

    const flag = new TitleReadPathFlag('shadow', { cutoverEnabled: true });
    flag.cutOver({ reviewerApprovalToken: 'reviewer-ok' });
    const cutoverRecords = selectTitleProjection({
      mode: flag.getMode(),
      storeTitleRecords,
      actionRecords: importedActionRecords,
    });
    expect(domainJson(cutoverRecords)).toBe(domainJson(storeTitleRecords));

    flag.revertToShadow();
    gate.revertToShadow();
    expect(flag.getMode()).toBe('shadow');
    expect(gate.getState()).toBe('shadow');
    expect(
      domainJson(
        flag.select({
          storeTitleRecords,
          actionRecords: importedActionRecords,
        })
      )
    ).toBe(domainJson(storeTitleRecords));
  });
});
