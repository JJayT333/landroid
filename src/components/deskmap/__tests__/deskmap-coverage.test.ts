import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../../types/node';
import { createBlankLease, type Lease } from '../../../types/owner';
import {
  allocateLeaseCoverage,
  calculateDeskMapCoverageSummary,
  canOwnerNodeHoldLease,
  isLeaseActive,
  pickPrimaryLease,
  toDeskMapPrimaryLeaseSummary,
} from '../deskmap-coverage';

describe('deskmap-coverage', () => {
  it('calculates current, linked, and leased coverage separately', () => {
    const linkedLeases = new Map<string, Lease[]>([
      [
        'owner-1',
        [{
          id: 'lease-1',
          workspaceId: 'ws-1',
          ownerId: 'owner-1',
          leaseName: 'Main Lease',
          lessee: 'Acme Energy',
          royaltyRate: '1/4',
          leasedInterest: '0.5',
          effectiveDate: '2026-03-30',
          expirationDate: '',
          status: 'Active',
          docNo: '1001',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
        }],
      ],
    ]);

    const ownerOne = {
      ...createBlankNode('node-1'),
      grantee: 'Owner One',
      fraction: '0.5',
      initialFraction: '0.5',
      linkedOwnerId: 'owner-1',
    };
    const ownerTwo = {
      ...createBlankNode('node-2'),
      grantee: 'Owner Two',
      fraction: '0.25',
      initialFraction: '0.25',
      linkedOwnerId: null,
    };
    const ownerThree = {
      ...createBlankNode('node-3'),
      grantee: 'Owner Three',
      fraction: '0.125',
      initialFraction: '0.125',
      linkedOwnerId: 'owner-3',
    };

    const summary = calculateDeskMapCoverageSummary(
      [ownerOne, ownerTwo, ownerThree],
      linkedLeases
    );

    expect(summary).toMatchObject({
      currentOwnership: '0.875',
      linkedOwnership: '0.625',
      leasedOwnership: '0.5',
      missingOwnership: '0.125',
      unlinkedOwnership: '0.375',
      unleasedOwnership: '0.5',
      currentOwnerCount: 3,
      linkedOwnerCount: 2,
      leasedOwnerCount: 1,
    });
  });

  it('keeps Desk Map lease-card coverage scoped to the branch with the lease node', () => {
    const lease = createBlankLease('ws-1', 'owner-1', {
      id: 'lease-t1',
      leaseName: 'T1 Only Lease',
      lessee: 'Acme Energy',
      royaltyRate: '1/8',
      leasedInterest: '0.25',
      status: 'Active',
    });
    const linkedLeases = new Map<string, Lease[]>([['owner-1', [lease]]]);
    const tractOneOwner = {
      ...createBlankNode('node-t1'),
      grantee: 'Same Owner',
      fraction: '0.25',
      initialFraction: '0.25',
      linkedOwnerId: 'owner-1',
    };
    const tractTwoOwner = {
      ...createBlankNode('node-t2'),
      grantee: 'Same Owner',
      fraction: '0.25',
      initialFraction: '0.25',
      linkedOwnerId: 'owner-1',
    };
    const leaseNode = {
      ...createBlankNode('lease-node-t1', tractOneOwner.id),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      linkedLeaseId: lease.id,
    };

    const tractOneSummary = calculateDeskMapCoverageSummary(
      [tractOneOwner, leaseNode],
      linkedLeases,
      [tractOneOwner, leaseNode, tractTwoOwner]
    );
    const tractTwoSummary = calculateDeskMapCoverageSummary(
      [tractTwoOwner],
      linkedLeases,
      [tractOneOwner, leaseNode, tractTwoOwner]
    );

    expect(tractOneSummary.leasedOwnership).toBe('0.25');
    expect(tractTwoSummary.leasedOwnership).toBe('0');
  });

  it('allocates multiple active leases in effective-date order and caps them at the owner share', () => {
    const result = allocateLeaseCoverage(
      [
        {
          id: 'lease-1',
          workspaceId: 'ws-1',
          ownerId: 'owner-1',
          leaseName: 'First Lease',
          lessee: 'Acme Energy',
          royaltyRate: '1/8',
          leasedInterest: '0.25',
          effectiveDate: '2026-03-01',
          expirationDate: '',
          status: 'Active',
          docNo: '1001',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'lease-2',
          workspaceId: 'ws-1',
          ownerId: 'owner-1',
          leaseName: 'Second Lease',
          lessee: 'Bravo Energy',
          royaltyRate: '1/5',
          leasedInterest: '0.5',
          effectiveDate: '2026-04-01',
          expirationDate: '',
          status: 'Active',
          docNo: '1002',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      '0.5'
    );

    expect(result.allocations).toEqual([
      expect.objectContaining({
        lease: expect.objectContaining({ id: 'lease-1' }),
        allocatedFraction: '0.25',
      }),
      expect.objectContaining({
        lease: expect.objectContaining({ id: 'lease-2' }),
        allocatedFraction: '0.25',
      }),
    ]);
    // Second lease is clipped from 0.5 to 0.25; surface it as an overlap warning.
    expect(result.overlaps).toEqual([
      expect.objectContaining({
        leaseId: 'lease-2',
        leaseName: 'Second Lease',
        lessee: 'Bravo Energy',
        requestedFraction: '0.5',
        allocatedFraction: '0.25',
        clippedFraction: '0.25',
      }),
    ]);
  });

  it('flags a fully-clipped follow-on lease when an earlier lease already took the owner share', () => {
    const result = allocateLeaseCoverage(
      [
        {
          id: 'lease-a',
          workspaceId: 'ws-1',
          ownerId: 'owner-1',
          leaseName: 'Early Full Lease',
          lessee: 'Acme',
          royaltyRate: '1/8',
          leasedInterest: '0.5',
          effectiveDate: '2026-01-01',
          expirationDate: '',
          status: 'Active',
          docNo: '',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'lease-b',
          workspaceId: 'ws-1',
          ownerId: 'owner-1',
          leaseName: 'Late Full Lease',
          lessee: 'Bravo',
          royaltyRate: '1/4',
          leasedInterest: '0.5',
          effectiveDate: '2026-06-01',
          expirationDate: '',
          status: 'Active',
          docNo: '',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      '0.5'
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual(
      expect.objectContaining({
        lease: expect.objectContaining({ id: 'lease-a' }),
        allocatedFraction: '0.5',
      })
    );
    expect(result.overlaps).toEqual([
      expect.objectContaining({
        leaseId: 'lease-b',
        requestedFraction: '0.5',
        allocatedFraction: '0',
        clippedFraction: '0.5',
      }),
    ]);
  });

  it('returns no overlap warnings when active leases fit inside the owner share', () => {
    const result = allocateLeaseCoverage(
      [
        {
          id: 'lease-1',
          workspaceId: 'ws-1',
          ownerId: 'owner-1',
          leaseName: 'Half Lease',
          lessee: 'Acme',
          royaltyRate: '1/8',
          leasedInterest: '0.25',
          effectiveDate: '2026-03-01',
          expirationDate: '',
          status: 'Active',
          docNo: '',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      '0.5'
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.overlaps).toEqual([]);
  });

  it('treats canonical inactive labels as inactive while preserving legacy text as active', () => {
    expect(
      isLeaseActive({
        id: 'lease-active',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        leaseName: 'Legacy Active Lease',
        lessee: 'Acme',
        royaltyRate: '1/8',
        leasedInterest: '0.5',
        effectiveDate: '',
        expirationDate: '',
        status: 'Held by Production',
        docNo: '',
        notes: '',
        jurisdiction: 'tx_fee',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      })
    ).toBe(true);

    expect(
      isLeaseActive({
        id: 'lease-inactive',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        leaseName: 'Released Lease',
        lessee: 'Acme',
        royaltyRate: '1/8',
        leasedInterest: '0.5',
        effectiveDate: '',
        expirationDate: '',
        status: ' released ',
        docNo: '',
        notes: '',
        jurisdiction: 'tx_fee',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      })
    ).toBe(false);
  });

  it('prefers the most recently updated active lease', () => {
    const lease = pickPrimaryLease([
      {
        id: 'lease-old',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        leaseName: 'Old Lease',
        lessee: 'Acme',
        royaltyRate: '1/5',
        leasedInterest: '0.5',
        effectiveDate: '',
        expirationDate: '',
        status: 'Active',
        docNo: '',
        notes: '',
        jurisdiction: 'tx_fee',
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z',
      },
      {
        id: 'lease-new',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        leaseName: 'New Lease',
        lessee: 'Acme',
        royaltyRate: '1/4',
        leasedInterest: '0.5',
        effectiveDate: '',
        expirationDate: '',
        status: 'Active',
        docNo: '',
        notes: '',
        jurisdiction: 'tx_fee',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
      {
        id: 'lease-expired',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        leaseName: 'Expired Lease',
        lessee: 'Acme',
        royaltyRate: '1/8',
        leasedInterest: '0.5',
        effectiveDate: '',
        expirationDate: '',
        status: 'Expired',
        docNo: '',
        notes: '',
        jurisdiction: 'tx_fee',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);

    expect(toDeskMapPrimaryLeaseSummary(lease)).toMatchObject({
      id: 'lease-new',
      leaseName: 'New Lease',
    });
  });

  it('treats legacy leases with missing newer text fields as active', () => {
    const lease = pickPrimaryLease([
      {
        id: 'legacy-lease',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        leaseName: 'Legacy Lease',
        lessee: 'Acme',
        effectiveDate: '',
        expirationDate: '',
        docNo: '',
        notes: '',
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z',
      } as Lease,
    ]);

    expect(toDeskMapPrimaryLeaseSummary(lease)).toMatchObject({
      id: 'legacy-lease',
      royaltyRate: '',
      leasedInterest: '',
    });
  });

  it('uses leased-interest terms instead of assuming the whole owner share is leased', () => {
    const linkedLeases = new Map<string, Lease[]>([
      [
        'owner-1',
        [{
          id: 'lease-1',
          workspaceId: 'ws-1',
          ownerId: 'owner-1',
          leaseName: 'Main Lease',
          lessee: 'Acme Energy',
          royaltyRate: '1/4',
          leasedInterest: '0.125',
          effectiveDate: '2026-03-30',
          expirationDate: '',
          status: 'Active',
          docNo: '1001',
          notes: '',
          jurisdiction: 'tx_fee',
          createdAt: '2026-03-30T00:00:00.000Z',
          updatedAt: '2026-03-30T00:00:00.000Z',
        }],
      ],
    ]);

    const ownerOne = {
      ...createBlankNode('node-1'),
      grantee: 'Owner One',
      fraction: '0.5',
      initialFraction: '0.5',
      linkedOwnerId: 'owner-1',
    };

    const summary = calculateDeskMapCoverageSummary([ownerOne], linkedLeases);

    expect(summary.leasedOwnership).toBe('0.125');
    expect(summary.unleasedOwnership).toBe('0.875');
  });

  it('aggregates multiple active leases for the same owner when calculating leased coverage', () => {
    const linkedLeases = new Map<string, Lease[]>([
      [
        'owner-1',
        [
          {
            id: 'lease-1',
            workspaceId: 'ws-1',
            ownerId: 'owner-1',
            leaseName: 'First Lease',
            lessee: 'Acme Energy',
            royaltyRate: '1/8',
            leasedInterest: '0.25',
            effectiveDate: '2026-03-01',
            expirationDate: '',
            status: 'Active',
            docNo: '1001',
            notes: '',
            jurisdiction: 'tx_fee',
            createdAt: '2026-03-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          {
            id: 'lease-2',
            workspaceId: 'ws-1',
            ownerId: 'owner-1',
            leaseName: 'Second Lease',
            lessee: 'Bravo Energy',
            royaltyRate: '1/4',
            leasedInterest: '0.25',
            effectiveDate: '2026-04-01',
            expirationDate: '',
            status: 'Active',
            docNo: '1002',
            notes: '',
            jurisdiction: 'tx_fee',
            createdAt: '2026-04-01T00:00:00.000Z',
            updatedAt: '2026-04-01T00:00:00.000Z',
          },
        ],
      ],
    ]);

    const ownerOne = {
      ...createBlankNode('node-1'),
      grantee: 'Owner One',
      fraction: '0.5',
      initialFraction: '0.5',
      linkedOwnerId: 'owner-1',
    };

    const summary = calculateDeskMapCoverageSummary([ownerOne], linkedLeases);

    expect(summary.leasedOwnership).toBe('0.5');
    expect(summary.unleasedOwnership).toBe('0.5');
    expect(summary.leasedOwnerCount).toBe(1);
  });

  it('ignores NPRI branches when calculating mineral coverage totals', () => {
    const mineralOwner = {
      ...createBlankNode('node-1'),
      grantee: 'Mineral Owner',
      fraction: '1',
      initialFraction: '1',
      linkedOwnerId: 'owner-1',
    };
    const npriOwner = {
      ...createBlankNode('node-2', 'node-1'),
      grantee: 'NPRI Holder',
      fraction: '0.5',
      initialFraction: '0.5',
      interestClass: 'npri' as const,
      royaltyKind: 'floating' as const,
    };

    const summary = calculateDeskMapCoverageSummary([mineralOwner, npriOwner], new Map());

    expect(summary.currentOwnership).toBe('1');
    expect(summary.currentOwnerCount).toBe(1);
    expect(summary.missingOwnership).toBe('0');
  });

  it('reports temporary over-100 coverage when multiple root families are still being reconciled', () => {
    const familyOne = {
      ...createBlankNode('node-1'),
      grantee: 'Family One',
      fraction: '1',
      initialFraction: '1',
    };
    const familyTwo = {
      ...createBlankNode('node-2'),
      grantee: 'Family Two',
      fraction: '0.5',
      initialFraction: '0.5',
    };

    const summary = calculateDeskMapCoverageSummary([familyOne, familyTwo], new Map());

    expect(summary.currentOwnership).toBe('1.5');
    expect(summary.missingOwnership).toBe('-0.5');
    expect(summary.currentOwnerCount).toBe(2);
  });

  describe('canOwnerNodeHoldLease (mineral-only gate)', () => {
    it('accepts a linked mineral owner node', () => {
      const node = {
        ...createBlankNode('node-1'),
        interestClass: 'mineral' as const,
        linkedOwnerId: 'owner-1',
      };
      expect(canOwnerNodeHoldLease(node)).toBe(true);
    });

    it('rejects related (non-ownership) nodes', () => {
      const node = {
        ...createBlankNode('node-1'),
        type: 'related' as const,
        interestClass: 'mineral' as const,
        linkedOwnerId: 'owner-1',
      };
      expect(canOwnerNodeHoldLease(node)).toBe(false);
    });

    it('rejects unlinked mineral nodes', () => {
      const node = {
        ...createBlankNode('node-1'),
        interestClass: 'mineral' as const,
        linkedOwnerId: null,
      };
      expect(canOwnerNodeHoldLease(node)).toBe(false);
    });

    it('rejects NPRI royalty nodes even when linked to an owner', () => {
      const node = {
        ...createBlankNode('node-1'),
        interestClass: 'npri' as const,
        linkedOwnerId: 'owner-1',
      };
      expect(canOwnerNodeHoldLease(node)).toBe(false);
    });
  });
});
