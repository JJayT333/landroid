import { describe, expect, it } from 'vitest';
import { createBlankResearchProjectRecord } from '../../types/research';
import {
  buildFederalLeaseSearchText,
  buildFederalLeaseSummary,
  federalLeaseMatchesSearch,
  getFederalLeaseExpirationBucket,
  isCurrentFederalLeaseRecord,
  isFederalTargetRecord,
  sortFederalLeaseRecordsByUrgency,
} from '../federal-lease-tracking';

const AS_OF = new Date('2026-04-15T12:00:00Z');

function federalRecord(
  id: string,
  overrides: Parameters<typeof createBlankResearchProjectRecord>[1] = {}
) {
  return createBlankResearchProjectRecord('ws-1', {
    id,
    jurisdiction: 'Federal / BLM',
    name: id,
    updatedAt: `2026-04-0${id.length}T00:00:00.000Z`,
    ...overrides,
  });
}

describe('federal lease tracking helpers', () => {
  it('classifies current leases, targets, and expiration buckets', () => {
    const current = federalRecord('current', {
      recordType: 'Federal Lease',
      status: 'Current',
      expirationDate: '2026-06-01',
    });
    const target = federalRecord('target', {
      recordType: 'Acquisition Target',
      status: 'Target',
    });
    const expired = federalRecord('expired', {
      expirationDate: '2026-01-01',
    });
    const future = federalRecord('future', {
      expirationDate: '2028-01-01',
    });

    expect(isCurrentFederalLeaseRecord(current)).toBe(true);
    expect(isFederalTargetRecord(target)).toBe(true);
    expect(getFederalLeaseExpirationBucket(current, AS_OF)).toBe('upcoming');
    expect(getFederalLeaseExpirationBucket(expired, AS_OF)).toBe('expired');
    expect(getFederalLeaseExpirationBucket(target, AS_OF)).toBe('missing');
    expect(getFederalLeaseExpirationBucket(future, AS_OF)).toBe('future');
  });

  it('summarizes federal records without counting Texas/private records', () => {
    const federal = [
      federalRecord('current', {
        recordType: 'Federal Lease',
        status: 'Current',
        expirationDate: '2026-06-01',
      }),
      federalRecord('target', {
        recordType: 'Acquisition Target',
        status: 'Target',
        nextAction: 'Check MLRS nomination window',
      }),
      federalRecord('review', {
        status: 'Under Review',
        expirationDate: '2026-01-01',
      }),
    ];
    const texas = createBlankResearchProjectRecord('ws-1', {
      id: 'texas',
      jurisdiction: 'Texas',
      recordType: 'Private Lease',
      status: 'Current',
      expirationDate: '2026-06-01',
    });

    expect(buildFederalLeaseSummary([...federal, texas], AS_OF)).toEqual({
      current: 1,
      targets: 1,
      underReview: 1,
      expired: 1,
      upcomingExpirations: 1,
      missingExpirations: 1,
      nextActions: 1,
    });
  });

  it('builds useful search text from record fields and linked labels', () => {
    const record = federalRecord('search-record', {
      name: 'North Mesa Federal Lease',
      legacySerial: 'NMNM 123456',
      mlrsSerial: 'MLRS-987654',
      lesseeOrApplicant: 'Mesa Acquisition Co.',
      operator: 'Raven Federal Operating',
      county: 'Eddy',
      prospectArea: 'Delaware North',
      sourcePacketStatus: 'Packet ready',
    });

    const searchText = buildFederalLeaseSearchText(record, {
      sourceLabels: ['BLM case file'],
      mapAssetLabel: 'North Mesa GeoJSON',
    });

    expect(searchText).toContain('mlrs-987654');
    expect(searchText).toContain('blm case file');
    expect(federalLeaseMatchesSearch(record, 'delaware north')).toBe(true);
    expect(
      federalLeaseMatchesSearch(record, 'north mesa geojson', {
        mapAssetLabel: 'North Mesa GeoJSON',
      })
    ).toBe(true);
    expect(federalLeaseMatchesSearch(record, 'not present')).toBe(false);
  });

  it('sorts urgent records by expired, next action, expiration, then recency', () => {
    const future = federalRecord('future', {
      expirationDate: '2028-01-01',
      updatedAt: '2026-04-12T00:00:00.000Z',
    });
    const nextAction = federalRecord('next-action', {
      nextActionDate: '2026-04-20',
      expirationDate: '2027-01-01',
      updatedAt: '2026-04-13T00:00:00.000Z',
    });
    const upcoming = federalRecord('upcoming', {
      expirationDate: '2026-05-01',
      updatedAt: '2026-04-14T00:00:00.000Z',
    });
    const missing = federalRecord('missing');
    const expired = federalRecord('expired', {
      expirationDate: '2026-02-01',
      updatedAt: '2026-04-10T00:00:00.000Z',
    });

    expect(
      sortFederalLeaseRecordsByUrgency(
        [future, nextAction, upcoming, missing, expired],
        AS_OF
      ).map((record) => record.id)
    ).toEqual(['expired', 'next-action', 'upcoming', 'missing', 'future']);
  });
});
