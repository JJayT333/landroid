/**
 * Whole-codebase audit (confirmed HIGH): `duplicateProjectStorage` copied the
 * owner / lease / map / research / document tables but silently dropped canvas
 * images (`canvasAssets`) and GeoJSON tract polygons (`mapTractFeatures`), so a
 * routine "Duplicate project" produced broken images and missing tracts.
 *
 * It also (deliberately) does NOT copy the title ledger: each audit event's
 * hash covers the record envelope including `workspaceId`, so re-keying the
 * rows to the duplicate's workspaceId would invalidate every hash and the copy
 * would be quarantined on load. The duplicate baselines a fresh ledger instead.
 *
 * Storage internals are mocked; this pins WHICH tables the duplicate copies.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedProjectSummary } from '../saved-project-index';

async function loadHarness() {
  vi.resetModules();
  const copied: string[] = [];

  function makeTable(name: string) {
    return {
      get: vi.fn(async () => undefined),
      put: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      bulkPut: vi.fn(async () => {
        copied.push(name);
      }),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          // One source row so copyWorkspaceRows proceeds past its empty-guard
          // to bulkPut — that bulkPut is what records the table as "copied".
          toArray: vi.fn(async () => [
            {
              id: 'default::project::ws-source::row-1',
              dbKey: 'default::project::ws-source',
              workspaceId: 'ws-source',
            },
          ]),
          delete: vi.fn(async () => {}),
          primaryKeys: vi.fn(async () => []),
        })),
      })),
    };
  }

  const tables: Record<string, ReturnType<typeof makeTable>> = {};
  const tableProxy = new Proxy(tables, {
    get(target, prop: string) {
      if (!target[prop]) target[prop] = makeTable(prop);
      return target[prop];
    },
  });
  const transaction = vi.fn(async (_mode: string, ...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback !== 'function') throw new Error('transaction callback missing');
    return callback();
  });
  const db = new Proxy(
    { transaction } as Record<string, unknown>,
    {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        return tableProxy[prop];
      },
    }
  );

  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../workspace-write-lease', () => ({
    ensureWorkspaceWritable: vi.fn(async () => true),
    assertWorkspaceWriteFence: vi.fn(async () => {}),
    ensureWorkspaceWriteFence: vi.fn(async () => {}),
  }));
  vi.doMock('../saved-project-index', () => ({
    deleteSavedProjectIndexRecord: vi.fn(async () => {}),
    upsertSavedProjectFromWorkspace: vi.fn(async (input: unknown) => input),
  }));

  const storage = await import('../project-workspace-storage');
  return { storage, copied };
}

function project(workspaceId: string): SavedProjectSummary {
  return {
    workspaceId,
    workspaceDbKey: `default::project::${workspaceId}`,
    projectName: 'Duplicate Coverage',
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
    lastOpenedAt: '2026-06-10T00:00:00.000Z',
  } as SavedProjectSummary;
}

describe('duplicateProjectStorage copies the full workspace', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../workspace-write-lease');
    vi.doUnmock('../saved-project-index');
    vi.resetModules();
  });

  it('copies canvas images and GeoJSON tract polygons, and does not copy the ledger', async () => {
    const { storage, copied } = await loadHarness();

    await storage.duplicateProjectStorage(
      project('ws-source'),
      project('ws-target'),
      {
        workspaceId: 'ws-target',
        projectName: 'Copy',
        nodes: [],
        deskMaps: [],
        activeDeskMapId: null,
        activeUnitCode: null,
        instrumentTypes: [],
      },
      { nodes: [], edges: [] }
    );

    // The previously-dropped tables are now copied.
    expect(copied).toContain('canvasAssets');
    expect(copied).toContain('mapTractFeatures');
    // Sanity: the tables that always copied still do.
    expect(copied).toContain('owners');
    expect(copied).toContain('mapAssets');
    expect(copied).toContain('documents');

    // The append-only title ledger is intentionally NOT copied (re-keying its
    // workspaceId would invalidate every event hash); the duplicate baselines
    // fresh on first open.
    expect(copied).not.toContain('titleActionRecords');
    expect(copied).not.toContain('titleAuditEvents');
  });
});
