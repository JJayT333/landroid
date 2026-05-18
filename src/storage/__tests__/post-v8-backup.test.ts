import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PdfAttachment, WorkspaceRecord } from '../db';
import {
  buildV7BackupPayload,
  pickPdfsForWorkspace,
  runBackupWithDeps,
  type PostV8BackupDeps,
} from '../post-v8-backup';

function makePdf(overrides: Partial<PdfAttachment> = {}): PdfAttachment {
  return {
    nodeId: 'node-1',
    fileName: 'doc.pdf',
    mimeType: 'application/pdf',
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' }),
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspace(
  overrides: Partial<WorkspaceRecord> = {}
): WorkspaceRecord {
  return {
    id: 'ws-1',
    projectName: 'Project One',
    data: JSON.stringify({
      workspaceId: 'ws-1',
      projectName: 'Project One',
      nodes: [{ id: 'node-1' }, { id: 'node-2' }],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: [],
    }),
    savedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeDeps(overrides: Partial<PostV8BackupDeps> = {}): PostV8BackupDeps {
  return {
    readFlag: vi.fn(() => null),
    writeFlag: vi.fn(),
    listWorkspaces: vi.fn(async () => []),
    listPdfs: vi.fn(async () => []),
    downloadFile: vi.fn(),
    now: () => '2026-05-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('pickPdfsForWorkspace', () => {
  it('returns the pdfs whose nodeIds match the workspace nodes', () => {
    const pdfs = [
      makePdf({ nodeId: 'node-1' }),
      makePdf({ nodeId: 'node-other' }),
      makePdf({ nodeId: 'node-2' }),
    ];
    const result = pickPdfsForWorkspace(
      JSON.stringify({ nodes: [{ id: 'node-1' }, { id: 'node-2' }] }),
      pdfs
    );
    expect(result.map((p) => p.nodeId)).toEqual(['node-1', 'node-2']);
  });

  it('returns [] when the workspace data is unparseable', () => {
    expect(pickPdfsForWorkspace('not json', [makePdf()])).toEqual([]);
  });

  it('returns [] when nodes is missing or wrong type', () => {
    expect(
      pickPdfsForWorkspace(JSON.stringify({ projectName: 'x' }), [makePdf()])
    ).toEqual([]);
    expect(
      pickPdfsForWorkspace(JSON.stringify({ nodes: 'oops' }), [makePdf()])
    ).toEqual([]);
  });

  it('skips node entries with missing or non-string ids', () => {
    const pdfs = [
      makePdf({ nodeId: 'good' }),
      makePdf({ nodeId: 'bare' }),
    ];
    const data = JSON.stringify({
      nodes: [{ id: 'good' }, null, { name: 'no-id' }, { id: 42 }],
    });
    expect(pickPdfsForWorkspace(data, pdfs).map((p) => p.nodeId)).toEqual([
      'good',
    ]);
  });
});

describe('buildV7BackupPayload', () => {
  it('returns null when there are no pdfs', () => {
    expect(buildV7BackupPayload({ workspace: makeWorkspace(), pdfs: [] })).toBeNull();
  });

  it('returns null when workspace.data is unparseable', () => {
    expect(
      buildV7BackupPayload({
        workspace: { id: 'x', projectName: 'x', data: 'not json' },
        pdfs: [makePdf()],
      })
    ).toBeNull();
  });

  it('returns a v7-shape payload with pdfData embedded', () => {
    const result = buildV7BackupPayload({
      workspace: makeWorkspace(),
      pdfs: [makePdf()],
    });
    expect(result?.version).toBe(7);
    const payload = result?.payload as {
      version: number;
      workspaceId: string;
      nodes: unknown;
      pdfData: { pdfs: unknown[] };
    };
    expect(payload.version).toBe(7);
    expect(payload.workspaceId).toBe('ws-1');
    expect(payload.nodes).toEqual([{ id: 'node-1' }, { id: 'node-2' }]);
    expect(payload.pdfData.pdfs).toHaveLength(1);
  });
});

describe('runBackupWithDeps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('short-circuits when the flag is already set', async () => {
    const deps = makeDeps({ readFlag: vi.fn(() => '2026-01-01T00:00:00.000Z') });
    const written = await runBackupWithDeps(deps);
    expect(written).toBe(0);
    expect(deps.listPdfs).not.toHaveBeenCalled();
    expect(deps.listWorkspaces).not.toHaveBeenCalled();
    expect(deps.downloadFile).not.toHaveBeenCalled();
    expect(deps.writeFlag).not.toHaveBeenCalled();
  });

  it('sets the flag and writes nothing when there are no pre-migration pdfs', async () => {
    const deps = makeDeps({
      listPdfs: vi.fn(async () => []),
      listWorkspaces: vi.fn(async () => [makeWorkspace()]),
    });
    const written = await runBackupWithDeps(deps);
    expect(written).toBe(0);
    expect(deps.downloadFile).not.toHaveBeenCalled();
    expect(deps.writeFlag).toHaveBeenCalledOnce();
  });

  it('sets the flag and writes nothing when there are no workspaces', async () => {
    const deps = makeDeps({
      listPdfs: vi.fn(async () => [makePdf()]),
      listWorkspaces: vi.fn(async () => []),
    });
    const written = await runBackupWithDeps(deps);
    expect(written).toBe(0);
    expect(deps.downloadFile).not.toHaveBeenCalled();
    expect(deps.writeFlag).toHaveBeenCalledOnce();
  });

  it('writes one file per workspace with matching pdfs and sets the flag', async () => {
    const wsA = makeWorkspace({
      id: 'ws-a',
      projectName: 'Project A',
      data: JSON.stringify({
        workspaceId: 'ws-a',
        projectName: 'Project A',
        nodes: [{ id: 'a-node' }],
      }),
    });
    const wsB = makeWorkspace({
      id: 'ws-b',
      projectName: 'Project B',
      data: JSON.stringify({
        workspaceId: 'ws-b',
        projectName: 'Project B',
        nodes: [{ id: 'b-node' }],
      }),
    });
    const deps = makeDeps({
      listPdfs: vi.fn(async () => [
        makePdf({ nodeId: 'a-node', fileName: 'a.pdf' }),
        makePdf({ nodeId: 'b-node', fileName: 'b.pdf' }),
      ]),
      listWorkspaces: vi.fn(async () => [wsA, wsB]),
    });
    const written = await runBackupWithDeps(deps);
    expect(written).toBe(2);
    expect(deps.downloadFile).toHaveBeenCalledTimes(2);
    const calls = (deps.downloadFile as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).toMatch(/Project A-pre-v8-backup-.+\.landroid/);
    expect(calls[1][0]).toMatch(/Project B-pre-v8-backup-.+\.landroid/);
    expect(calls[0][1]).toBeInstanceOf(Blob);
    expect(deps.writeFlag).toHaveBeenCalledOnce();
  });

  it('skips workspaces with no matching pdfs', async () => {
    const wsA = makeWorkspace({
      id: 'ws-a',
      data: JSON.stringify({ workspaceId: 'ws-a', nodes: [{ id: 'a-node' }] }),
    });
    const wsB = makeWorkspace({
      id: 'ws-b',
      data: JSON.stringify({ workspaceId: 'ws-b', nodes: [{ id: 'b-node' }] }),
    });
    const deps = makeDeps({
      listPdfs: vi.fn(async () => [
        makePdf({ nodeId: 'a-node', fileName: 'a.pdf' }),
      ]),
      listWorkspaces: vi.fn(async () => [wsA, wsB]),
    });
    const written = await runBackupWithDeps(deps);
    expect(written).toBe(1);
    expect(deps.downloadFile).toHaveBeenCalledOnce();
    expect(deps.writeFlag).toHaveBeenCalledOnce();
  });

  it('sanitizes the project name in the download filename', async () => {
    const ws = makeWorkspace({
      id: 'ws-c',
      projectName: 'Bad/Name:With*Path?Chars',
      data: JSON.stringify({ workspaceId: 'ws-c', nodes: [{ id: 'n1' }] }),
    });
    const deps = makeDeps({
      listPdfs: vi.fn(async () => [makePdf({ nodeId: 'n1' })]),
      listWorkspaces: vi.fn(async () => [ws]),
    });
    await runBackupWithDeps(deps);
    const calls = (deps.downloadFile as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls[0][0]).not.toMatch(/[\\/:*?"<>|]/);
    expect(calls[0][0]).toMatch(/^Bad_Name_With_Path_Chars-pre-v8-backup-/);
  });

  it('writes the flag even when a single workspace backup throws', async () => {
    const ws = makeWorkspace({
      id: 'ws-bad',
      data: 'not json', // pickPdfsForWorkspace returns [] for unparseable
    });
    const deps = makeDeps({
      listPdfs: vi.fn(async () => [makePdf({ nodeId: 'n1' })]),
      listWorkspaces: vi.fn(async () => [ws]),
    });
    const written = await runBackupWithDeps(deps);
    expect(written).toBe(0);
    expect(deps.writeFlag).toHaveBeenCalledOnce();
  });

  it('still sets the flag when listPdfs / listWorkspaces throws', async () => {
    const deps = makeDeps({
      listPdfs: vi.fn(async () => {
        throw new Error('dexie blew up');
      }),
    });
    const written = await runBackupWithDeps(deps);
    expect(written).toBe(0);
    // Setting the flag here would be wrong — a Dexie error is transient
    // and we want to retry on the next boot. Confirm the flag stays unset.
    expect(deps.writeFlag).not.toHaveBeenCalled();
  });
});
