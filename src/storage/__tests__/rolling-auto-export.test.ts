import { describe, expect, it, vi } from 'vitest';
import {
  LANDROID_FILE_VERSION,
  type LandroidFileData,
} from '../workspace-persistence';
import {
  RollingAutoExportPermissionError,
  buildRollingAutoExportFileName,
  isRollingAutoExportSupported,
  requestRollingAutoExportPermission,
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

function fakeDirectoryHandle(permission: PermissionState = 'granted') {
  const writes: Blob[] = [];
  const fileNames: string[] = [];
  const close = vi.fn(async () => undefined);
  const write = vi.fn(async (blob: Blob) => {
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

  return { close, fileNames, handle, write, writes };
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
});
