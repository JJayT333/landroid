/**
 * Raven Forest federal lease seed — five TXNM records scoped to Sam Houston
 * National Forest (Walker / Montgomery, TX).
 *
 * Federal leases are inventory-only references. They do NOT participate in
 * Texas Desk Map tinting, Leasehold decimal math, NPRI/ORRI/WI calculations,
 * or ONRR reporting. This module produces `ResearchProjectRecord` rows for the
 * Research workspace only.
 *
 * Extended lease-document details (royalty, bonus, rental, stipulations,
 * surface-use notes) are carried on the accompanying `FederalLeaseDocument`
 * structure, which the `LeaseDocumentModal` renders as a structured BLM Form
 * 3100-11 summary. The core `ResearchProjectRecord` shape is preserved so the
 * Federal Leasing view can continue to filter/sort without any schema changes.
 */
import {
  createBlankResearchProjectRecord,
  type ResearchProjectRecord,
} from '../types/research';

/** Stipulations carried in each Raven Forest federal lease. */
export const RAVEN_FOREST_STIPULATIONS = [
  'FS1',
  'FS8(TX)CSU1-A',
  'FS8(TX)CSU1I-2',
] as const;

/**
 * Lease-document payload rendered in the BLM Form 3100-11 modal. These fields
 * are intentionally NOT promoted onto `ResearchProjectRecord` — they are
 * reference-only document facts, not searchable inventory attributes.
 */
export interface FederalLeaseDocument {
  recordId: string;
  form: 'BLM 3100-11';
  mlrsSerial: string;
  legacySerial: string;
  lessee: string;
  prospect: string;
  county: string;
  survey: string;
  tract: string;
  acres: string;
  mineralPercent: string;
  effectiveDate: string;
  expirationDate: string;
  primaryTermYears: number;
  royaltyFraction: string;
  bonusPerAcre: string;
  rentalPerAcre: string;
  stipulations: readonly string[];
  notes: string;
  status: string;
}

interface FederalLeaseSeedDraft {
  mlrsSerial: string;
  legacySerial: string;
  lessee: string;
  prospect: string;
  county: string;
  survey: string;
  tract: string;
  acres: string;
  mineralPercent: string;
  effectiveDate: string;
  expirationDate: string;
  royaltyFraction: string;
  bonusPerAcre: string;
  rentalPerAcre: string;
  notes: string;
  status: string;
}

const PRIMARY_TERM_YEARS = 10;

/** Raw lease facts supplied by the user (Raven Forest prospect package). */
const RAVEN_FOREST_LEASE_DRAFTS: FederalLeaseSeedDraft[] = [
  {
    mlrsSerial: 'TXNM100132133',
    legacySerial: 'TX-NM-1321-33',
    lessee: 'Texas Energy Acquisitions LP',
    prospect: 'Raven Forest Unit A',
    county: 'Walker, TX',
    survey: 'Sam Houston National Forest',
    tract: 'Unit A, Tract 1 (C1)',
    acres: '640.00',
    mineralPercent: '100%',
    effectiveDate: '2024-05-01',
    expirationDate: '2034-05-01',
    royaltyFraction: '1/8',
    bonusPerAcre: '$125.00',
    rentalPerAcre: '$1.50',
    notes: 'Anchor tract for Raven Forest Unit A pooled development.',
    status: 'Active',
  },
  {
    mlrsSerial: 'TXNM100129751',
    legacySerial: 'TX-NM-1297-51',
    lessee: 'Texas Energy Acquisitions LP',
    prospect: 'Raven Forest Unit A',
    county: 'Walker, TX',
    survey: 'Sam Houston National Forest',
    tract: 'Unit A, Tracts 2-3 (C2, C3)',
    acres: '1,280.00',
    mineralPercent: '100%',
    effectiveDate: '2024-05-01',
    expirationDate: '2034-05-01',
    royaltyFraction: '1/8',
    bonusPerAcre: '$125.00',
    rentalPerAcre: '$1.50',
    notes: 'Two-tract block; NPRI discrepancy flagged on C3 pending curative.',
    status: 'Active',
  },
  {
    mlrsSerial: 'TXNM100115442',
    legacySerial: 'TX-NM-1154-42',
    lessee: 'Texas Energy Acquisitions LP',
    prospect: 'Raven Forest Unit A',
    county: 'Walker, TX',
    survey: 'Sam Houston National Forest',
    tract: 'Unit A, Tracts 4-5 (C4, C5)',
    acres: '1,280.00',
    mineralPercent: '100%',
    effectiveDate: '2024-05-01',
    expirationDate: '2034-05-01',
    royaltyFraction: '1/8',
    bonusPerAcre: '$125.00',
    rentalPerAcre: '$1.50',
    notes: 'Western closeout of Unit A; surface access via FS Road 219.',
    status: 'Active',
  },
  {
    mlrsSerial: 'TXNM100120954',
    legacySerial: 'TX-NM-1209-54',
    lessee: 'Lone Star Minerals LLC',
    prospect: 'Raven Forest Unit B',
    county: 'Walker / Montgomery, TX',
    survey: 'Sam Houston National Forest',
    tract: 'Unit B, Tracts 6-8 (C6, C7, C8)',
    acres: '1,920.00',
    mineralPercent: '100%',
    effectiveDate: '2024-06-15',
    expirationDate: '2034-06-15',
    royaltyFraction: '3/16',
    bonusPerAcre: '$175.00',
    rentalPerAcre: '$1.50',
    notes: 'Spans Walker/Montgomery county line; C7 has over-conveyance trigger.',
    status: 'Active',
  },
  {
    mlrsSerial: 'TXNM100121986',
    legacySerial: 'TX-NM-1219-86',
    lessee: 'Lone Star Minerals LLC',
    prospect: 'Raven Forest Unit B',
    county: 'Montgomery, TX',
    survey: 'Sam Houston National Forest',
    tract: 'Unit B, Tracts 9-10 (C9, C10)',
    acres: '1,280.00',
    mineralPercent: '100%',
    effectiveDate: '2024-06-15',
    expirationDate: '2034-06-15',
    royaltyFraction: '3/16',
    bonusPerAcre: '$175.00',
    rentalPerAcre: '$1.50',
    notes: 'Kitchen-sink tract C10 plus orphan-parent diagnostic tract C9.',
    status: 'Active',
  },
];

function recordIdForDraft(workspaceId: string, draft: FederalLeaseSeedDraft): string {
  return `project-${workspaceId}-fed-${draft.mlrsSerial.toLowerCase()}`;
}

function buildRecord(
  workspaceId: string,
  draft: FederalLeaseSeedDraft
): ResearchProjectRecord {
  return createBlankResearchProjectRecord(workspaceId, {
    id: recordIdForDraft(workspaceId, draft),
    recordType: 'Federal Lease',
    jurisdiction: 'Federal / BLM',
    status: 'Under Review',
    name: `${draft.prospect} — ${draft.tract}`,
    serialOrReference: draft.mlrsSerial,
    legacySerial: draft.legacySerial,
    mlrsSerial: draft.mlrsSerial,
    lesseeOrApplicant: draft.lessee,
    operator: draft.lessee,
    state: 'TX',
    county: draft.county,
    prospectArea: draft.prospect,
    effectiveDate: draft.effectiveDate,
    expirationDate: draft.expirationDate,
    primaryTerm: `${PRIMARY_TERM_YEARS} years`,
    nextAction: 'Review BLM Form 3100-11 document packet.',
    acquisitionStatus: draft.status,
    sourcePacketStatus: 'BLM Form 3100-11 on file',
    acres: draft.acres,
    legalDescription: `${draft.survey}, ${draft.tract}`,
    notes: draft.notes,
  });
}

function buildDocument(
  draft: FederalLeaseSeedDraft,
  recordId: string
): FederalLeaseDocument {
  return {
    recordId,
    form: 'BLM 3100-11',
    mlrsSerial: draft.mlrsSerial,
    legacySerial: draft.legacySerial,
    lessee: draft.lessee,
    prospect: draft.prospect,
    county: draft.county,
    survey: draft.survey,
    tract: draft.tract,
    acres: draft.acres,
    mineralPercent: draft.mineralPercent,
    effectiveDate: draft.effectiveDate,
    expirationDate: draft.expirationDate,
    primaryTermYears: PRIMARY_TERM_YEARS,
    royaltyFraction: draft.royaltyFraction,
    bonusPerAcre: draft.bonusPerAcre,
    rentalPerAcre: draft.rentalPerAcre,
    stipulations: RAVEN_FOREST_STIPULATIONS,
    notes: draft.notes,
    status: draft.status,
  };
}

/**
 * Build the five Raven Forest federal lease records plus their document
 * payloads. Pure builder — does not touch any store or persistence layer.
 */
export function buildRavenForestFederalLeases(workspaceId: string): {
  records: ResearchProjectRecord[];
  documents: FederalLeaseDocument[];
} {
  const records: ResearchProjectRecord[] = [];
  const documents: FederalLeaseDocument[] = [];

  for (const draft of RAVEN_FOREST_LEASE_DRAFTS) {
    const record = buildRecord(workspaceId, draft);
    records.push(record);
    documents.push(buildDocument(draft, record.id));
  }

  return { records, documents };
}

/** Global in-memory registry keyed by record id — populated by seeding. */
const leaseDocumentRegistry = new Map<string, FederalLeaseDocument>();

export function registerFederalLeaseDocuments(docs: FederalLeaseDocument[]): void {
  for (const doc of docs) {
    leaseDocumentRegistry.set(doc.recordId, doc);
  }
}

export function getFederalLeaseDocument(
  recordId: string
): FederalLeaseDocument | null {
  return leaseDocumentRegistry.get(recordId) ?? null;
}

export function clearFederalLeaseDocuments(): void {
  leaseDocumentRegistry.clear();
}
