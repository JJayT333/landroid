import { describe, expect, it } from 'vitest';

import {
  buildLeaseTractRows,
  planTractReconcile,
  seedTractDrafts,
  type LeaseTractRowDeskMap,
  type TractDraft,
} from '../lease-tract-rows';
import { createBlankNode, type OwnershipNode } from '../../../types/node';
import { createBlankLease, type Lease } from '../../../types/owner';

function mineralNode(
  id: string,
  overrides: Partial<OwnershipNode> = {}
): OwnershipNode {
  return {
    ...createBlankNode(id),
    grantee: 'Smith',
    fraction: '1',
    initialFraction: '1',
    interestClass: 'mineral',
    linkedOwnerId: 'owner-1',
    ...overrides,
  };
}

function leaseNode(
  id: string,
  parentId: string,
  linkedLeaseId: string
): OwnershipNode {
  return {
    ...createBlankNode(id, parentId),
    type: 'related',
    relatedKind: 'lease',
    fraction: '0',
    initialFraction: '0',
    linkedLeaseId,
  };
}

function slice(id: string, overrides: Partial<Lease> = {}): Lease {
  return createBlankLease('ws-1', 'owner-1', { id, ...overrides });
}

// Three tracts (desk maps), each carrying the same lessor's mineral node, plus
// one tract owned by a different party that must never appear as a row.
const m1 = mineralNode('m1');
const m2 = mineralNode('m2');
const m3 = mineralNode('m3');
const other = mineralNode('m-other', { linkedOwnerId: 'owner-2', grantee: 'Jones' });

const deskMaps: LeaseTractRowDeskMap[] = [
  { id: 'dm-1', name: 'Tract 1', nodeIds: ['m1'] },
  { id: 'dm-2', name: 'Tract 2', nodeIds: ['m2'] },
  { id: 'dm-3', name: 'Tract 3', nodeIds: ['m3', 'm-other'] },
];

describe('buildLeaseTractRows', () => {
  it('lists the lessor present mineral nodes across desk maps, excluding other owners', () => {
    const rows = buildLeaseTractRows({
      deskMaps,
      nodes: [m1, m2, m3, other],
      leases: [],
      ownerId: 'owner-1',
      leasePurchaseReportId: null,
    });
    expect(rows.map((row) => row.mineralNodeId)).toEqual(['m1', 'm2', 'm3']);
    expect(rows.map((row) => row.deskMapName)).toEqual([
      'Tract 1',
      'Tract 2',
      'Tract 3',
    ]);
    expect(rows.every((row) => row.existingLeaseId === null)).toBe(true);
  });

  it('marks a tract already covered by the report with its slice and node ids', () => {
    const l2 = slice('lease-2', { leasePurchaseReportId: 'lpr-1' });
    const rows = buildLeaseTractRows({
      deskMaps,
      nodes: [m1, m2, m3, leaseNode('ln-2', 'm2', 'lease-2')],
      leases: [l2],
      ownerId: 'owner-1',
      leasePurchaseReportId: 'lpr-1',
    });
    const row2 = rows.find((row) => row.mineralNodeId === 'm2');
    expect(row2?.existingLeaseId).toBe('lease-2');
    expect(row2?.existingLeaseNodeId).toBe('ln-2');
    expect(rows.find((row) => row.mineralNodeId === 'm1')?.existingLeaseId).toBeNull();
  });

  it('ignores lessee nodes that belong to a different report', () => {
    const lOther = slice('lease-x', { leasePurchaseReportId: 'lpr-other' });
    const rows = buildLeaseTractRows({
      deskMaps,
      nodes: [m1, m2, m3, leaseNode('ln-x', 'm2', 'lease-x')],
      leases: [lOther],
      ownerId: 'owner-1',
      leasePurchaseReportId: 'lpr-1',
    });
    expect(rows.find((row) => row.mineralNodeId === 'm2')?.existingLeaseId).toBeNull();
  });

  it('returns no rows when the owner is not linked yet', () => {
    const rows = buildLeaseTractRows({
      deskMaps,
      nodes: [m1, m2, m3],
      leases: [],
      ownerId: '',
      leasePurchaseReportId: null,
    });
    expect(rows).toEqual([]);
  });

  it('lists a node referenced by two desk maps only once', () => {
    const rows = buildLeaseTractRows({
      deskMaps: [
        { id: 'dm-1', name: 'Tract 1', nodeIds: ['m1'] },
        { id: 'dm-2', name: 'Tract 2', nodeIds: ['m1'] },
      ],
      nodes: [m1],
      leases: [],
      ownerId: 'owner-1',
      leasePurchaseReportId: null,
    });
    expect(rows).toHaveLength(1);
  });
});

describe('seedTractDrafts', () => {
  it('pre-checks the originating tract and seeds per-row lessor interest from the node', () => {
    const drafts = seedTractDrafts({
      parentNode: m1,
      ownerId: 'owner-1',
      deskMaps,
      nodes: [m1, m2, m3],
      leases: [],
      leasePurchaseReportId: null,
      activeDeskMapId: 'dm-1',
      originatingExistingLease: null,
      originatingExistingNodeId: null,
    });
    const originating = drafts.find((draft) => draft.mineralNodeId === 'm1');
    const sibling = drafts.find((draft) => draft.mineralNodeId === 'm2');
    expect(originating?.checked).toBe(true);
    expect(originating?.leasedInterest).toBe('1');
    // Other tracts are present but unchecked until the user opts them in.
    expect(sibling?.checked).toBe(false);
    expect(drafts).toHaveLength(3);
  });

  it('checks sibling tracts already covered by the report and seeds their slice fields', () => {
    const l2 = slice('lease-2', {
      leasePurchaseReportId: 'lpr-1',
      leasedInterest: '0.5',
      grossAcres: '40',
    });
    const drafts = seedTractDrafts({
      parentNode: m1,
      ownerId: 'owner-1',
      deskMaps,
      nodes: [m1, m2, m3, leaseNode('ln-2', 'm2', 'lease-2')],
      leases: [l2],
      leasePurchaseReportId: 'lpr-1',
      activeDeskMapId: 'dm-1',
      originatingExistingLease: null,
      originatingExistingNodeId: null,
    });
    const sibling = drafts.find((draft) => draft.mineralNodeId === 'm2');
    expect(sibling?.checked).toBe(true);
    expect(sibling?.existingLeaseId).toBe('lease-2');
    expect(sibling?.grossAcres).toBe('40');
    expect(sibling?.leasedInterest).toBe('0.5');
  });
});

describe('planTractReconcile', () => {
  function draft(overrides: Partial<TractDraft>): TractDraft {
    return {
      mineralNodeId: 'm1',
      deskMapId: 'dm-1',
      deskMapName: 'Tract 1',
      ownerLabel: 'Smith',
      checked: true,
      leaseName: '',
      leasedInterest: '1',
      grossAcres: '',
      status: 'Active',
      docNo: '',
      existingLeaseId: null,
      existingLeaseNodeId: null,
      ...overrides,
    };
  }

  it('creates a slice for every newly checked tract', () => {
    const plan = planTractReconcile([
      draft({ mineralNodeId: 'm1' }),
      draft({ mineralNodeId: 'm2' }),
      draft({ mineralNodeId: 'm3' }),
    ]);
    expect(plan.create.map((tract) => tract.mineralNodeId)).toEqual(['m1', 'm2', 'm3']);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('removes only the unchecked tract that was previously leased', () => {
    const plan = planTractReconcile([
      draft({ mineralNodeId: 'm1', existingLeaseId: 'lease-1' }),
      draft({ mineralNodeId: 'm2', existingLeaseId: 'lease-2', checked: false }),
      draft({ mineralNodeId: 'm3', existingLeaseId: null, checked: false }),
    ]);
    expect(plan.update.map((tract) => tract.mineralNodeId)).toEqual(['m1']);
    expect(plan.remove.map((tract) => tract.mineralNodeId)).toEqual(['m2']);
    // m3 was never leased and is unchecked: no-op.
    expect(plan.create).toEqual([]);
  });

  it('never both creates and updates the same tract', () => {
    const plan = planTractReconcile([
      draft({ mineralNodeId: 'm1', existingLeaseId: 'lease-1' }),
      draft({ mineralNodeId: 'm2', existingLeaseId: null }),
    ]);
    const createIds = new Set(plan.create.map((tract) => tract.mineralNodeId));
    const updateIds = new Set(plan.update.map((tract) => tract.mineralNodeId));
    expect([...createIds].some((id) => updateIds.has(id))).toBe(false);
  });
});
