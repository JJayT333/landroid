/**
 * Phase 4 title cutover — flag-gated read path (item 4). Default shadow; the flip
 * is one reversible flag; the action-derived projection equals the store
 * projection while parity holds. No app call site flips this.
 */
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../action-layer/canonical-json';
import { recordTitleMutation } from '../action-layer/title-command-sourcing';
import { titleRecordsFromWorkspace } from '../action-layer/title-projection';
import {
  DEFAULT_TITLE_READ_PATH_MODE,
  selectTitleProjection,
  TitleReadPathFlag,
  TitleReadFlipDisabledError,
} from '../action-layer/title-read-path';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  TITLE_WS,
  titleContext,
  titleOwnerData,
  titleWorkspace,
} from './title-cutover-fixtures';
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';

function sortedJson(records: readonly BackendSpineCoreRecord[]): string {
  return canonicalJson(
    [...records].sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
  );
}

async function setup() {
  const storeTitleRecords = titleRecordsFromWorkspace({
    workspace: titleWorkspace(),
    ownerData: titleOwnerData(),
    projectId: TITLE_WS,
    generatedAt: TITLE_NOW,
  });
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
  return { storeTitleRecords, actionRecords: [result.actionRecord] };
}

describe('Phase 4 title read path', () => {
  it('defaults to the shadow (store) read path', () => {
    expect(DEFAULT_TITLE_READ_PATH_MODE).toBe('shadow');
    expect(new TitleReadPathFlag().getMode()).toBe('shadow');
    expect(new TitleReadPathFlag().isCutover()).toBe(false);
  });

  it('shadow returns the store projection; cutover returns the action projection', async () => {
    const { storeTitleRecords, actionRecords } = await setup();

    const shadow = selectTitleProjection({ mode: 'shadow', storeTitleRecords, actionRecords });
    expect(sortedJson(shadow)).toBe(sortedJson(storeTitleRecords));

    const cutover = selectTitleProjection({ mode: 'cutover', storeTitleRecords, actionRecords });
    // While parity holds, the action-derived projection equals the store's.
    expect(sortedJson(cutover)).toBe(sortedJson(storeTitleRecords));
  });

  it('keeps cutover disabled by default', async () => {
    const { storeTitleRecords, actionRecords } = await setup();
    const flag = new TitleReadPathFlag();

    expect(() =>
      flag.cutOver({ reviewerApprovalToken: 'reviewer-ok' })
    ).toThrow(TitleReadFlipDisabledError);
    expect(flag.getMode()).toBe('shadow');
    expect(sortedJson(flag.select({ storeTitleRecords, actionRecords }))).toBe(
      sortedJson(storeTitleRecords)
    );
  });

  it('is one reversible governed flag: flip to cutover, then revert to shadow', async () => {
    const { storeTitleRecords, actionRecords } = await setup();
    const flag = new TitleReadPathFlag('shadow', { cutoverEnabled: true });

    // shadow
    expect(sortedJson(flag.select({ storeTitleRecords, actionRecords }))).toBe(
      sortedJson(storeTitleRecords)
    );

    // flip → cutover (reviewer action; identical content while in parity)
    flag.cutOver({ reviewerApprovalToken: 'reviewer-ok' });
    expect(flag.isCutover()).toBe(true);
    const cutoverProjection = flag.select({ storeTitleRecords, actionRecords });
    expect(sortedJson(cutoverProjection)).toBe(sortedJson(storeTitleRecords));

    // revert → shadow (the flip is fully reversible)
    flag.revertToShadow();
    expect(flag.getMode()).toBe('shadow');
    expect(sortedJson(flag.select({ storeTitleRecords, actionRecords }))).toBe(
      sortedJson(storeTitleRecords)
    );
  });
});
