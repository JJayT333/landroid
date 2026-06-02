import { describe, expect, it } from 'vitest';
import {
  ALL_ACTION_COMMAND_KINDS,
  ALL_ACTION_SURFACES,
  parseActionCommand,
  reduceCommandLog,
  SURFACE_BY_COMMAND_KIND,
  surfaceForRecordType,
  type ActionSurface,
} from '../action-layer';
import {
  curativeRecord,
  interestRecord,
  leaseRecord,
  makeCommand,
  partyRecord,
  upsert,
} from './action-layer-fixtures';

describe('Phase 4 typed-command catalog', () => {
  it('maps every command kind to one of the seven mutation surfaces', () => {
    const surfacesSeen = new Set<ActionSurface>();
    for (const kind of ALL_ACTION_COMMAND_KINDS) {
      const surface = SURFACE_BY_COMMAND_KIND[kind];
      expect(ALL_ACTION_SURFACES).toContain(surface);
      surfacesSeen.add(surface);
    }
    // All seven listed surfaces are represented by at least one command kind.
    expect([...surfacesSeen].sort()).toEqual([...ALL_ACTION_SURFACES].sort());
  });

  it('accepts a well-formed command per surface', () => {
    expect(() =>
      makeCommand({
        commandKind: 'owner.create',
        surface: 'owner',
        recordEffects: [upsert(partyRecord())],
      })
    ).not.toThrow();
    expect(() =>
      makeCommand({
        commandKind: 'lease.create',
        surface: 'lease',
        recordEffects: [upsert(leaseRecord())],
      })
    ).not.toThrow();
    expect(() =>
      makeCommand({
        commandKind: 'curative.create',
        surface: 'curative',
        recordEffects: [upsert(curativeRecord())],
      })
    ).not.toThrow();
  });

  it('rejects a surface/kind mismatch', () => {
    expect(() =>
      parseActionCommand({
        commandId: 'cmd-bad',
        commandKind: 'lease.create',
        surface: 'owner',
        origin: 'user',
        summary: 'mismatch',
        recordEffects: [],
      })
    ).toThrow(/belongs to surface/);
  });

  it('requires a gated tool name on ai.proposal and forbids it elsewhere', () => {
    expect(() =>
      parseActionCommand({
        commandId: 'cmd-ai',
        commandKind: 'ai.proposal',
        surface: 'ai_proposal',
        origin: 'ai',
        summary: 'AI proposal without a tool name',
        recordEffects: [],
      })
    ).toThrow(/names no gated aiToolName/);

    expect(() =>
      parseActionCommand({
        commandId: 'cmd-owner-ai',
        commandKind: 'owner.create',
        surface: 'owner',
        origin: 'user',
        summary: 'owner command should not name a tool',
        aiToolName: 'createOwner',
        recordEffects: [upsert(partyRecord())],
      })
    ).toThrow(/not an ai_proposal/);
  });

  it('rejects a record effect whose type is foreign to the command surface', () => {
    expect(() =>
      parseActionCommand({
        commandId: 'cmd-foreign',
        commandKind: 'owner.create',
        surface: 'owner',
        origin: 'user',
        summary: 'owner command carrying a lease record',
        recordEffects: [upsert(leaseRecord())],
      })
    ).toThrow(/cannot carry a "lease" record effect/);
  });

  it('classifies record types into surfaces (structural types are out of scope)', () => {
    expect(surfaceForRecordType('interest_reference')).toBe('title_tree');
    expect(surfaceForRecordType('party')).toBe('owner');
    expect(surfaceForRecordType('source_citation')).toBe('import');
    // structural / derived records are not a Phase 4 mutation surface
    expect(surfaceForRecordType('desk_map')).toBeNull();
    expect(surfaceForRecordType('workspace_manifest')).toBeNull();
  });
});

describe('Phase 4 command reducer (canonical-mutation primitive)', () => {
  it('folds upsert → update → delete into a deterministic record set', () => {
    const created = makeCommand({
      commandKind: 'title.create_root_node',
      surface: 'title_tree',
      recordEffects: [upsert(interestRecord('interest-1', { fraction: '1/2' }))],
    });
    const updated = makeCommand({
      commandKind: 'title.convey',
      surface: 'title_tree',
      recordEffects: [upsert(interestRecord('interest-1', { fraction: '1/4' }))],
    });
    const deleted = makeCommand({
      commandKind: 'title.delete_node',
      surface: 'title_tree',
      recordEffects: [{ op: 'delete', recordType: 'interest_reference', recordId: 'interest-2' }],
    });
    const added = makeCommand({
      commandKind: 'title.convey',
      surface: 'title_tree',
      recordEffects: [upsert(interestRecord('interest-2', { fraction: '1/8' }))],
    });

    // interest-2 is created AFTER it was tombstoned → re-upsert wins.
    const state = reduceCommandLog([created, updated, deleted, added]);

    expect(state.records.map((record) => record.recordId)).toEqual([
      'interest-1',
      'interest-2',
    ]);
    const interest1 = state.recordsById.get('interest-1');
    expect(interest1).toMatchObject({ recordType: 'interest_reference', fraction: '1/4' });
    expect(state.tombstonedIds).toEqual([]);
    expect(state.appliedCommandIds).toEqual([
      created.commandId,
      updated.commandId,
      deleted.commandId,
      added.commandId,
    ]);
  });

  it('keeps a tombstone when a delete is not followed by a re-upsert', () => {
    const created = makeCommand({
      commandKind: 'owner.create',
      surface: 'owner',
      recordEffects: [upsert(partyRecord('party-1'))],
    });
    const removed = makeCommand({
      commandKind: 'owner.update',
      surface: 'owner',
      recordEffects: [{ op: 'delete', recordType: 'party', recordId: 'party-1' }],
    });

    const state = reduceCommandLog([created, removed]);
    expect(state.records).toEqual([]);
    expect(state.tombstonedIds).toEqual(['party-1']);
  });
});
