import { describe, expect, it, vi } from 'vitest';
import type { Transaction } from 'dexie';
import { createBlankNode, type DeskMap } from '../../types/node';
import { LANDROID_FILE_VERSION, type WorkspaceData } from '../workspace-persistence';
import {
  runV9ToV10WorkspaceShardMigration,
  type WorkspaceRecord,
} from '../db';

const SAVED_AT = '2026-05-27T00:00:00.000Z';

class FakeTable<Row extends object> {
  rows = new Map<string, Row>();

  constructor(
    private readonly primaryKey: keyof Row,
    rows: Row[] = []
  ) {
    for (const row of rows) {
      this.rows.set(String(row[this.primaryKey]), row);
    }
  }

  async toArray(): Promise<Row[]> {
    return [...this.rows.values()];
  }

  async put(row: Row): Promise<void> {
    this.rows.set(String(row[this.primaryKey]), row);
  }

  async bulkPut(rows: Row[]): Promise<void> {
    for (const row of rows) {
      await this.put(row);
    }
  }
}

function buildWorkspace(): WorkspaceData {
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
    projectName: 'Dexie Migration Fixture',
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
      name: 'Migration Unit',
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
  };
}

function workspaceRecord(
  overrides: Partial<WorkspaceRecord> = {}
): WorkspaceRecord {
  const workspace = buildWorkspace();
  return {
    id: 'user-alice',
    projectName: workspace.projectName,
    data: JSON.stringify(workspace),
    savedAt: SAVED_AT,
    ...overrides,
  };
}

function buildTx(records: WorkspaceRecord[]) {
  const tables = {
    workspaces: new FakeTable<WorkspaceRecord>('id', records),
    workspaceManifestShards: new FakeTable<Record<string, unknown>>('id'),
    deskMapShards: new FakeTable<Record<string, unknown>>('id'),
    ownershipNodeCompatShards: new FakeTable<Record<string, unknown>>('id'),
    leaseholdStateShards: new FakeTable<Record<string, unknown>>('id'),
    workspaceUiStateShards: new FakeTable<Record<string, unknown>>('id'),
  };
  const tx = {
    table: vi.fn((name: keyof typeof tables) => tables[name]),
  } as unknown as Transaction;

  return { tx, tables };
}

describe('v9 to v10 workspace shard Dexie migration', () => {
  it('populates v10 shard tables from existing monolithic workspace rows', async () => {
    const record = workspaceRecord();
    const { tx, tables } = buildTx([record]);

    await runV9ToV10WorkspaceShardMigration(tx);

    expect(tables.workspaces.rows.get('user-alice')).toEqual(record);
    expect(tables.workspaceManifestShards.rows.get('ws-1:workspace-manifest')).toEqual(
      expect.objectContaining({
        id: 'ws-1:workspace-manifest',
        shardKind: 'workspace_manifest',
        workspaceId: 'ws-1',
        legacyWorkspaceDataJson: record.data,
        backendRecord: expect.objectContaining({
          recordType: 'workspace_manifest',
          landroidFileVersion: LANDROID_FILE_VERSION,
          projectName: 'Dexie Migration Fixture',
          syncState: 'local_only',
        }),
      })
    );
    expect(tables.deskMapShards.rows.get('ws-1:desk-map:dm-1')).toEqual(
      expect.objectContaining({
        shardKind: 'desk_map',
        position: 0,
      })
    );
    expect(
      tables.ownershipNodeCompatShards.rows.get(
        'ws-1:ownership-node-compat:node-root'
      )
    ).toEqual(expect.objectContaining({ localOnly: true, position: 0 }));
    expect(tables.leaseholdStateShards.rows.get('ws-1:leasehold-state')).toEqual(
      expect.objectContaining({ localOnly: true })
    );
    expect(tables.workspaceUiStateShards.rows.get('ws-1:workspace-ui-state')).toEqual(
      expect.objectContaining({ activeDeskMapId: 'dm-1' })
    );
  });

  it('is idempotent for an explicit recovery rerun over the same rows', async () => {
    const { tx, tables } = buildTx([workspaceRecord()]);

    await runV9ToV10WorkspaceShardMigration(tx);
    await runV9ToV10WorkspaceShardMigration(tx);

    expect(tables.workspaceManifestShards.rows.size).toBe(1);
    expect(tables.deskMapShards.rows.size).toBe(1);
    expect(tables.ownershipNodeCompatShards.rows.size).toBe(1);
    expect(tables.leaseholdStateShards.rows.size).toBe(1);
    expect(tables.workspaceUiStateShards.rows.size).toBe(1);
  });

  it('skips corrupt monolithic rows without deleting the rollback source', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const corrupt = workspaceRecord({
      id: 'corrupt-row',
      data: '{"workspaceId":',
    });
    const { tx, tables } = buildTx([corrupt]);

    await runV9ToV10WorkspaceShardMigration(tx);

    expect(tables.workspaces.rows.get('corrupt-row')).toEqual(corrupt);
    expect(tables.workspaceManifestShards.rows.size).toBe(0);
    expect(tables.deskMapShards.rows.size).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Workspace row corrupt-row could not be sharded')
    );
    warnSpy.mockRestore();
  });
});
