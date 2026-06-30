/**
 * FED1/FED2 federal lease-document persistence — workspace + dbKey scoping and
 * replace-all/clear, against a hand-rolled Dexie table mock (mirrors
 * map-tract-feature-persistence.test.ts).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FederalLeaseDocument } from '../federal-lease-seed';

const ACTIVE_DB_KEY = 'user-alice';
type Row = FederalLeaseDocument & { id: string; workspaceId: string; dbKey?: string };

function doc(
  recordId: string,
  overrides: Partial<FederalLeaseDocument> = {}
): FederalLeaseDocument {
  return {
    recordId,
    form: 'BLM 3100-11',
    mlrsSerial: 'NMNM-1',
    legacySerial: 'NM-1',
    lessee: 'Acme',
    prospect: 'Raven',
    county: 'Lea',
    survey: 'S',
    tract: 'T',
    acres: '640',
    mineralPercent: '100',
    effectiveDate: '2020-01-01',
    expirationDate: '2030-01-01',
    primaryTermYears: 10,
    royaltyFraction: '1/8',
    bonusPerAcre: '10',
    rentalPerAcre: '1.5',
    stipulations: ['NSO'],
    notes: '',
    status: 'Active',
    ...overrides,
  };
}

function makeTable(rows: Row[]) {
  const collection = (predicate: (row: Row) => boolean) => ({
    toArray: vi.fn(async () => rows.filter(predicate)),
    delete: vi.fn(async () => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (predicate(rows[i])) rows.splice(i, 1);
      }
    }),
  });
  return {
    rows,
    bulkPut: vi.fn(async (newRows: Row[]) => {
      for (const row of newRows) {
        const existing = rows.findIndex((r) => r.id === row.id);
        if (existing >= 0) rows[existing] = row;
        else rows.push(row);
      }
    }),
    where: vi.fn((field: string) => ({
      equals: (value: unknown) =>
        collection((row) => {
          if (field === '[dbKey+workspaceId]' && Array.isArray(value)) {
            const [dbKey, workspaceId] = value as [string, string];
            return row.dbKey === dbKey && row.workspaceId === workspaceId;
          }
          return (row as unknown as Record<string, unknown>)[field] === value;
        }),
    })),
  };
}

async function loadStore(initial: Row[] = []) {
  vi.resetModules();
  const federalLeaseDocuments = makeTable(initial);
  const db = {
    federalLeaseDocuments,
    transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback !== 'function') throw new Error('transaction callback missing');
      return callback();
    }),
  };
  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../active-workspace-key', () => ({ getWorkspaceDbKey: () => ACTIVE_DB_KEY }));
  const persistence = await import('../federal-lease-persistence');
  return { persistence, db };
}

describe('federal lease document persistence (FED1/FED2)', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../active-workspace-key');
    vi.resetModules();
  });

  it('round-trips documents scoped to the workspace with the active dbKey', async () => {
    const { persistence, db } = await loadStore();
    await persistence.replaceFederalLeaseDocuments('ws-1', [
      doc('r1'),
      doc('r2', { stipulations: ['NSO', 'TLS'] }),
    ]);

    expect(db.federalLeaseDocuments.rows).toHaveLength(2);
    expect(db.federalLeaseDocuments.rows.every((r) => r.dbKey === ACTIVE_DB_KEY)).toBe(true);

    const loaded = await persistence.loadFederalLeaseDocuments('ws-1');
    expect(loaded.map((d) => d.recordId).sort()).toEqual(['r1', 'r2']);
    expect(loaded.find((d) => d.recordId === 'r2')?.stipulations).toEqual(['NSO', 'TLS']);
  });

  it('replace deletes the prior set; clear empties the workspace', async () => {
    const { persistence } = await loadStore();
    await persistence.replaceFederalLeaseDocuments('ws-1', [doc('r1')]);
    await persistence.replaceFederalLeaseDocuments('ws-1', [doc('r2')]);
    expect((await persistence.loadFederalLeaseDocuments('ws-1')).map((d) => d.recordId)).toEqual([
      'r2',
    ]);

    await persistence.clearFederalLeaseDocumentsForWorkspace('ws-1');
    expect(await persistence.loadFederalLeaseDocuments('ws-1')).toEqual([]);
  });

  it('does not leak across workspaces', async () => {
    const { persistence } = await loadStore();
    await persistence.replaceFederalLeaseDocuments('ws-1', [doc('r1')]);
    await persistence.replaceFederalLeaseDocuments('ws-2', [doc('r2')]);
    expect((await persistence.loadFederalLeaseDocuments('ws-1')).map((d) => d.recordId)).toEqual([
      'r1',
    ]);
    expect((await persistence.loadFederalLeaseDocuments('ws-2')).map((d) => d.recordId)).toEqual([
      'r2',
    ]);
  });
});
