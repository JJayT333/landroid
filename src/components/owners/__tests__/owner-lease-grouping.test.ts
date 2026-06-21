import { describe, expect, it } from 'vitest';
import { createBlankLease, type Lease } from '../../../types/owner';
import {
  countActiveLeaseInstruments,
  groupLeasesByInstrument,
  leaseInstrumentKey,
} from '../owner-lease-grouping';

const WS = 'ws-1';
const OWNER = 'owner-1';

function lease(overrides: Partial<Lease>): Lease {
  return createBlankLease(WS, OWNER, overrides);
}

describe('owner lease grouping', () => {
  // The Springhill generator mints one record per tract for the same OGML
  // instrument — these collapse to a single card.
  const ogml = {
    lessee: 'Magnolia Petroleum Company, LLC',
    docNo: 'OGML_Trapp_Downey',
    royaltyRate: '1/5',
    effectiveDate: '2025-10-30',
  };

  it('collapses content-identical per-tract records into one instrument group', () => {
    const groups = groupLeasesByInstrument([
      lease({ id: 'l1', ...ogml }),
      lease({ id: 'l2', ...ogml }),
      lease({ id: 'l3', ...ogml }),
      lease({ id: 'l4', ...ogml }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].primary.id).toBe('l1');
    expect(groups[0].records.map((record) => record.id)).toEqual(['l1', 'l2', 'l3', 'l4']);
  });

  it('keeps records that differ in any instrument field separate', () => {
    const groups = groupLeasesByInstrument([
      lease({ id: 'l1', ...ogml }),
      lease({ id: 'l2', ...ogml, docNo: 'OGML_Other' }), // different doc
      lease({ id: 'l3', ...ogml, leasedInterest: '0.5' }), // different leased interest
    ]);

    expect(groups).toHaveLength(3);
  });

  it('groups by lease-purchase-report id when present, ahead of content', () => {
    const groups = groupLeasesByInstrument([
      lease({ id: 'l1', leasePurchaseReportId: 'lpr-1', docNo: 'A' }),
      lease({ id: 'l2', leasePurchaseReportId: 'lpr-1', docNo: 'B' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].records).toHaveLength(2);
    expect(leaseInstrumentKey(groups[0].primary)).toBe('lpr:lpr-1');
  });

  it('counts active instruments — duplicates collapse, inactive excluded', () => {
    const isInactive = (status: string) => status === 'Expired';
    const count = countActiveLeaseInstruments(
      [
        lease({ id: 'l1', ...ogml, status: 'Active' }),
        lease({ id: 'l2', ...ogml, status: 'Active' }),
        lease({ id: 'l3', lessee: 'Other Co', docNo: 'Y', status: 'Active' }),
        lease({ id: 'l4', lessee: 'Old Co', docNo: 'Z', status: 'Expired' }),
      ],
      isInactive
    );

    // {l1,l2} collapse to one instrument + l3 = 2 active; l4 (Expired) excluded.
    expect(count).toBe(2);
  });
});
