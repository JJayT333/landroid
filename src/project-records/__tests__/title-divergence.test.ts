/**
 * Phase 4 title cutover — divergence is a bug, not a warning (guardrail 3). A
 * mutation whose recorded effects do not reproduce the store's after-state is
 * BLOCKED (the recording throws); it is never silently shadowed.
 */
import { describe, expect, it } from 'vitest';
import {
  assertTitleInlineParity,
  buildTitleCommand,
} from '../action-layer/title-command-sourcing';
import {
  diffTitleMutation,
  titleRecordsFromWorkspace,
} from '../action-layer/title-projection';
import { parseActionCommand, type RecordEffect } from '../action-layer/commands';
import { ParityDivergenceError } from '../action-layer/parity';
import {
  emptyTitleWorkspace,
  TITLE_NOW,
  TITLE_WS,
  titleOwnerData,
  titleWorkspace,
} from './title-cutover-fixtures';

function beforeAfter() {
  const adapterBase = {
    ownerData: titleOwnerData(),
    projectId: TITLE_WS,
    generatedAt: TITLE_NOW,
  };
  const beforeRecords = titleRecordsFromWorkspace({
    workspace: emptyTitleWorkspace(),
    ...adapterBase,
  });
  const afterRecords = titleRecordsFromWorkspace({
    workspace: titleWorkspace(),
    ...adapterBase,
  });
  const delta = diffTitleMutation({
    beforeRecords,
    afterRecords,
    beforeNodes: emptyTitleWorkspace().nodes,
    afterNodes: titleWorkspace().nodes,
  });
  return { beforeRecords, afterRecords, delta };
}

describe('Phase 4 title divergence is blocked', () => {
  it('passes inline parity when the command faithfully captures the mutation', () => {
    const { beforeRecords, afterRecords, delta } = beforeAfter();
    const command = buildTitleCommand({
      mutation: 'createRootNode',
      origin: 'system',
      effects: delta.effects,
    });
    expect(() =>
      assertTitleInlineParity({ beforeRecords, afterRecords, command })
    ).not.toThrow();
  });

  it('BLOCKS a command that drops an effect (incomplete capture)', () => {
    const { beforeRecords, afterRecords, delta } = beforeAfter();
    const command = buildTitleCommand({
      mutation: 'createRootNode',
      origin: 'system',
      effects: delta.effects.slice(1), // drop one effect
    });
    expect(() =>
      assertTitleInlineParity({ beforeRecords, afterRecords, command })
    ).toThrow(ParityDivergenceError);
  });

  it('gives identical-effect commands distinct default ids (no ActionRecord collision)', () => {
    const { delta } = beforeAfter();
    const a = buildTitleCommand({ mutation: 'convey', origin: 'system', effects: delta.effects });
    const b = buildTitleCommand({ mutation: 'convey', origin: 'system', effects: delta.effects });
    expect(a.commandId).not.toBe(b.commandId);
    expect(a.commandId).toMatch(
      /^title:convey:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(b.commandId).toMatch(
      /^title:convey:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    // an explicit id is still honored verbatim
    const explicit = buildTitleCommand({
      mutation: 'convey',
      origin: 'system',
      effects: delta.effects,
      commandId: 'op-123',
    });
    expect(explicit.commandId).toBe('op-123');
  });

  it('BLOCKS a command whose effect carries a corrupted record (wrong math)', () => {
    const { beforeRecords, afterRecords, delta } = beforeAfter();
    const corruptedEffects: RecordEffect[] = delta.effects.map((effect) => {
      if (effect.op === 'upsert' && effect.record.recordType === 'interest_reference') {
        return {
          op: 'upsert',
          record: { ...effect.record, fraction: '0.999999999' },
        };
      }
      return effect;
    });
    const command = parseActionCommand({
      commandId: 'corrupt',
      commandKind: 'title.create_root_node',
      surface: 'title_tree',
      origin: 'system',
      summary: 'corrupted',
      recordEffects: corruptedEffects,
    });
    expect(() =>
      assertTitleInlineParity({ beforeRecords, afterRecords, command })
    ).toThrow(ParityDivergenceError);
  });
});
