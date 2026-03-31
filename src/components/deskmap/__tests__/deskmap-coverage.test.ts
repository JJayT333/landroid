import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../../types/node';
import type { Lease } from '../../../types/owner';
import type { DeskMapPrimaryLeaseSummary } from '../deskmap-coverage';
import {
  calculateDeskMapCoverageSummary,
  pickPrimaryLease,
  toDeskMapPrimaryLeaseSummary,
} from '../deskmap-coverage';

describe('deskmap-coverage', () => {
  it('calculates current, linked, and leased coverage separately', () => {
    const linkedLeases = new Map<string, DeskMapPrimaryLeaseSummary>([
      [
        'owner-1',
        {
          id: 'lease-1',
          leaseName: 'Main Lease',
          lessee: 'Acme Energy',
          royaltyRate: '1/4',
          leasedInterest: '0.5',
          effectiveDate: '2026-03-30',
          expirationDate: '',
          status: 'Active',
          docNo: '1001',
          notes: '',
        },
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
    const linkedLeases = new Map<string, DeskMapPrimaryLeaseSummary>([
      [
        'owner-1',
        {
          id: 'lease-1',
          leaseName: 'Main Lease',
          lessee: 'Acme Energy',
          royaltyRate: '1/4',
          leasedInterest: '0.125',
          effectiveDate: '2026-03-30',
          expirationDate: '',
          status: 'Active',
          docNo: '1001',
          notes: '',
        },
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
});
