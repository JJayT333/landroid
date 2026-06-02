/**
 * Phase 4 title cutover — replay self-sufficiency (item 1): the durable record
 * effects replay to exactly the adapter projection, and the node snapshots
 * reconstruct the math node set. Synthetic fixtures only.
 */
import { describe, expect, it } from 'vitest';
import { normalizeOwnershipNode } from '../../types/node';
import { canonicalJson } from '../action-layer/canonical-json';
import { recordTitleMutation } from '../action-layer/title-command-sourcing';
import {
  InvalidTitleActionReplayError,
  parseTitleActions,
  reconstructTitleNodes,
  replayTitleProjection,
} from '../action-layer/title-replay';
import { titleRecordsFromWorkspace } from '../action-layer/title-projection';
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

async function buildLogFromEmpty() {
  return recordTitleMutation({
    mutation: 'createRootNode',
    origin: 'system',
    approvedBy: 'system',
    context: titleContext(),
    appliedAt: TITLE_NOW,
    beforeWorkspace: emptyTitleWorkspace(),
    afterWorkspace: titleWorkspace(),
    ownerData: titleOwnerData(),
  });
}

describe('Phase 4 title replay (replay == adapter)', () => {
  it('replays the persisted effects to exactly the adapter title projection', async () => {
    const result = await buildLogFromEmpty();
    const adapterTitleRecords = titleRecordsFromWorkspace({
      workspace: titleWorkspace(),
      ownerData: titleOwnerData(),
      projectId: TITLE_WS,
      generatedAt: TITLE_NOW,
    });

    const replayed = replayTitleProjection([result.actionRecord]);
    expect(sortedJson(replayed)).toBe(sortedJson(adapterTitleRecords));
    // 4 nodes → instrument + interest each
    expect(replayed).toHaveLength(8);
  });

  it('reconstructs the math node set from the node snapshots', async () => {
    const result = await buildLogFromEmpty();
    const reconstructed = reconstructTitleNodes([result.actionRecord]);
    const expected = titleWorkspace().nodes.map((node) => normalizeOwnershipNode(node));

    const byId = (nodes: typeof expected) =>
      canonicalJson([...nodes].sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(byId(reconstructed)).toBe(byId(expected));
    // math-relevant fields survive the round trip
    const npri = reconstructed.find((n) => n.id === 'npri');
    expect(npri?.royaltyKind).toBe('floating');
    expect(reconstructed.find((n) => n.id === 'root')?.linkedOwnerId).toBe('owner-1');
    expect(reconstructed.find((n) => n.id === 'leasenode-1')?.type).toBe('related');
  });

  it('parseTitleActions skips non-title and undone action records', async () => {
    const result = await buildLogFromEmpty();
    const undone = { ...result.actionRecord, status: 'undone' as const };
    const importAction = {
      ...result.actionRecord,
      recordId: 'other-action',
      actionKind: 'import.apply_candidate',
    };
    const parsed = parseTitleActions([result.actionRecord, undone, importAction]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].actionRecord.recordId).toBe(result.actionRecord.recordId);
  });

  it('fails closed when an active title action is missing its full-effect payload', async () => {
    const result = await buildLogFromEmpty();
    const missingFullEffect = {
      ...result.actionRecord,
      recordId: 'bad-title-action-missing-full-effect',
      result: {
        ...result.actionRecord.result,
        titleNodeSnapshots: undefined,
      },
    } satisfies BackendSpineCoreRecord;
    const malformedResult = {
      ...result.actionRecord,
      recordId: 'bad-title-action-malformed-effect',
      result: {
        ...result.actionRecord.result,
        recordEffects: 'not-an-effect-array',
      },
    } satisfies BackendSpineCoreRecord;

    expect(() => parseTitleActions([result.actionRecord, missingFullEffect, malformedResult]))
      .toThrow(InvalidTitleActionReplayError);
    expect(() => parseTitleActions([result.actionRecord, missingFullEffect, malformedResult]))
      .toThrow('bad-title-action-missing-full-effect');
    expect(() => parseTitleActions([result.actionRecord, missingFullEffect, malformedResult]))
      .toThrow('bad-title-action-malformed-effect');

    expect(() => replayTitleProjection([missingFullEffect])).toThrow(
      InvalidTitleActionReplayError
    );
    expect(() => reconstructTitleNodes([malformedResult])).toThrow(
      InvalidTitleActionReplayError
    );
  });
});
