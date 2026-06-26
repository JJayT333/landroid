import { describe, expect, it } from 'vitest';
import { collapseDuplicateLeaseRecords } from '../collapse-duplicate-leases';
import { buildLeaseNode } from '../../components/deskmap/deskmap-lease-node';
import { createBlankNode, type OwnershipNode } from '../../types/node';
import { createBlankLease, type Lease } from '../../types/owner';

const WS = 'ws-test';

// createBlankLease mints its own id; build records with explicit ids for the test.
function rec(id: string, ownerId: string, overrides: Partial<Lease> = {}): Lease {
  return {
    ...createBlankLease(WS, ownerId, {
      leaseName: 'OGML — Acme',
      lessee: 'Operator LLC',
      royaltyRate: '0.1875',
      docNo: 'DOC-1',
      status: 'Active',
      ...overrides,
    }),
    id,
  };
}

function ownerMineralNode(id: string): OwnershipNode {
  return {
    ...createBlankNode(id, 'root'),
    grantee: `Owner ${id}`,
    interestClass: 'mineral',
    fraction: '0.5',
    initialFraction: '0.5',
    linkedOwnerId: `owner-${id}`,
  };
}

function leaseNodeFor(id: string, parent: OwnershipNode, leaseRec: Lease): OwnershipNode {
  return buildLeaseNode({ id, parentNode: parent, lease: leaseRec });
}

describe('collapseDuplicateLeaseRecords', () => {
  it('collapses identical per-tract records of one instrument and repoints nodes', () => {
    const owner = 'owner-acme';
    const r1 = rec('lease-1', owner);
    const r2 = rec('lease-2', owner);
    const r3 = rec('lease-3', owner);
    const t1 = ownerMineralNode('m1');
    const t2 = ownerMineralNode('m2');
    const t3 = ownerMineralNode('m3');
    const ln1 = leaseNodeFor('ln1', t1, r1);
    const ln2 = leaseNodeFor('ln2', t2, r2);
    const ln3 = leaseNodeFor('ln3', t3, r3);

    const result = collapseDuplicateLeaseRecords(
      [r1, r2, r3],
      [t1, t2, t3, ln1, ln2, ln3]
    );

    expect(result.leases.map((l) => l.id)).toEqual(['lease-1']);
    expect(result.removedLeaseIds.sort()).toEqual(['lease-2', 'lease-3']);
    expect(result.repointedNodeIds.sort()).toEqual(['ln2', 'ln3']);
    const linked = result.nodes
      .filter((n) => n.relatedKind === 'lease')
      .map((n) => n.linkedLeaseId);
    expect(linked).toEqual(['lease-1', 'lease-1', 'lease-1']);
  });

  it('never merges instruments across different owners', () => {
    const a = rec('lease-a', 'owner-a');
    const b = rec('lease-b', 'owner-b'); // identical terms, different owner
    const result = collapseDuplicateLeaseRecords([a, b], []);
    expect(result.leases.map((l) => l.id).sort()).toEqual(['lease-a', 'lease-b']);
    expect(result.removedLeaseIds).toEqual([]);
  });

  it('keeps records that differ in any instrument term separate', () => {
    const owner = 'owner-acme';
    const r1 = rec('lease-1', owner, { royaltyRate: '0.1875' });
    const r2 = rec('lease-2', owner, { royaltyRate: '0.25' }); // different royalty
    const result = collapseDuplicateLeaseRecords([r1, r2], []);
    expect(result.leases.map((l) => l.id).sort()).toEqual(['lease-1', 'lease-2']);
    expect(result.removedLeaseIds).toEqual([]);
  });

  it('moves a merged tract\'s gross acres onto its lease-node', () => {
    const owner = 'owner-acme';
    const r1 = rec('lease-1', owner, { grossAcres: '160' });
    const r2 = rec('lease-2', owner, { grossAcres: '80' }); // same instrument, different acreage
    const t1 = ownerMineralNode('m1');
    const t2 = ownerMineralNode('m2');
    const ln1 = leaseNodeFor('ln1', t1, r1);
    const ln2 = leaseNodeFor('ln2', t2, r2);

    const result = collapseDuplicateLeaseRecords([r1, r2], [t1, t2, ln1, ln2]);

    // r1 and r2 share an instrument key (grossAcres is excluded from it) → merge.
    expect(result.leases.map((l) => l.id)).toEqual(['lease-1']);
    const repointed = result.nodes.find((n) => n.id === 'ln2');
    expect(repointed?.linkedLeaseId).toBe('lease-1');
    expect(repointed?.leaseTractGrossAcres).toBe('80');
    // the canonical node keeps the canonical acreage on its own record; no override needed.
    const canonical = result.nodes.find((n) => n.id === 'ln1');
    expect(canonical?.leaseTractGrossAcres).toBeUndefined();
  });

  it('is a no-op when there are no duplicates', () => {
    const r1 = rec('lease-1', 'owner-a');
    const result = collapseDuplicateLeaseRecords([r1], []);
    expect(result.leases).toEqual([r1]);
    expect(result.removedLeaseIds).toEqual([]);
    expect(result.repointedNodeIds).toEqual([]);
  });
});
