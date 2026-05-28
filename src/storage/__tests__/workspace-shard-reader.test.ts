import { describe, expect, it } from 'vitest';
import { createBlankNode, type DeskMap } from '../../types/node';
import { LANDROID_FILE_VERSION, type WorkspaceData } from '../workspace-persistence';
import { readWorkspaceFromShardRows } from '../workspace-shard-reader';
import { buildWorkspaceShards } from '../workspace-shards';

const SAVED_AT = '2026-05-27T00:00:00.000Z';

function buildWorkspace(overrides: Partial<WorkspaceData> = {}): WorkspaceData {
  const deskMap: DeskMap = {
    id: 'dm-1',
    name: 'North Unit',
    code: 'A',
    tractId: 'T-1',
    grossAcres: '160',
    pooledAcres: '120',
    description: 'North half',
    nodeIds: ['node-root'],
  };

  return {
    workspaceId: 'ws-1',
    projectName: 'Shard Reader Fixture',
    nodes: [
      {
        ...createBlankNode('node-root'),
        instrument: 'Warranty Deed',
        fraction: '1',
        initialFraction: '1',
      },
    ],
    deskMaps: [deskMap],
    leaseholdUnit: {
      name: 'Reader Unit',
      description: '',
      operator: '',
      effectiveDate: '',
      jurisdiction: 'tx_fee',
    },
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: ['Deed'],
    ...overrides,
  };
}

function shardRows(workspace = buildWorkspace()) {
  const shards = buildWorkspaceShards(workspace, {
    lastModified: SAVED_AT,
    landroidFileVersion: LANDROID_FILE_VERSION,
    source: 'migration',
    syncState: 'local_only',
    legacyWorkspaceDataJson: JSON.stringify(workspace),
  });
  return {
    manifest: shards.manifest,
    deskMaps: shards.deskMaps,
    nodes: shards.nodes,
    leaseholdState: shards.leaseholdState,
    uiState: shards.uiState,
    monolithData: workspace,
  };
}

describe('workspace-shard-reader', () => {
  it('loads complete shard rows before the monolithic fallback', () => {
    const workspace = buildWorkspace();
    const result = readWorkspaceFromShardRows(shardRows(workspace));

    expect(result.status).toBe('loaded_from_shards');
    expect(result.warning).toBeNull();
    expect(result.data).toEqual(workspace);
  });

  it('loads the monolith when no shard rows exist yet', () => {
    const workspace = buildWorkspace();
    const result = readWorkspaceFromShardRows({
      monolithData: workspace,
    });

    expect(result.status).toBe('loaded_from_monolith');
    expect(result.warning).toBeNull();
    expect(result.data).toEqual(workspace);
  });

  it('falls back to the monolith when required shard rows are incomplete', () => {
    const workspace = buildWorkspace();
    const rows = shardRows(workspace);

    const result = readWorkspaceFromShardRows({
      ...rows,
      uiState: null,
    });

    expect(result.status).toBe('fallback_to_monolith');
    expect(result.warning).toMatch(/workspace UI state shard is missing/);
    expect(result.data).toEqual(workspace);
  });

  it('falls back to the monolith when shard counts disagree with the manifest', () => {
    const workspace = buildWorkspace();
    const rows = shardRows(workspace);

    const result = readWorkspaceFromShardRows({
      ...rows,
      deskMaps: [],
    });

    expect(result.status).toBe('fallback_to_monolith');
    expect(result.warning).toMatch(/desk map shard count 0 did not match/);
    expect(result.data).toEqual(workspace);
  });

  it('reports corruption when shards are incomplete and the monolith is missing', () => {
    const rows = shardRows();

    const result = readWorkspaceFromShardRows({
      ...rows,
      monolithData: null,
      leaseholdState: null,
    });

    expect(result.status).toBe('corrupt');
    expect(result.error).toMatch(/leasehold state shard is missing/);
    expect(result.error).toMatch(/no monolithic workspace backup/);
  });

  it('reports corruption when fallback monolith data is invalid', () => {
    const rows = shardRows();

    const result = readWorkspaceFromShardRows({
      ...rows,
      uiState: null,
      monolithData: null,
      monolithError: 'saved workspace is not valid JSON',
    });

    expect(result.status).toBe('corrupt');
    expect(result.error).toMatch(/workspace UI state shard is missing/);
    expect(result.error).toMatch(/monolithic workspace backup was corrupt/);
  });

  it('validates restored shard data when a validator is supplied', () => {
    const workspace = buildWorkspace();
    const rows = shardRows(workspace);

    const result = readWorkspaceFromShardRows(rows, {
      validateWorkspaceData: (data) => ({
        ...data,
        projectName: `${data.projectName} Validated`,
      }),
    });

    expect(result.status).toBe('loaded_from_shards');
    expect(result.data?.projectName).toBe('Shard Reader Fixture Validated');
  });
});
