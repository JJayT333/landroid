import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRavenForestFederalLeases,
  clearFederalLeaseDocuments,
  getFederalLeaseDocument,
  RAVEN_FOREST_STIPULATIONS,
  registerFederalLeaseDocuments,
} from '../federal-lease-seed';

describe('buildRavenForestFederalLeases', () => {
  afterEach(() => {
    clearFederalLeaseDocuments();
  });

  it('produces five Raven Forest federal lease records', () => {
    const { records, documents } = buildRavenForestFederalLeases('ws-1');
    expect(records).toHaveLength(5);
    expect(documents).toHaveLength(5);
    expect(records.every((r) => r.recordType === 'Federal Lease')).toBe(true);
    expect(records.every((r) => r.jurisdiction === 'Federal / BLM')).toBe(true);
    expect(records.every((r) => r.state === 'TX')).toBe(true);
  });

  it('emits the five canonical TXNM serials', () => {
    const { records } = buildRavenForestFederalLeases('ws-1');
    const serials = records.map((r) => r.mlrsSerial).sort();
    expect(serials).toEqual([
      'TXNM100115442',
      'TXNM100120954',
      'TXNM100121986',
      'TXNM100129751',
      'TXNM100132133',
    ]);
  });

  it('splits Unit A and Unit B between the two designated lessees', () => {
    const { records } = buildRavenForestFederalLeases('ws-1');
    const unitA = records.filter((r) => r.prospectArea === 'Raven Forest Unit A');
    const unitB = records.filter((r) => r.prospectArea === 'Raven Forest Unit B');
    expect(unitA).toHaveLength(3);
    expect(unitB).toHaveLength(2);
    expect(unitA.every((r) => r.lesseeOrApplicant === 'Texas Energy Acquisitions LP')).toBe(
      true
    );
    expect(unitB.every((r) => r.lesseeOrApplicant === 'Lone Star Minerals LLC')).toBe(true);
  });

  it('attaches BLM Form 3100-11 documents with full stipulation set', () => {
    const { documents } = buildRavenForestFederalLeases('ws-1');
    expect(documents.every((d) => d.form === 'BLM 3100-11')).toBe(true);
    expect(documents.every((d) => d.primaryTermYears === 10)).toBe(true);
    expect(documents.every((d) => d.rentalPerAcre === '$1.50')).toBe(true);
    expect(
      documents.every(
        (d) =>
          d.stipulations.length === RAVEN_FOREST_STIPULATIONS.length &&
          d.stipulations.every((stip) =>
            (RAVEN_FOREST_STIPULATIONS as readonly string[]).includes(stip)
          )
      )
    ).toBe(true);
    const unitA = documents.filter((d) => d.prospect === 'Raven Forest Unit A');
    const unitB = documents.filter((d) => d.prospect === 'Raven Forest Unit B');
    expect(unitA.every((d) => d.royaltyFraction === '1/8')).toBe(true);
    expect(unitB.every((d) => d.royaltyFraction === '3/16')).toBe(true);
  });

  it('registers documents into the global lookup keyed by record id', () => {
    const { records, documents } = buildRavenForestFederalLeases('ws-2');
    registerFederalLeaseDocuments(documents);
    for (const record of records) {
      const doc = getFederalLeaseDocument(record.id);
      expect(doc).not.toBeNull();
      expect(doc?.mlrsSerial).toBe(record.mlrsSerial);
    }
  });

  it('returns null for unknown record ids after clearing', () => {
    const { documents } = buildRavenForestFederalLeases('ws-3');
    registerFederalLeaseDocuments(documents);
    clearFederalLeaseDocuments();
    expect(getFederalLeaseDocument(documents[0].recordId)).toBeNull();
  });
});
