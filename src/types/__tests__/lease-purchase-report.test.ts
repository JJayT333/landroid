import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LEASE_FORM,
  computeLeaseEconomicsTotals,
  createBlankLeasePurchaseReport,
  getProvision,
  hasAttachment,
  normalizeLeasePurchaseReport,
  setProvision,
  toggleAttachment,
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

describe('provision and attachment helpers', () => {
  it('reads a stored provision or returns a blank default', () => {
    const stored = [{ key: 'audits', present: true, paragraph: '12' }] as const;
    expect(getProvision(stored, 'audits')).toEqual({
      key: 'audits',
      present: true,
      paragraph: '12',
    });
    expect(getProvision(stored, 'shut_in_royalty')).toEqual({
      key: 'shut_in_royalty',
      present: false,
      paragraph: '',
    });
  });

  it('upserts one provision without disturbing the others', () => {
    const start = setProvision([], 'pugh_acreage_release', { present: true });
    const next = setProvision(start, 'pugh_acreage_release', { paragraph: '14' });
    expect(next).toEqual([
      { key: 'pugh_acreage_release', present: true, paragraph: '14' },
    ]);
    const withSecond = setProvision(next, 'audits', { present: true });
    expect(withSecond).toHaveLength(2);
    // Round-trips through normalize, dropping nothing meaningful.
    const lpr = normalizeLeasePurchaseReport({ id: 'lpr-1', provisions: withSecond });
    expect(lpr.provisions).toHaveLength(2);
  });

  it('toggles attachment keys on and off', () => {
    const on = toggleAttachment([], 'original_lease', true);
    expect(hasAttachment(on, 'original_lease')).toBe(true);
    const off = toggleAttachment(on, 'original_lease', false);
    expect(hasAttachment(off, 'original_lease')).toBe(false);
    // Idempotent: turning on twice does not duplicate the key.
    expect(toggleAttachment(on, 'original_lease', true)).toEqual(['original_lease']);
  });
});

describe('derived lease economics totals', () => {
  it('multiplies per-acre rates by the summed net acres', () => {
    const totals = computeLeaseEconomicsTotals(
      { bonusPerAcre: '500', rentalPerAcre: '10', paidUp: false },
      ['10', '20', '5']
    );
    expect(totals.totalBonus).toBe('17500');
    expect(totals.totalDelayRental).toBe('350');
  });

  it('suppresses delay rental when the lease is paid up', () => {
    const totals = computeLeaseEconomicsTotals(
      { bonusPerAcre: '500', rentalPerAcre: '10', paidUp: true },
      ['10']
    );
    expect(totals.totalBonus).toBe('5000');
    expect(totals.totalDelayRental).toBe('');
  });

  it('returns blank totals when no rate or no net acres', () => {
    expect(
      computeLeaseEconomicsTotals(
        { bonusPerAcre: '', rentalPerAcre: '', paidUp: false },
        ['10']
      )
    ).toEqual({ totalBonus: '', totalDelayRental: '' });
    expect(
      computeLeaseEconomicsTotals(
        { bonusPerAcre: '500', rentalPerAcre: '10', paidUp: false },
        ['', '']
      )
    ).toEqual({ totalBonus: '', totalDelayRental: '' });
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
