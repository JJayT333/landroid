import { describe, expect, it, vi } from 'vitest';
import {
  LANDROID_FILE_VERSION,
  type LandroidFileData,
} from '../workspace-persistence';
import {
  RollingAutoExportPermissionError,
  buildRollingAutoExportFileName,
  isRollingAutoExportSupported,
  pruneRollingAutoExportSnapshots,
  requestRollingAutoExportPermission,
  rollingAutoExportFileNamePattern,
  sanitizeRollingAutoExportBaseName,
  writeRollingAutoExportSnapshot,
  type FileSystemAccessWindow,
  type RollingAutoExportDirectoryHandle,
} from '../rolling-auto-export';

function workspaceData(projectName = 'Raven Forest'): LandroidFileData {
  return {
    workspaceId: 'ws-1',
    projectName,
    nodes: [],
    deskMaps: [],
    activeDeskMapId: null,
    instrumentTypes: [],
    canvas: { nodes: [], edges: [] },
  };
}

interface FakeDirectoryEntry {
  kind: string;
  name: string;
}

function timestampedName(projectName: string, minute: number) {
  return buildRollingAutoExportFileName(
    projectName,
    new Date(`2026-06-05T12:${String(minute).padStart(2, '0')}:00.000Z`)
  );
}

function fakeDirectoryHandle(
  permission: PermissionState = 'granted',
  {
    entries = [],
    pruneSupported = true,
    removeError,
    writeError,
  }: {
    entries?: FakeDirectoryEntry[];
    pruneSupported?: boolean;
    removeError?: Error;
    writeError?: Error;
  } = {}
) {
  const writes: Blob[] = [];
  const fileNames: string[] = [];
  const removedFileNames: string[] = [];
  const close = vi.fn(async () => undefined);
  const write = vi.fn(async (blob: Blob) => {
    if (writeError) throw writeError;
    writes.push(blob);
  });
  const handle: RollingAutoExportDirectoryHandle = {
    name: 'LANDroid Backups',
    queryPermission: async () => permission,
    getFileHandle: async (fileName) => {
      fileNames.push(fileName);
      return {
        createWritable: async () => ({
          close,
          write,
        }),
      };
    },
  };
  if (pruneSupported) {
    handle.values = async function* values() {
      for (const entry of entries) {
        yield entry;
      }
      for (const fileName of fileNames) {
        yield { kind: 'file', name: fileName };
      }
    };
    handle.removeEntry = vi.fn(async (fileName: string) => {
      if (removeError) throw removeError;
      removedFileNames.push(fileName);
    });
  }

  return { close, fileNames, handle, removedFileNames, write, writes };
}

describe('rolling auto-export', () => {
  it('builds safe timestamped .landroid file names', () => {
    expect(sanitizeRollingAutoExportBaseName(' Raven/Forest: Unit. ')).toBe(
      'Raven-Forest- Unit'
    );
    expect(
      buildRollingAutoExportFileName(
        'Raven/Forest',
        new Date('2026-06-05T12:00:00.000Z')
      )
    ).toBe('Raven-Forest-2026-06-05T12-00-00-000Z.landroid');
  });

  it('detects whether local folder auto-export can be configured', () => {
    expect(
      isRollingAutoExportSupported(
        {
          showDirectoryPicker: async () => fakeDirectoryHandle().handle,
        } as FileSystemAccessWindow,
        {} as IDBFactory
      )
    ).toBe(true);
    expect(isRollingAutoExportSupported(undefined, {} as IDBFactory)).toBe(false);
  });

  it('requests read-write permission on a selected folder handle', async () => {
    const requestPermission = vi.fn(async () => 'granted' as PermissionState);
    const handle: RollingAutoExportDirectoryHandle = {
      name: 'LANDroid Backups',
      queryPermission: async () => 'prompt',
      requestPermission,
      getFileHandle: async () => ({
        createWritable: async () => ({
          close: async () => undefined,
          write: async () => undefined,
        }),
      }),
    };

    await expect(requestRollingAutoExportPermission(handle)).resolves.toBe(
      'granted'
    );
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('writes snapshots through the .landroid serializer', async () => {
    const directory = fakeDirectoryHandle();

    const result = await writeRollingAutoExportSnapshot({
      directoryHandle: directory.handle,
      data: workspaceData(),
      now: () => new Date('2026-06-05T12:00:00.000Z'),
    });

    expect(result.fileName).toBe(
      'Raven Forest-2026-06-05T12-00-00-000Z.landroid'
    );
    expect(result.prunedFileNames).toEqual([]);
    expect(result.pruneWarning).toBeUndefined();
    expect(directory.fileNames).toEqual([result.fileName]);
    expect(directory.write).toHaveBeenCalledTimes(1);
    expect(directory.close).toHaveBeenCalledTimes(1);

    expect(directory.writes).toHaveLength(1);
    const written = JSON.parse(await directory.writes[0]!.text()) as {
      projectName: string;
      version: number;
      workspaceId: string;
    };
    expect(written).toMatchObject({
      projectName: 'Raven Forest',
      version: LANDROID_FILE_VERSION,
      workspaceId: 'ws-1',
    });
  });

  it('does not write when folder permission is revoked', async () => {
    const directory = fakeDirectoryHandle('denied');

    await expect(
      writeRollingAutoExportSnapshot({
        directoryHandle: directory.handle,
        data: workspaceData(),
      })
    ).rejects.toBeInstanceOf(RollingAutoExportPermissionError);
    expect(directory.write).not.toHaveBeenCalled();
  });

  it('prunes beyond keep-last after a successful write', async () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      kind: 'file',
      name: timestampedName('Raven Forest', index),
    }));
    const directory = fakeDirectoryHandle('granted', { entries });

    const result = await writeRollingAutoExportSnapshot({
      directoryHandle: directory.handle,
      data: workspaceData(),
      now: () => new Date('2026-06-05T12:10:00.000Z'),
    });

    expect(result.prunedFileNames).toEqual([timestampedName('Raven Forest', 0)]);
    expect(directory.removedFileNames).toEqual([
      timestampedName('Raven Forest', 0),
    ]);
    expect(directory.removedFileNames).not.toContain(result.fileName);
  });

  it('never deletes hand-named, foreign-project, backup, or directory entries', async () => {
    const entries = [
      ...Array.from({ length: 10 }, (_, index) => ({
        kind: 'file',
        name: timestampedName('Raven Forest', index),
      })),
      { kind: 'file', name: 'operator-saved.landroid' },
      { kind: 'file', name: timestampedName('Other Project', 0) },
      { kind: 'file', name: `${timestampedName('Raven Forest', 0)}.bak` },
      { kind: 'directory', name: timestampedName('Raven Forest', 1) },
    ];
    const directory = fakeDirectoryHandle('granted', { entries });

    await writeRollingAutoExportSnapshot({
      directoryHandle: directory.handle,
      data: workspaceData(),
      now: () => new Date('2026-06-05T12:10:00.000Z'),
    });

    expect(directory.removedFileNames).toEqual([
      timestampedName('Raven Forest', 0),
    ]);
  });

  it('skips pruning gracefully when directory iteration or removal is unavailable', async () => {
    const directory = fakeDirectoryHandle('granted', { pruneSupported: false });

    await expect(
      pruneRollingAutoExportSnapshots({
        directoryHandle: directory.handle,
        projectName: 'Raven Forest',
      })
    ).resolves.toEqual({ deletedFileNames: [], skipped: true });

    const result = await writeRollingAutoExportSnapshot({
      directoryHandle: directory.handle,
      data: workspaceData(),
    });
    expect(result.prunedFileNames).toEqual([]);
    expect(result.pruneWarning).toBeUndefined();
  });

  it('does not delete anything when snapshot writing fails', async () => {
    const directory = fakeDirectoryHandle('granted', {
      entries: Array.from({ length: 10 }, (_, index) => ({
        kind: 'file',
        name: timestampedName('Raven Forest', index),
      })),
      writeError: new Error('disk full'),
    });

    await expect(
      writeRollingAutoExportSnapshot({
        directoryHandle: directory.handle,
        data: workspaceData(),
        now: () => new Date('2026-06-05T12:10:00.000Z'),
      })
    ).rejects.toThrow(/disk full/);
    expect(directory.handle.removeEntry).not.toHaveBeenCalled();
  });

  it('keeps the successful write when pruning fails and returns a warning', async () => {
    const directory = fakeDirectoryHandle('granted', {
      entries: Array.from({ length: 10 }, (_, index) => ({
        kind: 'file',
        name: timestampedName('Raven Forest', index),
      })),
      removeError: new Error('remove denied'),
    });

    const result = await writeRollingAutoExportSnapshot({
      directoryHandle: directory.handle,
      data: workspaceData(),
      now: () => new Date('2026-06-05T12:10:00.000Z'),
    });

    expect(result.fileName).toBe(timestampedName('Raven Forest', 10));
    expect(result.prunedFileNames).toEqual([]);
    expect(result.pruneWarning).toContain('remove denied');
    expect(directory.write).toHaveBeenCalledTimes(1);
    expect(directory.close).toHaveBeenCalledTimes(1);
  });

  it('escapes regex metacharacters in project names', () => {
    const pattern = rollingAutoExportFileNamePattern('A+B (Unit)');

    expect(
      pattern.test(
        buildRollingAutoExportFileName(
          'A+B (Unit)',
          new Date('2026-06-05T12:00:00.000Z')
        )
      )
    ).toBe(true);
    expect(
      pattern.test('AAAB Unit-2026-06-05T12-00-00-000Z.landroid')
    ).toBe(false);
  });
});
