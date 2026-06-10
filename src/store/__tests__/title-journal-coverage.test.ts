/**
 * DA-C1 exit gate — title journal coverage.
 *
 * THE Scope B invariant, as CI: every workspace-store action whose execution
 * changes the title slice (instrument_record + interest_reference — the
 * records the durable ledger replays) must fire the title journal hook. The
 * check is semantic, not a name list: each driver runs the real store and the
 * test diffs the adapter's title records before/after. 'title' drivers must
 * change the slice AND journal; 'non-title' drivers must provably not change
 * the slice (so a later adapter change that makes one title-visible fails
 * here and forces journaling). The completeness guard fails the suite when a
 * new store action ships without a classified driver.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLease, createBlankOwner, type Lease } from '../../types/owner';
import { createBlankNode, normalizeOwnershipNode, type OwnershipNode } from '../../types/node';

const docMocks = vi.hoisted(() => ({
  deleteDocsForAttachments: vi.fn(async () => {}),
  detachDocFromEntity: vi.fn(async () => {}),
  renameDoc: vi.fn(async () => {}),
  reorderAttachments: vi.fn(async () => {}),
  listAttachmentsForNodes: vi.fn(async () => new Map()),
  saveDoc: vi.fn(async () => ({
    document: { docId: 'doc-new', fileName: 'new.pdf', kind: 'other' },
    attachment: { attachmentId: 'att-new' },
  })),
}));
const otherMocks = vi.hoisted(() => ({ unlinkNode: vi.fn(), unlinkDeskMap: vi.fn() }));

vi.mock('../../storage/document-store', () => docMocks);
vi.mock('../map-store', () => ({
  useMapStore: {
    getState: () => ({ unlinkNode: otherMocks.unlinkNode, unlinkDeskMap: otherMocks.unlinkDeskMap }),
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

import { useWorkspaceStore, setTitleJournalHook } from '../workspace-store';
import { useOwnerStore } from '../owner-store';
import { titleRecordsFromWorkspace } from '../../project-records/action-layer/title-projection';
import { canonicalJson } from '../../project-records/action-layer/canonical-json';
import type { WorkspaceData } from '../../storage/workspace-persistence';

type Store = ReturnType<typeof useWorkspaceStore.getState>;
type ActionName = {
  [K in keyof Store]-?: Store[K] extends (...args: never[]) => unknown ? K : never;
}[keyof Store];

const WS = 'ws-journal-coverage';
const GENERATED_AT = '2026-06-10T00:00:00.000Z';
const LEASE: Lease = createBlankLease(WS, 'owner-1', {
  id: 'lease-1',
  leaseName: 'Coverage Lease',
  lessee: 'Operator A',
  royaltyRate: '1/8',
  leasedInterest: '1/2',
  effectiveDate: '2026-01-01',
  jurisdiction: 'tx_fee',
});

function titleNode(overrides: Partial<OwnershipNode> & { id: string }): OwnershipNode {
  return normalizeOwnershipNode({ ...createBlankNode(overrides.id), ...overrides });
}

function seed(): void {
  useOwnerStore.setState({
    owners: [createBlankOwner(WS, { id: 'owner-1', name: 'Acme Minerals LLC', entityType: 'Company' })],
    leases: [LEASE],
  });
  useWorkspaceStore.setState({
    workspaceId: WS,
    projectName: 'Journal Coverage',
    nodes: [
      titleNode({
        id: 'root',
        grantor: 'State of Texas',
        // Differs from the linked owner's name on purpose: while linked, the
        // adapter derives the grantee party from the owner record; clearing
        // the link falls back to this text and must change the title records.
        grantee: 'Acme Minerals',
        instrument: 'Patent',
        docNo: 'R-1',
        fraction: '0.400000000',
        initialFraction: '0.650000000',
        interestClass: 'mineral',
        linkedOwnerId: 'owner-1',
        attachments: [
          { docId: 'doc-1', attachmentId: 'att-1', fileName: 'patent.pdf', kind: 'deed' },
          { docId: 'doc-2', attachmentId: 'att-2', fileName: 'deed.pdf', kind: 'deed' },
        ],
      }),
      titleNode({
        id: 'child',
        parentId: 'root',
        grantor: 'Acme Minerals LLC',
        grantee: 'Child Heir',
        instrument: 'Deed',
        docNo: 'C-1',
        fraction: '0.250000000',
        initialFraction: '0.250000000',
        interestClass: 'mineral',
        linkedLeaseId: 'lease-1',
      }),
      titleNode({
        id: 'orphan',
        grantee: 'Orphan Owner',
        instrument: 'Deed',
        docNo: 'O-1',
        fraction: '0.250000000',
        initialFraction: '0.250000000',
        interestClass: 'mineral',
      }),
    ],
    deskMaps: [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: 'tract-1',
        grossAcres: '100',
        pooledAcres: '100',
        description: '',
        nodeIds: ['root', 'child'],
      },
      {
        id: 'dm-2',
        name: 'Tract 2',
        code: 'T2',
        tractId: 'tract-2',
        grossAcres: '50',
        pooledAcres: '50',
        description: '',
        nodeIds: [],
      },
    ],
    leaseholdAssignments: [],
    leaseholdOrris: [],
    leaseholdTransferOrderEntries: [],
    activeDeskMapId: 'dm-1',
    activeUnitCode: null,
    instrumentTypes: ['Patent', 'Deed'],
    lastError: null,
    lastAudit: null,
    activeNodeId: null,
  });
}

function currentWorkspaceData(): WorkspaceData {
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

/** Canonical JSON of the current title slice (sorted; fixed generatedAt). */
function titleSlice(): string {
  const workspace = currentWorkspaceData();
  const owner = useOwnerStore.getState();
  const records = titleRecordsFromWorkspace({
    workspace,
    ownerData: { owners: owner.owners, leases: owner.leases },
    projectId: workspace.workspaceId,
    generatedAt: GENERATED_AT,
  });
  return canonicalJson(
    [...records].sort((a, b) => (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
  );
}

type Expectation = 'title' | 'non-title' | { exempt: string };

interface ActionDriver {
  expectation: Expectation;
  drive: (store: Store) => unknown;
}

/**
 * One driver per store action. 'title' = the drive changes title records and
 * therefore MUST journal. 'non-title' = the drive provably changes no title
 * record. Exempt actions document why the rule does not apply to them.
 */
const DRIVERS: Record<ActionName, ActionDriver> = {
  // Engine/title mutations
  convey: { expectation: 'title', drive: (s) => s.convey('root', 'c2', '0.1', { grantee: 'C2' }) },
  createNpri: {
    expectation: 'title',
    drive: (s) => s.createNpri('root', 'npri-1', '0.0625', { grantee: 'NPRI Holder' }),
  },
  createRootNode: {
    expectation: 'title',
    drive: (s) => s.createRootNode('root-2', '0.1', { grantee: 'New Root' }),
  },
  rebalance: { expectation: 'title', drive: (s) => s.rebalance('child', '0.2') },
  insertPredecessor: {
    expectation: 'title',
    drive: (s) => s.insertPredecessor('child', 'pred', '0.25', { grantee: 'Predecessor' }),
  },
  attachConveyance: {
    expectation: 'title',
    drive: (s) => s.attachConveyance('orphan', 'root', '0.1', { grantee: 'Orphan Owner' }),
  },
  batchAttachConveyance: {
    expectation: 'title',
    drive: (s) =>
      s.batchAttachConveyance([
        { activeNodeId: 'orphan', attachParentId: 'root', calcShare: '0.1', form: {} },
      ]),
  },
  attachLease: { expectation: 'title', drive: (s) => s.attachLease('root', LEASE, 'ln-1') },
  addNode: {
    expectation: 'title',
    drive: (s) =>
      s.addNode(titleNode({ id: 'n9', grantee: 'Loose Node', fraction: '0.050000000', initialFraction: '0.050000000' })),
  },
  updateNode: {
    expectation: 'title',
    // docNo + remarks project (recordingReference / summary) regardless of
    // owner linkage; grantee text on a linked node would not.
    drive: (s) => s.updateNode('root', { docNo: 'R-2', remarks: 'edited' }),
  },
  removeNode: { expectation: 'title', drive: (s) => s.removeNode('child') },
  clearLinkedOwner: { expectation: 'title', drive: (s) => s.clearLinkedOwner('owner-1') },
  clearLinkedLease: { expectation: 'title', drive: (s) => s.clearLinkedLease('lease-1') },
  syncLeaseNodesFromRecord: {
    expectation: 'title',
    drive: (s) => {
      // Setup: this action needs a lease node to resync. attachLease both
      // changes the slice and journals, which would mask a missing journal
      // call in the target action — reset the spy so the gate's hook
      // assertion tests syncLeaseNodesFromRecord's OWN call.
      s.attachLease('root', LEASE, 'ln-1');
      hookCalls.length = 0;
      s.syncLeaseNodesFromRecord({ ...LEASE, royaltyRate: '1/6' });
    },
  },
  // Desk-map membership (interest_reference.deskMapIds)
  clearDeskMapNodes: { expectation: 'title', drive: (s) => s.clearDeskMapNodes('dm-1') },
  deleteDeskMap: { expectation: 'title', drive: (s) => s.deleteDeskMap('dm-1') },
  createDeskMap: { expectation: 'title', drive: (s) => s.createDeskMap('Tract 3', 'T3', ['orphan']) },
  addNodeToDeskMap: { expectation: 'title', drive: (s) => s.addNodeToDeskMap('orphan', 'dm-2') },
  addNodeToActiveDeskMap: { expectation: 'title', drive: (s) => s.addNodeToActiveDeskMap('orphan') },
  // Attachment cache (instrument_record.documentId = attachments[0].docId)
  attachDocToNode: {
    expectation: 'title',
    drive: (s) => s.attachDocToNode('child', new Blob(['x']), { fileName: 'new.pdf' }),
  },
  detachDocFromNode: { expectation: 'title', drive: (s) => s.detachDocFromNode('root', 'att-1') },
  reorderNodeAttachments: {
    expectation: 'title',
    drive: (s) => s.reorderNodeAttachments('root', ['att-2', 'att-1']),
  },
  renameDocOnNode: { expectation: 'non-title', drive: (s) => s.renameDocOnNode('doc-1', 'renamed.pdf') },
  // Selection / metadata / leasehold-only state
  setProjectName: { expectation: 'non-title', drive: (s) => s.setProjectName('Renamed Project') },
  updateLeaseholdUnit: { expectation: 'non-title', drive: (s) => s.updateLeaseholdUnit({ name: 'Unit A' }) },
  addLeaseholdAssignment: { expectation: 'non-title', drive: (s) => s.addLeaseholdAssignment({}) },
  updateLeaseholdAssignment: {
    expectation: 'non-title',
    drive: (s) => {
      const id = s.addLeaseholdAssignment({});
      s.updateLeaseholdAssignment(id, { assignee: 'Assignee LLC' });
    },
  },
  removeLeaseholdAssignment: {
    expectation: 'non-title',
    drive: (s) => {
      const id = s.addLeaseholdAssignment({});
      s.removeLeaseholdAssignment(id);
    },
  },
  addLeaseholdOrri: { expectation: 'non-title', drive: (s) => s.addLeaseholdOrri({}) },
  updateLeaseholdOrri: {
    expectation: 'non-title',
    drive: (s) => {
      const id = s.addLeaseholdOrri({});
      s.updateLeaseholdOrri(id, { payee: 'ORRI Payee' });
    },
  },
  removeLeaseholdOrri: {
    expectation: 'non-title',
    drive: (s) => {
      const id = s.addLeaseholdOrri({});
      s.removeLeaseholdOrri(id);
    },
  },
  upsertLeaseholdTransferOrderEntry: {
    expectation: 'non-title',
    drive: (s) => s.upsertLeaseholdTransferOrderEntry({ sourceRowId: 'row-1', ownerNumber: '123' }),
  },
  removeLeaseholdTransferOrderEntry: {
    expectation: 'non-title',
    drive: (s) => {
      s.upsertLeaseholdTransferOrderEntry({ sourceRowId: 'row-1', ownerNumber: '123' });
      s.removeLeaseholdTransferOrderEntry('row-1');
    },
  },
  setActiveNode: { expectation: 'non-title', drive: (s) => s.setActiveNode('root') },
  setActiveDeskMap: { expectation: 'non-title', drive: (s) => s.setActiveDeskMap('dm-2') },
  setActiveUnitCode: { expectation: 'non-title', drive: (s) => s.setActiveUnitCode(null) },
  addInstrumentType: { expectation: 'non-title', drive: (s) => s.addInstrumentType('Affidavit') },
  renameDeskMap: { expectation: 'non-title', drive: (s) => s.renameDeskMap('dm-1', 'Tract One') },
  updateDeskMapDetails: {
    expectation: 'non-title',
    drive: (s) => s.updateDeskMapDetails('dm-1', { description: 'updated' }),
  },
  getActiveDeskMapNodes: { expectation: 'non-title', drive: (s) => s.getActiveDeskMapNodes() },
  setHydrated: { expectation: 'non-title', drive: (s) => s.setHydrated() },
  setStartupWarning: { expectation: 'non-title', drive: (s) => s.setStartupWarning('warn') },
  undoLastTitleMutation: {
    expectation: 'title',
    // Two setup edits, then ONE undo: the net driver change is the first
    // edit's delta (so `changed` is true), and the spy reset isolates the
    // undo's OWN journal call — the restore must itself be journaled.
    drive: async (s) => {
      s.updateNode('root', { docNo: 'R-2', remarks: 'first edit' });
      s.updateNode('root', { docNo: 'R-3', remarks: 'second edit' });
      hookCalls.length = 0;
      await s.undoLastTitleMutation();
    },
  },
  // Lifecycle — outside the journal rule, each for a documented reason
  loadWorkspace: {
    expectation: {
      exempt:
        'workspace replacement resets the ledger by contract; re-hydration is the loader lifecycle’s duty (project-workspace-lifecycle / DA-H2)',
    },
    drive: (s) =>
      s.loadWorkspace({
        workspaceId: 'ws-other',
        projectName: 'Other',
        nodes: [],
        deskMaps: [],
        activeDeskMapId: null,
      }),
  },
  restoreTitleSlice: {
    expectation: {
      exempt:
        'restore primitive invoked BY the journal hook (cutover veto) and by undoLastTitleMutation, which journals the restore itself; journaling here would recurse',
    },
    drive: (s) => s.restoreTitleSlice(currentWorkspaceData()),
  },
  hydrateNodeAttachments: {
    expectation: {
      exempt:
        'boot-time cache reconciliation from Dexie during workspace load, before the ledger hydrate/baseline captures the post-hydration state; not a user mutation',
    },
    drive: (s) => s.hydrateNodeAttachments(),
  },
};

let hookCalls: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  seed();
  hookCalls = [];
  setTitleJournalHook((mutation) => {
    hookCalls.push(mutation);
  });
});

afterEach(() => {
  setTitleJournalHook(null);
});

describe('title journal coverage (DA-C1 exit gate)', () => {
  it('classifies every workspace-store action (completeness guard)', () => {
    const actionNames = Object.entries(useWorkspaceStore.getState())
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .sort();
    expect(actionNames).toEqual(Object.keys(DRIVERS).sort());
  });

  for (const [name, driver] of Object.entries(DRIVERS) as Array<[ActionName, ActionDriver]>) {
    const label =
      typeof driver.expectation === 'string' ? driver.expectation : 'exempt';
    it(`${name} [${label}]`, async () => {
      const before = titleSlice();
      await driver.drive(useWorkspaceStore.getState());
      const after = titleSlice();
      const changed = before !== after;
      if (driver.expectation === 'title') {
        // The driver must actually exercise title state (keeps drivers honest)…
        expect(changed).toBe(true);
        // …and THE invariant: a title-record change requires a journal call.
        expect(hookCalls.length).toBeGreaterThan(0);
      } else if (driver.expectation === 'non-title') {
        // Proves the classification: this action cannot change title records.
        expect(changed).toBe(false);
      }
      // exempt: lifecycle actions documented in the driver table; no assertion.
    });
  }
});
