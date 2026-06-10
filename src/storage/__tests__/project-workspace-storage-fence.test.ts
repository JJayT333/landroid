/**
 * DA-M15 — project rename/delete/duplicate run behind the workspace write
 * lease: a tab that cannot acquire the target workspace's lease must not
 * rename, delete, or copy it. Storage internals are mocked; these tests pin
 * the gate, not the row mechanics.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedProjectSummary } from '../saved-project-index';

function makeTable() {
  return {
    get: vi.fn(async () => undefined),
    put: vi.fn(async () => {}),
    delete: vi.fn(async () => {}),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(async () => []),
        delete: vi.fn(async () => {}),
        primaryKeys: vi.fn(async () => []),
      })),
    })),
  };
}

async function loadProjectStorage() {
  vi.resetModules();

  const tables = new Proxy<Record<string, ReturnType<typeof makeTable>>>(
    {},
    {
      get(target, prop: string) {
        if (prop === 'transaction') return undefined;
        if (!target[prop]) target[prop] = makeTable();
        return target[prop];
      },
    }
  );
  const transaction = vi.fn(async (_mode: string, ...args: unknown[]) => {
    const callback = args.at(-1);
    if (typeof callback !== 'function') throw new Error('transaction callback missing');
    return callback();
  });
  const db = new Proxy(
    { transaction },
    {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target];
        return tables[prop];
      },
    }
  );

  const lease = {
    ensureWorkspaceWritable: vi.fn(async () => true),
    assertWorkspaceWriteFence: vi.fn(async () => {}),
  };
  vi.doMock('../db', () => ({ default: db }));
  vi.doMock('../workspace-write-lease', () => lease);
  vi.doMock('../saved-project-index', () => ({
    deleteSavedProjectIndexRecord: vi.fn(async () => {}),
    upsertSavedProjectFromWorkspace: vi.fn(async (input: unknown) => input),
  }));

  const storage = await import('../project-workspace-storage');
  return { storage, lease, transaction };
}

function project(workspaceId: string): SavedProjectSummary {
  return {
    workspaceId,
    workspaceDbKey: `default::project::${workspaceId}`,
    projectName: 'Fenced Project',
    createdAt: '2026-06-10T00:00:00.000Z',
    updatedAt: '2026-06-10T00:00:00.000Z',
    lastOpenedAt: '2026-06-10T00:00:00.000Z',
  } as SavedProjectSummary;
}

describe('project storage operations are lease-gated (DA-M15)', () => {
  afterEach(() => {
    vi.doUnmock('../db');
    vi.doUnmock('../workspace-write-lease');
    vi.doUnmock('../saved-project-index');
    vi.resetModules();
  });

  it('renameProjectInStorage refuses without the workspace lease', async () => {
    const { storage, lease, transaction } = await loadProjectStorage();
    lease.ensureWorkspaceWritable.mockResolvedValueOnce(false);

    await expect(
      storage.renameProjectInStorage(project('ws-locked'), 'New Name')
    ).rejects.toThrow(/read-only/);
    expect(transaction).not.toHaveBeenCalled();

    await storage.renameProjectInStorage(project('ws-free'), 'New Name');
    expect(lease.ensureWorkspaceWritable).toHaveBeenLastCalledWith('ws-free');
    expect(lease.assertWorkspaceWriteFence).toHaveBeenCalledWith('ws-free');
  });

  it('deleteProjectStorage refuses without the workspace lease', async () => {
    const { storage, lease, transaction } = await loadProjectStorage();
    lease.ensureWorkspaceWritable.mockResolvedValueOnce(false);

    await expect(storage.deleteProjectStorage(project('ws-locked'))).rejects.toThrow(/read-only/);
    expect(transaction).not.toHaveBeenCalled();

    await storage.deleteProjectStorage(project('ws-free'));
    expect(lease.ensureWorkspaceWritable).toHaveBeenLastCalledWith('ws-free');
    expect(lease.assertWorkspaceWriteFence).toHaveBeenCalledWith('ws-free');
  });

  it('duplicateProjectStorage refuses without the SOURCE workspace lease', async () => {
    const { storage, lease } = await loadProjectStorage();
    lease.ensureWorkspaceWritable.mockResolvedValueOnce(false);

    await expect(
      storage.duplicateProjectStorage(
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
        null
      )
    ).rejects.toThrow(/read-only/);
    expect(lease.ensureWorkspaceWritable).toHaveBeenCalledWith('ws-source');
  });
});
