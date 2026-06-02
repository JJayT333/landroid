import { describe, expect, it } from 'vitest';
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import { createBlankNode, type DeskMap } from '../../types/node';
import { createBlankLease, createBlankOwner } from '../../types/owner';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import { LANDROID_FILE_VERSION } from '../../storage/landroid-file-version';
import { buildProjectRecordsFromWorkspace } from '../workspace-record-adapter';
import {
  assertParityClean,
  diffRecordSets,
  encodeSurfaceRecordsAsCommandLog,
  isParityClean,
  parseActionCommand,
  partitionRecordsBySurface,
  ParityDivergenceError,
  reduceCommandLog,
  runSurfaceParity,
  runWorkflowParity,
  SURFACE_RECORD_TYPES,
} from '../action-layer';
import { NOW } from './action-layer-fixtures';

const HASH = 'b'.repeat(64);

function workspaceFixture(): WorkspaceData {
  const node = {
    ...createBlankNode('node-1'),
    grantor: 'State of Texas',
    grantee: 'A Owner',
    instrument: 'Patent',
    docNo: 'P-1',
    fraction: '0.5',
    initialFraction: '0.5',
    linkedOwnerId: 'owner-1',
    attachments: [
      { docId: 'doc-1', attachmentId: 'att-1', fileName: 'patent.pdf', kind: 'deed' as const },
    ],
  };
  const deskMap: DeskMap = {
    id: 'dm-1',
    name: 'Tract 1',
    code: 'T1',
    tractId: 'tract-1',
    grossAcres: '100',
    pooledAcres: '100',
    description: 'Test tract',
    nodeIds: ['node-1'],
  };
  return {
    workspaceId: 'ws-1',
    projectName: 'Parity Fixture',
    nodes: [node],
    deskMaps: [deskMap],
    leaseholdUnit: {
      name: 'Test Unit',
      description: '',
      operator: 'Operator A',
      effectiveDate: '2026-01-01',
      jurisdiction: 'tx_fee',
    },
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: ['Patent'],
  };
}

function adapterRecords(): BackendSpineCoreRecord[] {
  const owner = createBlankOwner('ws-1', {
    id: 'owner-1',
    name: 'A Owner',
    entityType: 'Individual',
    createdAt: NOW,
    updatedAt: NOW,
  });
  const lease = createBlankLease('ws-1', owner.id, {
    id: 'lease-1',
    leaseName: 'A Lease',
    lessee: 'Operator A',
    royaltyRate: '1/8',
    leasedInterest: '1/2',
    effectiveDate: '2026-01-01',
    jurisdiction: 'tx_fee',
    createdAt: NOW,
    updatedAt: NOW,
  });
  return buildProjectRecordsFromWorkspace({
    workspace: workspaceFixture(),
    ownerData: { owners: [owner], leases: [lease] },
    documentData: {
      documents: [
        {
          docId: 'doc-1',
          workspaceId: 'ws-1',
          fileName: 'patent.pdf',
          mimeType: 'application/pdf',
          byteLength: 12,
          contentHash: HASH,
          blob: new Blob(['fixture'], { type: 'application/pdf' }),
          kind: 'deed',
          displayTitle: 'Patent',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      attachments: [
        {
          attachmentId: 'att-1',
          workspaceId: 'ws-1',
          docId: 'doc-1',
          entityKind: 'node',
          entityId: 'node-1',
          position: 0,
          createdAt: NOW,
        },
      ],
    },
    curativeData: {
      titleIssues: [
        {
          id: 'issue-1',
          workspaceId: 'ws-1',
          title: 'Missing probate',
          issueType: 'Probate / heirship',
          priority: 'High',
          status: 'Open',
          affectedDeskMapId: 'dm-1',
          affectedNodeId: 'node-1',
          affectedOwnerId: owner.id,
          affectedLeaseId: null,
          sourceDocNo: 'P-1',
          requiredCurativeAction: 'Find probate',
          responsibleParty: '',
          dueDate: '2026-06-30',
          notes: '',
          resolutionNotes: '',
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
    },
    generatedAt: NOW,
    projectId: 'project-1',
    landroidFileVersion: LANDROID_FILE_VERSION,
    syncState: 'local_only',
  }).records;
}

describe('Phase 4 per-workflow parity harness', () => {
  it('is clean across every mutation surface against current store output', () => {
    const records = adapterRecords();
    const reports = runWorkflowParity({ currentStoreRecords: records });

    expect(isParityClean(reports)).toBe(true);
    expect(() => assertParityClean(reports)).not.toThrow();

    // surfaces backed by the fixture actually carried records (not vacuously empty)
    const byWorkflow = new Map(reports.map((report) => [report.workflow, report]));
    for (const surface of ['title_tree', 'document', 'owner', 'lease', 'curative'] as const) {
      expect(byWorkflow.get(surface)?.expectedCount).toBeGreaterThan(0);
      expect(byWorkflow.get(surface)?.derivedCount).toBe(byWorkflow.get(surface)?.expectedCount);
    }
  });

  it('partitions every record into a surface or the structural remainder (no loss)', () => {
    const records = adapterRecords();
    const partition = partitionRecordsBySurface(records);

    const surfaceTotal = Object.values(partition.bySurface).reduce(
      (sum, bucket) => sum + bucket.length,
      0
    );
    expect(surfaceTotal + partition.structural.length).toBe(records.length);

    // structural/derived records are correctly held out of the command surfaces
    expect(partition.structuralTypes.sort()).toEqual(
      ['desk_map', 'project', 'tract', 'unit', 'workspace_manifest'].sort()
    );
  });

  it('detects a changed record (harness has teeth)', () => {
    const records = adapterRecords();
    const expected = records.filter((record) =>
      SURFACE_RECORD_TYPES.owner.includes(record.recordType)
    );
    const commands = encodeSurfaceRecordsAsCommandLog('owner', expected);
    // corrupt one command's record: flip the party display name
    const corrupted = commands.map((command, index) => {
      if (index !== 0) return command;
      const effect = command.recordEffects[0];
      if (effect.op !== 'upsert') return command;
      return parseActionCommand({
        ...command,
        recordEffects: [
          { op: 'upsert', record: { ...effect.record, displayName: 'WRONG NAME' } },
        ],
      });
    });
    const derived = reduceCommandLog(corrupted).records;
    const divergences = diffRecordSets(expected, derived);
    expect(divergences.map((d) => d.kind)).toContain('changed_record');
  });

  it('detects a missing record (dropped command)', () => {
    const records = adapterRecords();
    const expected = records.filter((record) =>
      SURFACE_RECORD_TYPES.lease.includes(record.recordType)
    );
    const commands = encodeSurfaceRecordsAsCommandLog('lease', expected);
    const derived = reduceCommandLog(commands.slice(1)).records; // drop first
    const divergences = diffRecordSets(expected, derived);
    expect(divergences.some((d) => d.kind === 'missing_record')).toBe(true);
  });

  it('detects an extra record (injected command)', () => {
    const records = adapterRecords();
    const expected = records.filter((record) =>
      SURFACE_RECORD_TYPES.curative.includes(record.recordType)
    );
    const commands = encodeSurfaceRecordsAsCommandLog('curative', expected);
    const injected = parseActionCommand({
      commandId: 'curative:injected',
      commandKind: 'curative.create',
      surface: 'curative',
      origin: 'system',
      summary: 'injected curative',
      recordEffects: [
        {
          op: 'upsert',
          record: {
            ...expected[0],
            recordId: 'curative-injected',
            issueId: 'curative-injected',
          },
        },
      ],
    });
    const derived = reduceCommandLog([...commands, injected]).records;
    const report = diffRecordSets(expected, derived);
    expect(report.some((d) => d.kind === 'extra_record' && d.recordId === 'curative-injected')).toBe(
      true
    );
  });

  it('assertParityClean throws a ParityDivergenceError listing the divergence', () => {
    const records = adapterRecords();
    const dirtyReport = runSurfaceParity({
      surface: 'owner',
      currentStoreRecords: records,
    });
    // force a divergence into the report and assert the guard throws
    dirtyReport.clean = false;
    dirtyReport.divergences.push({
      kind: 'changed_record',
      recordId: 'party-x',
      recordType: 'party',
      detail: 'synthetic',
    });
    expect(() => assertParityClean([dirtyReport])).toThrow(ParityDivergenceError);
  });
});
