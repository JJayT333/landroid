/**
 * Lineage (`derivedFrom`) durability. A duplicated project carries chain-of-
 * custody on its saved-project record until its first open seals it into the
 * genesis ledger baseline. The first open touches the record via
 * `markSavedProjectOpened` → `upsertSavedProjectFromWorkspace`, whose
 * `SavedProjectUpsert` input intentionally omits `derivedFrom` — so the upsert
 * MUST preserve the stored lineage, or an open/rename/autosave would silently
 * erase it before the baseline ever reads it. Fake-db unit test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

function loadSavedProjectIndex() {
  vi.resetModules();
  const rows = new Map<string, { id: string; indexDbKey: string }>();
  const db = {
    savedProjects: {
      get: vi.fn(async (id: string) => rows.get(id)),
      put: vi.fn(async (record: { id: string; indexDbKey: string }) => {
        rows.set(record.id, record);
      }),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({ toArray: vi.fn(async () => [...rows.values()]) })),
      })),
    },
  };
  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../active-workspace-key', () => ({
    getProjectIndexDbKey: () => 'idx',
    getWorkspaceDbKey: () => 'idx::project::active',
    makeProjectWorkspaceDbKey: (workspaceId: string, indexDbKey: string) =>
      `${indexDbKey}::project::${workspaceId}`,
  }));
  vi.doMock('../db-key-scope', () => ({
    storageScopedId: (workspaceId: string, indexDbKey: string) =>
      `${indexDbKey}::sp::${workspaceId}`,
  }));
  return import('../saved-project-index');
}

describe('saved-project index lineage durability', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../active-workspace-key');
    vi.doUnmock('../db-key-scope');
    vi.resetModules();
  });

  const derivedFrom = {
    kind: 'duplicate' as const,
    sourceWorkspaceId: 'ws-src',
    sourceProjectName: 'Source',
    duplicatedAt: '2026-06-20T00:00:00.000Z',
    sourceNodeCount: 2,
    sourceLedgerHeadHash: 'src-head',
  };

  it('stores derivedFrom on create and preserves it through a first-open touch', async () => {
    const mod = await loadSavedProjectIndex();

    const created = await mod.createSavedProjectIndexRecord(
      'ws-dup',
      'Duplicate',
      '2026-06-20T00:00:00.000Z',
      derivedFrom
    );
    expect(created.derivedFrom).toEqual(derivedFrom);

    // markSavedProjectOpened → upsertSavedProjectFromWorkspace; the upsert input
    // omits derivedFrom, so only the preserve branch keeps lineage alive.
    const opened = await mod.markSavedProjectOpened('ws-dup', '2026-06-21T00:00:00.000Z');
    expect(opened?.derivedFrom).toEqual(derivedFrom);
  });

  it('leaves a non-duplicated project without lineage', async () => {
    const mod = await loadSavedProjectIndex();

    const created = await mod.createSavedProjectIndexRecord('ws-plain', 'Plain');
    expect(created.derivedFrom).toBeUndefined();

    const opened = await mod.markSavedProjectOpened('ws-plain');
    expect(opened?.derivedFrom).toBeUndefined();
  });
});
