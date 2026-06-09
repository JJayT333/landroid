import { beforeEach, describe, expect, it } from 'vitest';

import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import { canonicalJson } from '../../project-records/action-layer/canonical-json';
import { recordTitleMutation } from '../../project-records/action-layer/title-command-sourcing';
import { titleRecordsFromWorkspace } from '../../project-records/action-layer/title-projection';
import { replayTitleProjection } from '../../project-records/action-layer/title-replay';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  TITLE_WS,
  titleContext,
  titleOwnerData,
  titleWorkspace,
} from '../../project-records/__tests__/title-cutover-fixtures';
import { selectTitleReadPathInput, useTitleActionLog } from '../title-action-log';

function sortedJson(records: readonly BackendSpineCoreRecord[]): string {
  return canonicalJson(
    [...records].sort((a, b) =>
      a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0
    )
  );
}

beforeEach(() => {
  useTitleActionLog.getState().reset();
});

async function hydrateTitleWorkspaceLedger() {
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
  useTitleActionLog.getState().hydrate({
    actionRecords: [result.actionRecord],
    auditEvents: [result.auditEvent],
  });
}

describe('title read-path flip control', () => {
  it('defaults to shadow', () => {
    expect(useTitleActionLog.getState().readPathMode).toBe('shadow');
    expect(selectTitleReadPathInput().mode).toBe('shadow');
  });

  it('refuses to flip without a reviewer token', () => {
    expect(() =>
      useTitleActionLog.getState().flipToCutover({ reviewerApprovalToken: '  ', ready: true })
    ).toThrow();
    expect(useTitleActionLog.getState().readPathMode).toBe('shadow');
  });

  it('refuses to flip while the readiness gates are not green', () => {
    expect(() =>
      useTitleActionLog
        .getState()
        .flipToCutover({ reviewerApprovalToken: 'reviewer', ready: false })
    ).toThrow(/gates are not green/);
    expect(useTitleActionLog.getState().readPathMode).toBe('shadow');
  });

  it('flips to cutover when ready and reverts on demand', () => {
    useTitleActionLog
      .getState()
      .flipToCutover({ reviewerApprovalToken: 'reviewer', ready: true });
    expect(useTitleActionLog.getState().readPathMode).toBe('cutover');
    expect(selectTitleReadPathInput().mode).toBe('cutover');

    useTitleActionLog.getState().revertReadPathToShadow();
    expect(useTitleActionLog.getState().readPathMode).toBe('shadow');
    expect(selectTitleReadPathInput().mode).toBe('shadow');
  });

  it('resets the read path to shadow on workspace replacement', () => {
    useTitleActionLog
      .getState()
      .flipToCutover({ reviewerApprovalToken: 'reviewer', ready: true });
    expect(useTitleActionLog.getState().readPathMode).toBe('cutover');
    useTitleActionLog.getState().reset();
    expect(useTitleActionLog.getState().readPathMode).toBe('shadow');
  });

  it('delivers ledger records that replay to exactly the adapter projection', async () => {
    await hydrateTitleWorkspaceLedger();
    useTitleActionLog
      .getState()
      .flipToCutover({ reviewerApprovalToken: 'reviewer', ready: true });

    const seam = selectTitleReadPathInput();
    expect(seam.mode).toBe('cutover');
    const replayed = replayTitleProjection(seam.actionRecords);
    const adapter = titleRecordsFromWorkspace({
      workspace: titleWorkspace(),
      ownerData: titleOwnerData(),
      generatedAt: TITLE_NOW,
      projectId: TITLE_WS,
    });
    expect(sortedJson(replayed)).toBe(sortedJson(adapter));
  });
});
