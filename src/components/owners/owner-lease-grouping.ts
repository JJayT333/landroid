/**
 * Collapse an owner's lease records by INSTRUMENT.
 *
 * One lease instrument that covers several tracts is often stored as one record
 * PER tract (e.g. the Springhill data generator and the per-tract attach modal
 * both mint a record per tract sharing a doc number). The math is unaffected —
 * royalty/NRI are summed per owner-node-per-tract, never per record — but the
 * Owners tab renders one card per record, so the same instrument appears N
 * times. Grouping by instrument lets the UI show one card that spans the tracts.
 *
 * Only TRULY identical records collapse: the key is the lease-purchase-report id
 * when present, else a strict content key over every instrument field. Records
 * that differ in any term (e.g. a different leased interest per tract) stay
 * separate.
 */
import type { Lease } from '../../types/owner';

export interface LeaseInstrumentGroup {
  key: string;
  /** Representative record for the card header + the edit form seed. */
  primary: Lease;
  /** Every record in the group, in first-seen order. */
  records: Lease[];
}

/** Stable key identifying the lease instrument a record belongs to. */
export function leaseInstrumentKey(lease: Lease): string {
  if (lease.leasePurchaseReportId) {
    return `lpr:${lease.leasePurchaseReportId}`;
  }
  // Strict content key — only byte-identical instrument terms collapse.
  return [
    'content',
    lease.lessee,
    lease.leaseName,
    lease.docNo,
    lease.royaltyRate,
    lease.leasedInterest,
    lease.effectiveDate,
    lease.expirationDate,
    lease.status,
    lease.notes,
    lease.jurisdiction,
    lease.depthRange,
  ].join('');
}

/** Group leases by instrument, preserving first-seen order of both groups and records. */
export function groupLeasesByInstrument(leases: Lease[]): LeaseInstrumentGroup[] {
  const byKey = new Map<string, LeaseInstrumentGroup>();
  const order: string[] = [];
  for (const lease of leases) {
    const key = leaseInstrumentKey(lease);
    const existing = byKey.get(key);
    if (existing) {
      existing.records.push(lease);
    } else {
      byKey.set(key, { key, primary: lease, records: [lease] });
      order.push(key);
    }
  }
  return order.map((key) => byKey.get(key) as LeaseInstrumentGroup);
}

/** Count of distinct active lease INSTRUMENTS (duplicate per-tract records collapsed). */
export function countActiveLeaseInstruments(
  leases: Lease[],
  isInactiveStatus: (status: string) => boolean
): number {
  return groupLeasesByInstrument(
    leases.filter((lease) => !isInactiveStatus(lease.status))
  ).length;
}
