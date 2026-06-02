import { describe, expect, it } from 'vitest';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import type { RecordBuildContext } from '../record-helpers';
import {
  buildProjectRecordBundle,
  parseProjectRecordBundle,
} from '../record-validation';
import {
  ACTION_LAYER_EXPORT_GATE,
  actionLayerExportInclusion,
  appendActionLayerToRecordBundle,
  assertActionLayerExportAllowed,
  materializeCommandBatch,
  verifyAuditChain,
} from '../action-layer';
import { interestRecord, makeCommand, NOW, upsert } from './action-layer-fixtures';

const context: RecordBuildContext = {
  workspaceId: 'ws-1',
  projectId: 'project-1',
  generatedAt: NOW,
  revision: 0,
  source: 'local',
  syncState: 'local_only',
};

async function durableBatch() {
  return materializeCommandBatch({
    context,
    approvedBy: 'user',
    appliedAt: '2026-06-01T12:30:00.000Z',
    commands: [
      makeCommand({
        commandKind: 'title.create_root_node',
        surface: 'title_tree',
        recordEffects: [upsert(interestRecord('interest-1'))],
      }),
      makeCommand({
        commandKind: 'title.convey',
        surface: 'title_tree',
        recordEffects: [upsert(interestRecord('interest-2', { fraction: '1/4' }))],
      }),
    ],
  });
}

function emptyBundle() {
  return buildProjectRecordBundle({
    workspaceId: 'ws-1',
    projectId: 'project-1',
    generatedAt: NOW,
    records: [],
  });
}

describe('Phase 4 action-layer persistence (additive + version-gated)', () => {
  it('appends action records + audit events additively without mutating the input', async () => {
    const batch = await durableBatch();
    const base = emptyBundle();

    const merged = await appendActionLayerToRecordBundle({
      bundle: base,
      actionRecords: batch.actionRecords,
      auditEvents: batch.auditEvents,
    });

    expect(base.records).toHaveLength(0); // input bundle untouched
    const types = merged.records.map((record) => record.recordType);
    expect(types.filter((type) => type === 'action_record')).toHaveLength(2);
    expect(types.filter((type) => type === 'audit_event')).toHaveLength(2);
  });

  it('survives a serialize/reload round trip with the audit chain intact', async () => {
    const batch = await durableBatch();
    const merged = await appendActionLayerToRecordBundle({
      bundle: emptyBundle(),
      actionRecords: batch.actionRecords,
      auditEvents: batch.auditEvents,
    });

    // reload: full JSON serialize → parse back through the bundle schema
    const reloaded = parseProjectRecordBundle(JSON.parse(JSON.stringify(merged)));
    const reloadedAuditEvents = reloaded.records.filter(
      (record) => record.recordType === 'audit_event'
    );
    expect(reloadedAuditEvents).toHaveLength(2);
    // the hash chain still verifies after persistence + reload
    expect((await verifyAuditChain(reloadedAuditEvents as never)).valid).toBe(true);
  });

  it('refuses to persist a broken audit chain', async () => {
    const batch = await durableBatch();
    const tampered = [...batch.auditEvents];
    tampered[1] = { ...batch.auditEvents[1], eventKind: 'tampered' };

    await expect(
      appendActionLayerToRecordBundle({
        bundle: emptyBundle(),
        actionRecords: batch.actionRecords,
        auditEvents: tampered,
      })
    ).rejects.toThrow(/broken audit chain/);
  });

  it('keeps v8 authoritative and gates record inclusion to a future version', () => {
    expect(ACTION_LAYER_EXPORT_GATE.authoritativeLandroidVersion).toBe(LANDROID_FILE_VERSION);
    expect(ACTION_LAYER_EXPORT_GATE.includedInV8Export).toBe(false);
    expect(ACTION_LAYER_EXPORT_GATE.v8StaysAuthoritative).toBe(true);

    expect(actionLayerExportInclusion(LANDROID_FILE_VERSION)).toBe(false);
    expect(actionLayerExportInclusion(LANDROID_FILE_VERSION + 1)).toBe(true);

    expect(() => assertActionLayerExportAllowed(LANDROID_FILE_VERSION)).toThrow(
      /stays authoritative/
    );
    expect(() => assertActionLayerExportAllowed(LANDROID_FILE_VERSION + 1)).not.toThrow();
  });
});
