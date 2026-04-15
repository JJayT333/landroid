import type { ResearchProjectRecord } from '../types/research';

export type FederalLeaseExpirationBucket =
  | 'expired'
  | 'upcoming'
  | 'future'
  | 'missing';

export interface FederalLeaseSearchLabels {
  sourceLabels?: string[];
  mapAssetLabel?: string;
  mapRegionLabel?: string;
  deskMapLabel?: string;
  nodeLabel?: string;
  ownerLabel?: string;
  leaseLabel?: string;
  importLabel?: string;
}

export interface FederalLeaseSummary {
  current: number;
  targets: number;
  underReview: number;
  expired: number;
  upcomingExpirations: number;
  missingExpirations: number;
  nextActions: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function parseIsoDateOnly(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const time = Date.UTC(year, monthIndex, day);
  const parsed = new Date(time);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== monthIndex ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return time;
}

function startOfUtcDay(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function urgencyRank(record: ResearchProjectRecord, asOfDate: Date) {
  const expiration = getFederalLeaseExpirationBucket(record, asOfDate);
  if (expiration === 'expired') return 0;
  if (record.nextActionDate.trim()) return 1;
  if (expiration === 'upcoming') return 2;
  if (expiration === 'missing') return 3;
  return 4;
}

function sortableDate(value: string): number {
  return parseIsoDateOnly(value) ?? Number.POSITIVE_INFINITY;
}

export function isFederalLeasingRecord(record: ResearchProjectRecord): boolean {
  return record.jurisdiction === 'Federal / BLM';
}

export function isFederalTargetRecord(record: ResearchProjectRecord): boolean {
  return (
    isFederalLeasingRecord(record) &&
    (record.status === 'Target' || record.recordType === 'Acquisition Target')
  );
}

export function isCurrentFederalLeaseRecord(record: ResearchProjectRecord): boolean {
  return (
    isFederalLeasingRecord(record) &&
    record.recordType === 'Federal Lease' &&
    record.status === 'Current'
  );
}

export function getFederalLeaseExpirationBucket(
  record: ResearchProjectRecord,
  asOfDate: Date,
  upcomingDays = 180
): FederalLeaseExpirationBucket {
  const expiration = parseIsoDateOnly(record.expirationDate);
  if (expiration === null) return 'missing';

  const asOf = startOfUtcDay(asOfDate);
  if (expiration < asOf) return 'expired';

  const daysUntilExpiration = Math.floor((expiration - asOf) / MS_PER_DAY);
  return daysUntilExpiration <= upcomingDays ? 'upcoming' : 'future';
}

export function buildFederalLeaseSearchText(
  record: ResearchProjectRecord,
  labels: FederalLeaseSearchLabels = {}
): string {
  return normalizeSearchText(
    [
      record.name,
      record.recordType,
      record.jurisdiction,
      record.status,
      record.acquisitionStatus,
      record.serialOrReference,
      record.legacySerial,
      record.mlrsSerial,
      record.lesseeOrApplicant,
      record.operator,
      record.state,
      record.county,
      record.prospectArea,
      record.effectiveDate,
      record.expirationDate,
      record.primaryTerm,
      record.nextAction,
      record.nextActionDate,
      record.priority,
      record.sourcePacketStatus,
      record.acres,
      record.legalDescription,
      record.notes,
      labels.mapAssetLabel,
      labels.mapRegionLabel,
      labels.deskMapLabel,
      labels.nodeLabel,
      labels.ownerLabel,
      labels.leaseLabel,
      labels.importLabel,
      ...(labels.sourceLabels ?? []),
    ]
      .filter(Boolean)
      .join(' ')
  );
}

export function federalLeaseMatchesSearch(
  record: ResearchProjectRecord,
  searchQuery: string,
  labels: FederalLeaseSearchLabels = {}
): boolean {
  const query = normalizeSearchText(searchQuery);
  if (!query) return true;
  return buildFederalLeaseSearchText(record, labels).includes(query);
}

export function sortFederalLeaseRecordsByUrgency(
  records: ResearchProjectRecord[],
  asOfDate: Date
): ResearchProjectRecord[] {
  return [...records].sort((left, right) => {
    const rankDiff = urgencyRank(left, asOfDate) - urgencyRank(right, asOfDate);
    if (rankDiff !== 0) return rankDiff;

    const nextActionDiff =
      sortableDate(left.nextActionDate) - sortableDate(right.nextActionDate);
    if (nextActionDiff !== 0) return nextActionDiff;

    const expirationDiff =
      sortableDate(left.expirationDate) - sortableDate(right.expirationDate);
    if (expirationDiff !== 0) return expirationDiff;

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function buildFederalLeaseSummary(
  records: ResearchProjectRecord[],
  asOfDate: Date
): FederalLeaseSummary {
  return records.reduce<FederalLeaseSummary>(
    (summary, record) => {
      if (!isFederalLeasingRecord(record)) return summary;

      const expiration = getFederalLeaseExpirationBucket(record, asOfDate);
      if (isCurrentFederalLeaseRecord(record)) summary.current += 1;
      if (isFederalTargetRecord(record)) summary.targets += 1;
      if (record.status === 'Under Review') summary.underReview += 1;
      if (expiration === 'expired') summary.expired += 1;
      if (expiration === 'upcoming') summary.upcomingExpirations += 1;
      if (expiration === 'missing') summary.missingExpirations += 1;
      if (record.nextAction.trim() || record.nextActionDate.trim()) {
        summary.nextActions += 1;
      }
      return summary;
    },
    {
      current: 0,
      targets: 0,
      underReview: 0,
      expired: 0,
      upcomingExpirations: 0,
      missingExpirations: 0,
      nextActions: 0,
    }
  );
}
