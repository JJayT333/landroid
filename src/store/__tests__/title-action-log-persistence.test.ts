/**
 * T2b title-ledger runtime lifecycle. Synthetic fixtures only.
 *
 * These tests keep the live workspace store and title action log real, while
 * mocking the Dexie ledger boundary so refresh/import precedence can be tested
 * without IndexedDB.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankOwner } from '../../types/owner';
import { createBlankNode, normalizeOwnershipNode, type OwnershipNode } from '../../types/node';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import type { TitleLedgerWorkspaceRows } from '../../storage/title-ledger-stores';
import { buildProjectRecordBundle } from '../../project-records/record-validation';
import { verifyAuditChain } from '../../project-records/action-layer/audit-chain';

const docMocks = vi.hoisted(() => ({
  deleteDocsForAttachments: vi.fn(),
  detachDocFromEntity: vi.fn(),
  renameDoc: vi.fn(),
  reorderAttachments: vi.fn(),
  listAttachmentsForNodes: vi.fn(),
  saveDoc: vi.fn(),
}));
const otherMocks = vi.hoisted(() => ({
  unlinkNode: vi.fn(),
  unlinkDeskMap: vi.fn(),
}));
// DA-M15: the flush path is writer-gated; default to writable, override per test.
const leaseMocks = vi.hoisted(() => ({
  ensureWorkspaceWritable: vi.fn(async () => true),
  assertWorkspaceWriteFence: vi.fn(async () => {}),
}));
const ledgerPersistenceMocks = vi.hoisted(() => {
  type Rows = { actionRecords: unknown[]; auditEvents: unknown[] };
  const rowsByWorkspace = new Map<string, Rows>();
  const markerByWorkspace = new Map<string, string | null>();
  const clone = (rows: Rows): Rows => ({
    actionRecords: [...rows.actionRecords],
    auditEvents: [...rows.auditEvents],
  });
  const headOf = (rows: Rows): string | null =>
    (rows.auditEvents.at(-1) as { eventHash?: string } | undefined)?.eventHash ?? null;
  return {
    rowsByWorkspace,
    markerByWorkspace,
    listTitleLedgerWorkspaceRows: vi.fn(async (workspaceId: string) =>
      clone(rowsByWorkspace.get(workspaceId) ?? { actionRecords: [], auditEvents: [] })
    ),
    replaceTitleLedgerWorkspaceRows: vi.fn(async (workspaceId: string, rows: Rows) => {
      rowsByWorkspace.set(workspaceId, clone(rows));
      // Mirror the real flush: the head-hash marker is written atomically.
      markerByWorkspace.set(workspaceId, headOf(rows));
    }),
    readTitleLedgerHeadMarker: vi.fn(async (workspaceId: string) =>
      markerByWorkspace.has(workspaceId)
        ? {
            id: workspaceId,
            workspaceId,
            flushedHeadHash: markerByWorkspace.get(workspaceId) ?? null,
            flushedAt: '2020-01-01T00:00:00.000Z',
          }
        : null
    ),
    quarantineTitleLedgerRows: vi.fn(
      async (_input: {
        workspaceId: string;
        rows: Rows;
        reason: string;
        source: 'storage' | 'file';
        quarantinedAt: string;
      }) => undefined
    ),
  };
});

vi.mock('../../storage/document-store', () => docMocks);
vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({
      unlinkNode: otherMocks.unlinkNode,
      unlinkDeskMap: otherMocks.unlinkDeskMap,
    }),
  },
}));
vi.mock('../curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      unlinkNode: otherMocks.unlinkNode,
      unlinkDeskMap: vi.fn(),
      unlinkOwner: vi.fn(),
      unlinkLease: vi.fn(),
    }),
  },
}));
vi.mock('../../storage/title-ledger-persistence', () => ({
  listTitleLedgerWorkspaceRows:
    ledgerPersistenceMocks.listTitleLedgerWorkspaceRows,
  replaceTitleLedgerWorkspaceRows:
    ledgerPersistenceMocks.replaceTitleLedgerWorkspaceRows,
  readTitleLedgerHeadMarker:
    ledgerPersistenceMocks.readTitleLedgerHeadMarker,
  quarantineTitleLedgerRows:
    ledgerPersistenceMocks.quarantineTitleLedgerRows,
}));
vi.mock('../../storage/workspace-write-lease', () => leaseMocks);

import { useOwnerStore } from '../owner-store';
import { useWorkspaceStore } from '../workspace-store';
import {
  ensureTitleBaseline,
  flushTitleActionLogToStorage,
  hydrateTitleActionLogFromImportedLedger,
  hydrateTitleActionLogFromStorageOrBaseline,
  settleTitleActionLog,
  useTitleActionLog,
} from '../title-action-log';

function titleNode(overrides: Partial<OwnershipNode> & { id: string }): OwnershipNode {
  return normalizeOwnershipNode({ ...createBlankNode(overrides.id), ...overrides });
}

function makeWorkspace(
  workspaceId: string,
  rootId: string,
  docNo: string
): WorkspaceData {
  const nodes = [
    titleNode({
      id: rootId,
      grantor: 'State of Texas',
      grantee: `${workspaceId} Owner`,
      instrument: 'Patent',
      docNo,
      fraction: '1.000000000',
      initialFraction: '1.000000000',
      interestClass: 'mineral',
      linkedOwnerId: `${workspaceId}-owner`,
    }),
  ];
  return {
    workspaceId,
    projectName: `${workspaceId} Runtime Ledger`,
    nodes,
    deskMaps: [
      {
        id: `${workspaceId}-dm-1`,
        name: 'Tract 1',
        code: 'T1',
        tractId: `${workspaceId}-tract-1`,
        grossAcres: '100',
        pooledAcres: '100',
        description: 'Synthetic tract',
        nodeIds: nodes.map((node) => node.id),
      },
    ],
    activeDeskMapId: `${workspaceId}-dm-1`,
    activeUnitCode: null,
    instrumentTypes: ['Patent'],
  };
}

function ownerDataFor(workspaceId: string) {
  return {
    owners: [
      createBlankOwner(workspaceId, {
        id: `${workspaceId}-owner`,
        name: `${workspaceId} Owner`,
        entityType: 'Company',
      }),
    ],
    leases: [],
  };
}

function loadWorkspaceIntoStores(workspace: WorkspaceData): void {
  const ownerData = ownerDataFor(workspace.workspaceId);
  useOwnerStore.setState(ownerData);
  useWorkspaceStore.setState({
    workspaceId: workspace.workspaceId,
    projectName: workspace.projectName,
    nodes: workspace.nodes,
    deskMaps: workspace.deskMaps,
    leaseholdUnit: workspace.leaseholdUnit,
    leaseholdAssignments: workspace.leaseholdAssignments ?? [],
    leaseholdOrris: workspace.leaseholdOrris ?? [],
    leaseholdTransferOrderEntries:
      workspace.leaseholdTransferOrderEntries ?? [],
    activeDeskMapId: workspace.activeDeskMapId,
    activeUnitCode: workspace.activeUnitCode,
    instrumentTypes: workspace.instrumentTypes,
    _hydrated: true,
    lastError: null,
    lastAudit: null,
    activeNodeId: null,
  });
}

function currentRows(): TitleLedgerWorkspaceRows {
  const state = useTitleActionLog.getState();
  return {
    actionRecords: [...state.actionRecords],
    auditEvents: [...state.auditEvents],
  };
}

async function buildBaselineRows(
  workspace: WorkspaceData
): Promise<TitleLedgerWorkspaceRows> {
  useTitleActionLog.getState().reset();
  useTitleActionLog.getState().setEnabled(true);
  await ensureTitleBaseline(workspace, ownerDataFor(workspace.workspaceId));
  await settleTitleActionLog();
  return currentRows();
}

describe('title action log runtime persistence lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ledgerPersistenceMocks.rowsByWorkspace.clear();
    ledgerPersistenceMocks.markerByWorkspace.clear();
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);
    useTitleActionLog.getState().reset();
    useTitleActionLog.getState().setEnabled(true);
  });

  it('reader-tab hydration stays memory-only: baseline is built but never flushed (DA-M15)', async () => {
    leaseMocks.ensureWorkspaceWritable.mockResolvedValue(false);
    try {
      const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
      loadWorkspaceIntoStores(workspace);

      const result = await hydrateTitleActionLogFromStorageOrBaseline(
        workspace,
        ownerDataFor(workspace.workspaceId)
      );

      // The reader still gets a working in-memory baseline…
      expect(result.source).toBe('baseline');
      expect(useTitleActionLog.getState().actionRecords.length).toBeGreaterThan(0);
      // …but never rewrites the writer's persisted rows.
      expect(ledgerPersistenceMocks.replaceTitleLedgerWorkspaceRows).not.toHaveBeenCalled();
    } finally {
      leaseMocks.ensureWorkspaceWritable.mockResolvedValue(true);
    }
  });

  it('drops a flush when the ledger is reset while the flush awaits (review fix)', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);
    await ensureTitleBaseline(workspace, ownerDataFor(workspace.workspaceId));
    await settleTitleActionLog();

    // Hold the flush inside its writability await, reset the ledger (as the
    // AI-undo restore path does), then let the flush resume: it must NOT
    // persist the emptied chain over the stored rows.
    let releaseFlush: (value: boolean) => void = () => {};
    leaseMocks.ensureWorkspaceWritable.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => {
        releaseFlush = resolve;
      })
    );
    const flush = flushTitleActionLogToStorage(workspace.workspaceId);
    // Let the flush pass settle and suspend on the writability gate.
    await new Promise((resolve) => setTimeout(resolve, 0));
    useTitleActionLog.getState().reset();
    releaseFlush(true);
    await flush;

    expect(ledgerPersistenceMocks.replaceTitleLedgerWorkspaceRows).not.toHaveBeenCalled();
  });

  it('flushes, refreshes, and hydrates the same ledger rows', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);
    await ensureTitleBaseline(workspace, ownerDataFor(workspace.workspaceId));
    await flushTitleActionLogToStorage(workspace.workspaceId);
    const beforeRefresh = currentRows();

    useTitleActionLog.getState().reset();
    expect(useTitleActionLog.getState().actionRecords).toHaveLength(0);

    const result = await hydrateTitleActionLogFromStorageOrBaseline(
      workspace,
      ownerDataFor(workspace.workspaceId)
    );

    expect(result.source).toBe('storage');
    expect(currentRows()).toEqual(beforeRefresh);
    expect(useTitleActionLog.getState().headHash).toBe(
      beforeRefresh.auditEvents.at(-1)?.eventHash
    );
    expect((await verifyAuditChain(useTitleActionLog.getState().auditEvents)).valid).toBe(true);
  });

  it('quarantines an invalid stored chain instead of erasing it (DA-H4)', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);

    // Build a valid baseline chain, then corrupt an event hash so the stored
    // chain fails verification on hydrate (a tamper/corruption stand-in).
    const valid = await buildBaselineRows(workspace);
    const corrupted: TitleLedgerWorkspaceRows = {
      actionRecords: valid.actionRecords,
      auditEvents: valid.auditEvents.map((event, index) =>
        index === 0 ? { ...event, eventHash: 'f'.repeat(64) } : event
      ),
    };
    ledgerPersistenceMocks.rowsByWorkspace.set(workspace.workspaceId, corrupted);
    useTitleActionLog.getState().reset();

    const result = await hydrateTitleActionLogFromStorageOrBaseline(
      workspace,
      ownerDataFor(workspace.workspaceId)
    );

    // Re-baselined fresh rather than hydrating the corrupt chain…
    expect(result.source).toBe('baseline');
    expect(
      (await verifyAuditChain(useTitleActionLog.getState().auditEvents)).valid
    ).toBe(true);
    // …but the rejected rows were PRESERVED (quarantined), not silently erased.
    expect(
      ledgerPersistenceMocks.quarantineTitleLedgerRows
    ).toHaveBeenCalledTimes(1);
    const quarantineCall =
      ledgerPersistenceMocks.quarantineTitleLedgerRows.mock.calls[0][0];
    expect(quarantineCall.source).toBe('storage');
    expect(quarantineCall.rows.auditEvents).toHaveLength(
      corrupted.auditEvents.length
    );
    // …and a notice is surfaced for the banner, flagged durably persisted.
    const notice = useTitleActionLog.getState().lastQuarantine;
    expect(notice?.source).toBe('storage');
    expect(notice?.auditEventCount).toBe(corrupted.auditEvents.length);
    expect(notice?.durablyPersisted).toBe(true);
  });

  it('quarantines an internally-valid chain whose head contradicts the flushed marker (DA-H4 truncate-to-legacy)', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);

    // The stored chain is internally VALID (passes verifyAuditChain), but the
    // head-hash marker pins a DIFFERENT head — the stand-in for a hashed chain
    // truncated/replaced with a re-hashed legacy chain that still self-verifies.
    const persisted = await buildBaselineRows(workspace);
    ledgerPersistenceMocks.rowsByWorkspace.set(workspace.workspaceId, persisted);
    ledgerPersistenceMocks.markerByWorkspace.set(
      workspace.workspaceId,
      'a'.repeat(64) // != the stored head ⇒ the chain was replaced
    );
    useTitleActionLog.getState().reset();

    const result = await hydrateTitleActionLogFromStorageOrBaseline(
      workspace,
      ownerDataFor(workspace.workspaceId)
    );

    // Re-baselined fresh rather than hydrating the replaced chain…
    expect(result.source).toBe('baseline');
    expect(
      (await verifyAuditChain(useTitleActionLog.getState().auditEvents)).valid
    ).toBe(true);
    // …and the rejected chain was quarantined with the head-marker reason.
    expect(ledgerPersistenceMocks.quarantineTitleLedgerRows).toHaveBeenCalledTimes(1);
    const quarantineCall =
      ledgerPersistenceMocks.quarantineTitleLedgerRows.mock.calls[0][0];
    expect(quarantineCall.source).toBe('storage');
    expect(quarantineCall.reason).toMatch(/head-hash marker/);
    expect(useTitleActionLog.getState().lastQuarantine?.reason).toMatch(
      /head-hash marker/
    );
  });

  it('hydrates a valid chain whose head MATCHES the flushed marker (no false positive)', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);

    const persisted = await buildBaselineRows(workspace);
    ledgerPersistenceMocks.rowsByWorkspace.set(workspace.workspaceId, persisted);
    // Marker agrees with the stored head — the normal post-flush reload.
    ledgerPersistenceMocks.markerByWorkspace.set(
      workspace.workspaceId,
      persisted.auditEvents.at(-1)?.eventHash ?? null
    );
    useTitleActionLog.getState().reset();

    const result = await hydrateTitleActionLogFromStorageOrBaseline(
      workspace,
      ownerDataFor(workspace.workspaceId)
    );

    expect(result.source).toBe('storage');
    expect(ledgerPersistenceMocks.quarantineTitleLedgerRows).not.toHaveBeenCalled();
  });

  it('still seals duplicate provenance into the re-baseline after quarantining an invalid chain', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);

    const valid = await buildBaselineRows(workspace);
    const corrupted: TitleLedgerWorkspaceRows = {
      actionRecords: valid.actionRecords,
      auditEvents: valid.auditEvents.map((event, index) =>
        index === 0 ? { ...event, eventHash: 'f'.repeat(64) } : event
      ),
    };
    ledgerPersistenceMocks.rowsByWorkspace.set(workspace.workspaceId, corrupted);
    useTitleActionLog.getState().reset();

    const provenance = {
      kind: 'duplicate' as const,
      sourceWorkspaceId: 'ws-source',
      sourceProjectName: 'Source',
      duplicatedAt: '2026-06-20T00:00:00.000Z',
      sourceNodeCount: 1,
      sourceLedgerHeadHash: 'src-head',
    };

    const result = await hydrateTitleActionLogFromStorageOrBaseline(
      workspace,
      ownerDataFor(workspace.workspaceId),
      provenance
    );

    // The corrupt chain is quarantined and a fresh baseline is recorded — and the
    // duplicate's lineage rides through the quarantine path into that baseline.
    expect(result.source).toBe('baseline');
    const baseline = useTitleActionLog
      .getState()
      .actionRecords.find((record) => record.actionKind === 'title.baseline');
    expect((baseline?.result as { provenance?: unknown }).provenance).toEqual(provenance);
    expect(
      (await verifyAuditChain(useTitleActionLog.getState().auditEvents)).valid
    ).toBe(true);
  });

  it('flags the quarantine notice when the durable copy fails (DA-H4/F2)', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);
    const valid = await buildBaselineRows(workspace);
    const corrupted: TitleLedgerWorkspaceRows = {
      actionRecords: valid.actionRecords,
      auditEvents: valid.auditEvents.map((event, index) =>
        index === 0 ? { ...event, eventHash: 'f'.repeat(64) } : event
      ),
    };
    ledgerPersistenceMocks.rowsByWorkspace.set(workspace.workspaceId, corrupted);
    // The durable quarantine put fails (e.g. quota) — must NOT be reported as
    // "retained", since the live rows are about to be re-baselined away.
    ledgerPersistenceMocks.quarantineTitleLedgerRows.mockRejectedValueOnce(
      new Error('QuotaExceededError')
    );
    useTitleActionLog.getState().reset();

    const result = await hydrateTitleActionLogFromStorageOrBaseline(
      workspace,
      ownerDataFor(workspace.workspaceId)
    );

    expect(result.source).toBe('baseline');
    const notice = useTitleActionLog.getState().lastQuarantine;
    expect(notice).not.toBeNull();
    expect(notice?.durablyPersisted).toBe(false);
  });

  it('quarantines an invalid IMPORTED file ledger, source file (DA-H4/F3)', async () => {
    const workspace = makeWorkspace('ws-runtime-file', 'root-file', 'FILE-1');
    loadWorkspaceIntoStores(workspace);
    const fileRows = await buildBaselineRows(workspace);
    // Corrupt the file bundle's chain so it fails verification on import.
    const corruptedAudit = fileRows.auditEvents.map((event, index) =>
      index === 0 ? { ...event, eventHash: 'f'.repeat(64) } : event
    );
    const fileLedger = buildProjectRecordBundle({
      workspaceId: workspace.workspaceId,
      projectId: workspace.workspaceId,
      generatedAt: '2026-06-04T12:00:00.000Z',
      records: [...fileRows.actionRecords, ...corruptedAudit],
    });

    useTitleActionLog.getState().reset();
    const result = await hydrateTitleActionLogFromImportedLedger(
      workspace,
      fileLedger,
      ownerDataFor(workspace.workspaceId)
    );

    expect(result.source).toBe('baseline');
    expect(ledgerPersistenceMocks.quarantineTitleLedgerRows).toHaveBeenCalledTimes(1);
    expect(
      ledgerPersistenceMocks.quarantineTitleLedgerRows.mock.calls[0][0].source
    ).toBe('file');
    expect(useTitleActionLog.getState().lastQuarantine?.source).toBe('file');
  });

  it('continues the audit chain from the persisted head after hydrate', async () => {
    const workspace = makeWorkspace('ws-runtime', 'root-runtime', 'DOC-1');
    loadWorkspaceIntoStores(workspace);
    const persistedRows = await buildBaselineRows(workspace);
    ledgerPersistenceMocks.rowsByWorkspace.set(workspace.workspaceId, persistedRows);

    useTitleActionLog.getState().reset();
    await hydrateTitleActionLogFromStorageOrBaseline(
      workspace,
      ownerDataFor(workspace.workspaceId)
    );
    const persistedHead = persistedRows.auditEvents.at(-1)?.eventHash;

    useWorkspaceStore.getState().updateNode('root-runtime', {
      docNo: 'DOC-2',
      remarks: 'edited after hydrate',
    });
    await settleTitleActionLog();

    const log = useTitleActionLog.getState();
    expect(log.auditEvents).toHaveLength(persistedRows.auditEvents.length + 1);
    expect(log.auditEvents.at(-1)?.previousHash).toBe(persistedHead);
    expect((await verifyAuditChain(log.auditEvents)).valid).toBe(true);
  });

  it('hydrates only the loaded workspace after a workspace swap', async () => {
    const workspaceA = makeWorkspace('ws-runtime-a', 'root-a', 'A-1');
    const workspaceB = makeWorkspace('ws-runtime-b', 'root-b', 'B-1');
    const rowsA = await buildBaselineRows(workspaceA);
    const rowsB = await buildBaselineRows(workspaceB);
    ledgerPersistenceMocks.rowsByWorkspace.set(workspaceA.workspaceId, rowsA);
    ledgerPersistenceMocks.rowsByWorkspace.set(workspaceB.workspaceId, rowsB);

    useWorkspaceStore.getState().loadWorkspace(workspaceB);
    loadWorkspaceIntoStores(workspaceB);
    const result = await hydrateTitleActionLogFromStorageOrBaseline(
      workspaceB,
      ownerDataFor(workspaceB.workspaceId)
    );

    expect(result.source).toBe('storage');
    expect(useTitleActionLog.getState().actionRecords).toEqual(rowsB.actionRecords);
    expect(useTitleActionLog.getState().actionRecords).not.toEqual(rowsA.actionRecords);
    expect(
      useTitleActionLog
        .getState()
        .actionRecords.every((record) => record.workspaceId === workspaceB.workspaceId)
    ).toBe(true);
  });

  it('uses an imported v9 file ledger over stale Dexie rows and mirrors it back', async () => {
    const workspace = makeWorkspace('ws-runtime-file', 'root-file', 'FILE-1');
    const staleRows = await buildBaselineRows(
      makeWorkspace('ws-runtime-file', 'root-file', 'STALE-1')
    );
    const fileRows = await buildBaselineRows(workspace);
    ledgerPersistenceMocks.rowsByWorkspace.set(workspace.workspaceId, staleRows);
    const fileLedger = buildProjectRecordBundle({
      workspaceId: workspace.workspaceId,
      projectId: workspace.workspaceId,
      generatedAt: '2026-06-04T12:00:00.000Z',
      records: [...fileRows.actionRecords, ...fileRows.auditEvents],
    });

    useTitleActionLog.getState().reset();
    const result = await hydrateTitleActionLogFromImportedLedger(
      workspace,
      fileLedger,
      ownerDataFor(workspace.workspaceId)
    );

    expect(result.source).toBe('file');
    expect(currentRows()).toEqual(fileRows);
    expect(ledgerPersistenceMocks.rowsByWorkspace.get(workspace.workspaceId)).toEqual(fileRows);
    expect(ledgerPersistenceMocks.listTitleLedgerWorkspaceRows).not.toHaveBeenCalled();
  });
});
