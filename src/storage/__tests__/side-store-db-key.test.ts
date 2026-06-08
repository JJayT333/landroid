import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Owner } from '../../types/owner';

type StoredOwner = Owner & { dbKey?: string };

const ACTIVE_DB_KEY = 'user-alice';

function owner(overrides: Partial<StoredOwner> = {}): StoredOwner {
  return {
    id: 'owner-1',
    workspaceId: 'ws-1',
    name: 'Owner',
    entityType: 'individual',
    county: '',
    prospect: '',
    mailingAddress: '',
    phone: '',
    email: '',
    notes: '',
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    dbKey: ACTIVE_DB_KEY,
    ...overrides,
  };
}

function makeScopedTable<Row extends { id: string; workspaceId: string; dbKey?: string }>(
  rows: Row[] = []
) {
  const store = new Map(rows.map((row) => [row.id, row]));
  const matching = (dbKey: string, workspaceId: string) =>
    [...store.values()].filter(
      (row) => row.dbKey === dbKey && row.workspaceId === workspaceId
    );

  return {
    store,
    where: vi.fn((field: string) => ({
      equals: vi.fn((value: unknown) => {
        const rowsForValue = () => {
          if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
            const [dbKey, workspaceId] = value as [string, string];
            return matching(dbKey, workspaceId);
          }
          return [...store.values()].filter(
            (row) => (row as unknown as Record<string, unknown>)[field] === value
          );
        };
        return {
          toArray: vi.fn(async () => rowsForValue()),
          sortBy: vi.fn(async (sortField: keyof Row) =>
            rowsForValue().sort((left, right) =>
              String(left[sortField]).localeCompare(String(right[sortField]))
            )
          ),
          delete: vi.fn(async () => {
            for (const row of rowsForValue()) store.delete(row.id);
          }),
        };
      }),
    })),
    bulkPut: vi.fn(async (newRows: Row[]) => {
      for (const row of newRows) store.set(row.id, row);
    }),
  };
}

async function loadOwnerPersistence(initialOwners: StoredOwner[]) {
  vi.resetModules();

  const owners = makeScopedTable(initialOwners);
  const empty = makeScopedTable([]);
  const db = {
    owners,
    leases: empty,
    leasePurchaseReports: makeScopedTable([]),
    contactLogs: empty,
    ownerDocs: empty,
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') throw new Error('missing transaction callback');
      return callback();
    }),
  };

  vi.doMock('../active-workspace-key', () => ({
    getWorkspaceDbKey: () => ACTIVE_DB_KEY,
  }));
  vi.doMock('../workspace-write-lease', () => ({
    assertWorkspaceWriteFence: vi.fn(async () => undefined),
    ensureWorkspaceWriteFence: vi.fn(async () => undefined),
  }));
  vi.doMock('../db', () => ({ default: db }));

  const persistence = await import('../owner-persistence');
  return { persistence, owners };
}

describe('side-store dbKey isolation', () => {
  afterEach(() => {
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../workspace-write-lease');
    vi.doUnmock('../db');
    vi.resetModules();
  });

  it('replaces active owner rows without deleting another dbKey for the same workspace and logical id', async () => {
    const { persistence, owners } = await loadOwnerPersistence([
      owner({ id: 'user-alice::owner-shared', name: 'Alice Old' }),
      owner({ id: 'user-bob::owner-shared', dbKey: 'user-bob', name: 'Bob Owner' }),
    ]);

    await persistence.replaceOwnerWorkspaceData('ws-1', {
      owners: [owner({ id: 'owner-shared', name: 'Alice New', dbKey: undefined })],
      leases: [],
      contacts: [],
      docs: [],
    });

    expect(owners.store.has('user-alice::owner-shared')).toBe(true);
    expect(owners.store.get('user-alice::owner-shared')).toEqual(
      expect.objectContaining({
        id: 'user-alice::owner-shared',
        dbKey: ACTIVE_DB_KEY,
        name: 'Alice New',
        workspaceId: 'ws-1',
      })
    );
    expect(owners.store.get('user-bob::owner-shared')).toEqual(
      expect.objectContaining({
        id: 'user-bob::owner-shared',
        dbKey: 'user-bob',
        name: 'Bob Owner',
        workspaceId: 'ws-1',
      })
    );
  });
});
