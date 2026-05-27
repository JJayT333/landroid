import { describe, expect, it } from 'vitest';
import { createBlankNode, type DeskMap } from '../../types/node';
import { LANDROID_FILE_VERSION, type WorkspaceData } from '../workspace-persistence';
import {
  migrateWorkspaceRecordToShards,
  restoreWorkspaceRecordFromShards,
} from '../workspace-shard-migration';
import {
  buildWorkspaceShards,
  restoreWorkspaceDataFromShards,
  WORKSPACE_SHARD_STORE_DEFINITIONS,
} from '../workspace-shards';

const LAST_MODIFIED = '2026-05-27T00:00:00.000Z';

function buildWorkspace(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  const root = {
    ...createBlankNode('node-root'),
    instrument: 'Warranty Deed',
    grantor: 'Pat Doe',
    grantee: 'Acme Minerals LLC',
    fraction: '1',
    initialFraction: '1',
    attachments: [
      {
        docId: 'doc-1',
        attachmentId: 'att-1',
        fileName: 'deed.pdf',
        kind: 'deed' as const,
      },
    ],
  };
  const child = {
    ...createBlankNode('node-child', 'node-root'),
    instrument: 'Mineral Deed',
    grantor: 'Acme Minerals LLC',
    grantee: 'Unit Partner LLC',
    fraction: '0.5',
    initialFraction: '0.5',
  };
  const deskMaps: DeskMap[] = [
    {
      id: 'dm-a',
      name: 'North Unit',
      code: 'A',
      tractId: 'T-1',
      grossAcres: '160',
      pooledAcres: '120',
      description: 'North half',
      nodeIds: ['node-root', 'node-child'],
      unitName: 'Raven Bend',
      unitCode: 'A',
    },
    {
      id: 'dm-b',
      name: 'South Unit',
      code: 'B',
      tractId: 'T-2',
      grossAcres: '80',
      pooledAcres: '80',
      description: 'South half',
      nodeIds: ['node-root'],
      unitName: 'Raven Bend',
      unitCode: 'B',
    },
  ];

  return {
    workspaceId: 'ws-1',
    projectName: 'Shard Fixture',
    nodes: [root, child],
    deskMaps,
    leaseholdUnit: {
      name: 'Raven Bend Unit',
      description: 'Two tract unit',
      operator: 'Operator A',
      effectiveDate: '2026-01-01',
      jurisdiction: 'tx_fee',
    },
    leaseholdAssignments: [
      {
        id: 'asg-1',
        assignor: 'Operator A',
        assignee: 'Unit Partner LLC',
        scope: 'unit',
        unitCode: 'A',
        deskMapId: null,
        workingInterestFraction: '1/2',
        effectiveDate: '2026-02-01',
        sourceDocNo: 'ASG-1',
        notes: 'Starter WI',
        depthRange: 'all_depths',
      },
    ],
    leaseholdOrris: [
      {
        id: 'orri-1',
        payee: 'Override Partners',
        scope: 'tract',
        unitCode: null,
        deskMapId: 'dm-a',
        burdenFraction: '1/32',
        burdenBasis: 'gross_8_8',
        effectiveDate: '2026-02-15',
        sourceDocNo: 'ORRI-1',
        notes: 'Starter ORRI',
        depthRange: 'all_depths',
      },
    ],
    leaseholdTransferOrderEntries: [
      {
        id: 'to-1',
        sourceRowId: 'royalty-dm-a-node-root',
        ownerNumber: '001',
        status: 'ready',
        notes: 'Ready',
      },
    ],
    activeDeskMapId: 'dm-a',
    activeUnitCode: 'A',
    instrumentTypes: ['Deed', 'Assignment'],
    ...overrides,
  };
}

describe('workspace-shards', () => {
  it('builds backend-spine envelope rows for manifest and Desk Maps only', () => {
    const shards = buildWorkspaceShards(buildWorkspace(), {
      lastModified: LAST_MODIFIED,
      landroidFileVersion: LANDROID_FILE_VERSION,
      source: 'migration',
      syncState: 'local_only',
      legacyWorkspaceDataJson: '{"workspaceId":"ws-1"}',
    });

    expect(shards.manifest.backendRecord).toMatchObject({
      recordId: 'ws-1:workspace-manifest',
      recordType: 'workspace_manifest',
      workspaceId: 'ws-1',
      projectId: 'ws-1',
      schemaVersion: 1,
      revision: 0,
      source: 'migration',
      syncState: 'local_only',
      landroidFileVersion: LANDROID_FILE_VERSION,
      projectName: 'Shard Fixture',
      generatedAt: LAST_MODIFIED,
      recordCounts: {
        workspace_manifest: 1,
        desk_map: 2,
      },
    });
    expect(shards.manifest.id).toBe(shards.manifest.backendRecord.recordId);
    expect(shards.deskMaps[0]?.id).toBe('ws-1:desk-map:dm-a');
    expect(shards.nodes[0]?.id).toBe('ws-1:ownership-node-compat:node-root');
    expect(shards.leaseholdState.id).toBe('ws-1:leasehold-state');
    expect(shards.uiState.id).toBe('ws-1:workspace-ui-state');
    expect(shards.manifest.legacyWorkspaceDataJson).toBe('{"workspaceId":"ws-1"}');
    expect(shards.deskMaps.map((row) => row.backendRecord.recordType)).toEqual([
      'desk_map',
      'desk_map',
    ]);
    expect(shards.nodes).toHaveLength(2);
    expect(shards.nodes.every((row) => row.localOnly)).toBe(true);
    expect(shards.leaseholdState.localOnly).toBe(true);
    expect(shards.uiState.localOnly).toBe(true);
  });

  it('round-trips current WorkspaceData through the compatibility shard set', () => {
    const workspace = buildWorkspace();
    const shards = buildWorkspaceShards(workspace, {
      lastModified: LAST_MODIFIED,
      landroidFileVersion: LANDROID_FILE_VERSION,
    });

    expect(restoreWorkspaceDataFromShards(shards)).toEqual(workspace);
  });

  it('keeps active workspace UI state isolated from title and Desk Map shards', () => {
    const first = buildWorkspace({ activeDeskMapId: 'dm-a', activeUnitCode: 'A' });
    const second = buildWorkspace({ activeDeskMapId: 'dm-b', activeUnitCode: 'B' });

    const firstShards = buildWorkspaceShards(first, {
      lastModified: LAST_MODIFIED,
      landroidFileVersion: LANDROID_FILE_VERSION,
    });
    const secondShards = buildWorkspaceShards(second, {
      lastModified: LAST_MODIFIED,
      landroidFileVersion: LANDROID_FILE_VERSION,
    });

    expect(secondShards.nodes).toEqual(firstShards.nodes);
    expect(secondShards.deskMaps).toEqual(firstShards.deskMaps);
    expect(secondShards.leaseholdState).toEqual(firstShards.leaseholdState);
    expect(secondShards.uiState).not.toEqual(firstShards.uiState);
    expect(secondShards.uiState).toMatchObject({
      activeDeskMapId: 'dm-b',
      activeUnitCode: 'B',
    });
  });

  it('uses an explicit project id when storage needs project/workspace separation', () => {
    const shards = buildWorkspaceShards(buildWorkspace(), {
      projectId: 'project-1',
      lastModified: LAST_MODIFIED,
      revision: 12,
      source: 'local',
      landroidFileVersion: LANDROID_FILE_VERSION,
    });

    expect(shards.manifest.projectId).toBe('project-1');
    expect(shards.manifest.backendRecord.projectId).toBe('project-1');
    expect(shards.manifest.backendRecord.revision).toBe(12);
    expect(shards.deskMaps[0]?.projectId).toBe('project-1');
    expect(shards.deskMaps[0]?.backendRecord.projectId).toBe('project-1');
  });

  it('defines the v10 Dexie table indexes used by the live upgrade', () => {
    expect(WORKSPACE_SHARD_STORE_DEFINITIONS).toEqual({
      workspaceManifestShards: 'id, workspaceId, projectId, [workspaceId+projectId]',
      deskMapShards:
        'id, workspaceId, projectId, [workspaceId+position], [workspaceId+projectId]',
      ownershipNodeCompatShards:
        'id, workspaceId, projectId, [workspaceId+position], [workspaceId+projectId]',
      leaseholdStateShards: 'id, workspaceId, projectId, [workspaceId+projectId]',
      workspaceUiStateShards: 'id, workspaceId, projectId, [workspaceId+projectId]',
      workspaceWriteLeases: 'workspaceId, ownerTabId, expiresAt',
    });
  });

  it('migrates a monolithic workspace record into deterministic shard rows with rollback JSON', () => {
    const workspace = buildWorkspace();
    const record = {
      id: 'user-alice',
      projectName: workspace.projectName,
      data: JSON.stringify(workspace),
      savedAt: LAST_MODIFIED,
    };

    const first = migrateWorkspaceRecordToShards(record, {
      projectId: 'project-1',
      landroidFileVersion: LANDROID_FILE_VERSION,
      syncState: 'local_only',
    });
    const second = migrateWorkspaceRecordToShards(record, {
      projectId: 'project-1',
      landroidFileVersion: LANDROID_FILE_VERSION,
      syncState: 'local_only',
    });

    expect(first).toEqual(second);
    expect(first.workspaceRecordId).toBe('user-alice');
    expect(first.savedAt).toBe(LAST_MODIFIED);
    expect(first.workspaceData).toEqual(workspace);
    expect(first.shards.manifest.legacyWorkspaceDataJson).toBe(record.data);
    expect(first.shards.manifest.backendRecord.lastModified).toBe(LAST_MODIFIED);
    expect(first.rollbackRecord).toEqual(record);
  });

  it('restores a monolithic rollback record from shards without changing workspace data', () => {
    const workspace = buildWorkspace();
    const shards = buildWorkspaceShards(workspace, {
      lastModified: LAST_MODIFIED,
      landroidFileVersion: LANDROID_FILE_VERSION,
    });

    const rollbackRecord = restoreWorkspaceRecordFromShards(shards, {
      id: 'user-alice',
      savedAt: '2026-05-27T01:00:00.000Z',
    });

    expect(rollbackRecord.id).toBe('user-alice');
    expect(rollbackRecord.projectName).toBe('Shard Fixture');
    expect(rollbackRecord.savedAt).toBe('2026-05-27T01:00:00.000Z');
    expect(JSON.parse(rollbackRecord.data)).toEqual(workspace);
  });
});
