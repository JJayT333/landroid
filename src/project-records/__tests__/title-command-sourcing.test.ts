/**
 * Phase 4 title cutover — the command-sourcing wrapper, exercised against the
 * REAL workspace store for all seven title mutations. Each mutation must produce
 * a durable ActionRecord + a hash-chained audit event, with inline parity clean.
 * No PII / synthetic fixtures only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLease, createBlankOwner } from '../../types/owner';
import type { Lease } from '../../types/owner';
import type { WorkspaceData } from '../../storage/workspace-persistence';

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

vi.mock('../../storage/document-store', () => docMocks);
vi.mock('../../store/map-store', () => ({
  useMapStore: {
    getState: () => ({ unlinkNode: otherMocks.unlinkNode, unlinkDeskMap: otherMocks.unlinkDeskMap }),
  },
}));
vi.mock('../../store/curative-store', () => ({
  useCurativeStore: {
    getState: () => ({
      unlinkNode: otherMocks.unlinkNode,
      unlinkDeskMap: vi.fn(),
      unlinkOwner: vi.fn(),
      unlinkLease: vi.fn(),
    }),
  },
}));

import { useWorkspaceStore } from '../../store/workspace-store';
import { verifyAuditChain } from '../action-layer/audit-chain';
import {
  applyTitleMutation,
  COMMAND_KIND_BY_TITLE_MUTATION,
  type TitleMutation,
} from '../action-layer/title-command-sourcing';
import { replayTitleProjection, reconstructTitleNodes, orderNodesLike } from '../action-layer/title-replay';
import { titleRecordsFromWorkspace } from '../action-layer/title-projection';
import { canonicalJson } from '../action-layer/canonical-json';
import type { RecordBuildContext } from '../record-helpers';
import type { ActionRecord, AuditEventRecord, BackendSpineCoreRecord } from '../../backend-spine/contracts';

function sortedJson(records: readonly BackendSpineCoreRecord[]): string {
  return canonicalJson(
    [...records].sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
  );
}

const NOW = '2026-06-01T12:00:00.000Z';
const WS = 'ws-title-cutover';

const OWNER = { id: 'owner-1', name: 'Acme Minerals LLC', entityType: 'Company' } as const;
const LEASE: Lease = createBlankLease(WS, OWNER.id, {
  id: 'lease-1',
  leaseName: 'Acme Lease',
  lessee: 'Operator A',
  royaltyRate: '1/8',
  leasedInterest: '1/2',
  effectiveDate: '2026-01-01',
  jurisdiction: 'tx_fee',
  createdAt: NOW,
  updatedAt: NOW,
});
const OWNER_DATA = {
  owners: [
    createBlankOwner(WS, {
      id: OWNER.id,
      name: OWNER.name,
      entityType: OWNER.entityType,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  ],
  leases: [LEASE],
};

function resetStore(): string {
  useWorkspaceStore.setState({
    workspaceId: WS,
    projectName: 'Title Cutover Test',
    nodes: [],
    deskMaps: [],
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: null,
    activeUnitCode: null,
    instrumentTypes: [],
    lastError: null,
    lastAudit: null,
    activeNodeId: null,
  });
  return useWorkspaceStore.getState().createDeskMap('Tract 1', 'T1');
}

function snapshot(): WorkspaceData {
  const s = useWorkspaceStore.getState();
  return {
    workspaceId: s.workspaceId,
    projectName: s.projectName,
    nodes: s.nodes,
    deskMaps: s.deskMaps,
    leaseholdUnit: s.leaseholdUnit,
    leaseholdAssignments: s.leaseholdAssignments,
    leaseholdOrris: s.leaseholdOrris,
    leaseholdTransferOrderEntries: s.leaseholdTransferOrderEntries,
    activeDeskMapId: s.activeDeskMapId,
    activeUnitCode: s.activeUnitCode,
    instrumentTypes: s.instrumentTypes,
  };
}

function context(): RecordBuildContext {
  return {
    workspaceId: WS,
    projectId: WS,
    generatedAt: NOW,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
  };
}

interface DrivenMutation {
  mutation: TitleMutation;
  run: () => boolean;
}

/**
 * Build a realistic chain via the real store, returning the seven mutations in
 * dependency order. Nodes carry no document attachments and only the lease-bound
 * node links an owner, so deleteNode's live cascade stays a no-op (no Dexie).
 */
function buildSevenMutations(): DrivenMutation[] {
  const store = () => useWorkspaceStore.getState();
  return [
    {
      mutation: 'createRootNode',
      run: () =>
        store().createRootNode('root', '1', {
          grantee: 'Root Owner',
          interestClass: 'mineral',
          linkedOwnerId: OWNER.id,
        }),
    },
    {
      mutation: 'convey',
      run: () => store().convey('root', 'child', '0.5', { grantee: 'Child Owner' }),
    },
    {
      mutation: 'createNpri',
      run: () => store().createNpri('root', 'npri', '0.125', { grantee: 'NPRI Owner' }),
    },
    {
      mutation: 'precede',
      run: () =>
        store().insertPredecessor('child', 'pred', '0.25', { grantee: 'Predecessor' }),
    },
    {
      // graftToParent: create an orphan root, then attach it under `root`.
      mutation: 'graftToParent',
      run: () => {
        const created = store().createRootNode('orphan', '0.5', { grantee: 'Orphan' });
        if (!created) return false;
        return store().attachConveyance('orphan', 'root', '0.25', { grantee: 'Orphan' });
      },
    },
    {
      mutation: 'attachLease',
      run: () => store().attachLease('root', LEASE, 'leasenode-1') !== null,
    },
    {
      mutation: 'deleteNode',
      run: () => {
        store().removeNode('npri');
        return !store().nodes.some((node) => node.id === 'npri');
      },
    },
  ];
}

describe('Phase 4 title command-sourcing wrapper (real store, 7 mutations)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a durable ActionRecord + audit event per mutation with clean inline parity', async () => {
    resetStore();
    const mutations = buildSevenMutations();
    const actionRecords: ActionRecord[] = [];
    const auditEvents: AuditEventRecord[] = [];
    let priorHeadHash: string | undefined;

    for (const { mutation, run } of mutations) {
      const outcome = await applyTitleMutation({
        mutation,
        origin: 'user',
        approvedBy: 'user',
        context: context(),
        appliedAt: NOW,
        ownerData: OWNER_DATA,
        readWorkspace: snapshot,
        runMutation: run,
        priorHeadHash,
      });

      expect(outcome.ok, `${mutation} should be recorded`).toBe(true);
      if (!outcome.ok) return;

      const { record } = outcome;
      // durable ActionRecord, correct kind, clean inline parity
      expect(record.actionRecord.recordType).toBe('action_record');
      expect(record.actionRecord.actionKind).toBe(COMMAND_KIND_BY_TITLE_MUTATION[mutation]);
      expect(record.actionRecord.status).toBe('applied');
      expect(record.parityReports.every((report) => report.clean)).toBe(true);
      // every mutation produced at least one record effect
      expect(record.command.recordEffects.length).toBeGreaterThan(0);

      actionRecords.push(record.actionRecord);
      auditEvents.push(record.auditEvent);
      priorHeadHash = record.auditHeadHash;
    }

    expect(actionRecords).toHaveLength(7);

    // the full audit chain verifies (append-only, tamper-evident)
    const verification = await verifyAuditChain(auditEvents);
    expect(verification.valid).toBe(true);
    expect(verification.length).toBe(7);

    // the accumulated durable log replays to exactly the final adapter output —
    // the log is self-sufficient (records AND nodes), proven against the real store.
    const finalWorkspace = snapshot();
    const adapterTitleRecords = titleRecordsFromWorkspace({
      workspace: finalWorkspace,
      ownerData: OWNER_DATA,
      projectId: WS,
      generatedAt: NOW,
    });
    expect(sortedJson(replayTitleProjection(actionRecords))).toBe(sortedJson(adapterTitleRecords));

    const reconstructed = orderNodesLike(
      reconstructTitleNodes(actionRecords),
      finalWorkspace.nodes.map((n) => n.id)
    );
    expect(reconstructed.map((n) => n.id)).toEqual(finalWorkspace.nodes.map((n) => n.id));
  });

  it('deleteNode emits tombstone effects and a node snapshot for the removed node', async () => {
    resetStore();
    useWorkspaceStore.getState().createRootNode('solo', '1', { grantee: 'Solo' });

    const outcome = await applyTitleMutation({
      mutation: 'deleteNode',
      origin: 'user',
      approvedBy: 'user',
      context: context(),
      appliedAt: NOW,
      ownerData: OWNER_DATA,
      readWorkspace: snapshot,
      runMutation: () => {
        useWorkspaceStore.getState().removeNode('solo');
        return !useWorkspaceStore.getState().nodes.some((n) => n.id === 'solo');
      },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.record.delta.deletedNodeIds).toContain('solo');
    expect(
      outcome.record.command.recordEffects.some((effect) => effect.op === 'delete')
    ).toBe(true);
  });
});
