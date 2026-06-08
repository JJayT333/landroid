import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LEASE_FORM,
  createBlankLeasePurchaseReport,
  normalizeLeasePurchaseReport,
} from '../lease-purchase-report';
import { computeNetAcres, createBlankLease, normalizeLease } from '../owner';
import { calculateDeskMapCoverageSummary } from '../../components/deskmap/deskmap-coverage';
import { createBlankNode } from '../node';
import type { Lease } from '../owner';

describe('LeasePurchaseReport model', () => {
  it('defaults lease form to Producers 88 and lease type to new', () => {
    const lpr = createBlankLeasePurchaseReport('ws-1', 'owner-1');
    expect(lpr.leaseForm).toBe(DEFAULT_LEASE_FORM);
    expect(lpr.leaseType).toBe('new');
    expect(lpr.heldByProduction).toBe(false);
    expect(lpr.provisions).toEqual([]);
    expect(lpr.attachments).toEqual([]);
  });

  it('normalizes legacy / partial records with safe defaults', () => {
    const lpr = normalizeLeasePurchaseReport(
      { id: 'lpr-1', royalty: '1/4' },
      { workspaceId: 'ws-1', ownerId: 'owner-1' }
    );
    expect(lpr).toMatchObject({
      id: 'lpr-1',
      workspaceId: 'ws-1',
      ownerId: 'owner-1',
      royalty: '1/4',
      leaseForm: DEFAULT_LEASE_FORM,
      leaseType: 'new',
    });
  });

  it('coerces an unknown lease type back to new', () => {
    const lpr = normalizeLeasePurchaseReport({
      id: 'lpr-1',
      leaseType: 'totally-bogus' as never,
    });
    expect(lpr.leaseType).toBe('new');
  });

  it('keeps only valid, meaningful provisions and known attachments', () => {
    const lpr = normalizeLeasePurchaseReport({
      id: 'lpr-1',
      provisions: [
        { key: 'pugh_acreage_release', present: true, paragraph: '14' },
        { key: 'shut_in_royalty', present: false, paragraph: '' }, // dropped: empty
        { key: 'not_a_real_key', present: true, paragraph: '1' }, // dropped: invalid
      ] as never,
      attachments: ['original_lease', 'copy_check', 'bogus'] as never,
    });
    expect(lpr.provisions).toEqual([
      { key: 'pugh_acreage_release', present: true, paragraph: '14' },
    ]);
    expect(lpr.attachments).toEqual(['original_lease', 'copy_check']);
  });
});

describe('net mineral acres', () => {
  it('computes gross x lessor interest', () => {
    expect(computeNetAcres('35.92', '1/2')).toBe('17.96');
    expect(computeNetAcres('100', '0.25')).toBe('25');
  });

  it('returns blank for blank or unparseable input', () => {
    expect(computeNetAcres('', '1/2')).toBe('');
    expect(computeNetAcres('100', '')).toBe('');
    expect(computeNetAcres('abc', '1/2')).toBe('');
  });

  it('derives netAcres on the lease slice and defaults new fields', () => {
    const lease = createBlankLease('ws-1', 'owner-1', {
      grossAcres: '35.92',
      leasedInterest: '0.5',
    });
    expect(lease.netAcres).toBe('17.96');
    expect(lease.leasePurchaseReportId).toBeNull();
    expect(lease.primaryTerm).toBe('');
    expect(lease.heldByProduction).toBe(false);
  });

  it('treats a blank leasePurchaseReportId as null on normalize', () => {
    const lease = normalizeLease(
      { id: 'lease-1', leasePurchaseReportId: '   ' as never },
      { workspaceId: 'ws-1', ownerId: 'owner-1' }
    );
    expect(lease.leasePurchaseReportId).toBeNull();
  });
});

describe('LPR descriptive fields do not change coverage math', () => {
  it('produces identical leased/unleased coverage with LPR fields set', () => {
    const node = {
      ...createBlankNode('node-1'),
      grantee: 'Owner One',
      fraction: '1',
      initialFraction: '1',
      linkedOwnerId: 'owner-1',
    };
    const baseLease = createBlankLease('ws-1', 'owner-1', {
      leasedInterest: '1',
      royaltyRate: '1/4',
      status: 'Active',
    });
    const withLpr: Lease = normalizeLease(
      {
        ...baseLease,
        grossAcres: '100',
        primaryTerm: '3 years',
        heldByProduction: true,
        leasePurchaseReportId: 'lpr-1',
      },
      { workspaceId: 'ws-1', ownerId: 'owner-1' }
    );

    const base = calculateDeskMapCoverageSummary(
      [node],
      new Map([['owner-1', [baseLease]]]),
      [node]
    );
    const lpr = calculateDeskMapCoverageSummary(
      [node],
      new Map([['owner-1', [withLpr]]]),
      [node]
    );

    expect(lpr.leasedOwnership).toBe(base.leasedOwnership);
    expect(lpr.unleasedOwnership).toBe(base.unleasedOwnership);
  });
});
