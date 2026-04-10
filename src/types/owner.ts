export interface Owner {
  id: string;
  workspaceId: string;
  name: string;
  entityType: string;
  county: string;
  prospect: string;
  mailingAddress: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Jurisdiction discriminator for leasehold records (audit finding C2 / §7 item 7).
 *
 * LANDroid is Texas-only today. This field exists so Phase 2 (federal/BLM and
 * private leases) has a clean attachment point: jurisdiction-aware status enums,
 * royalty validation, communitization-agreement math, and ONRR exports will all
 * key off this discriminator. Until those land, every lease is `'tx_fee'` and
 * the math layer ignores the field.
 *
 *   - `'tx_fee'`     Texas privately-owned mineral fee — the default and only
 *                    jurisdiction that the v1 math layer is wired for.
 *   - `'tx_state'`   Texas state-owned minerals (GLO leases). Same Texas math
 *                    rules as fee today; reserved so future GLO-specific
 *                    payment tracking has a place to live.
 *   - `'federal'`    Federal/BLM onshore. Phase 2 — full federal scaffolding
 *                    (status enum, post-IRA 16.67% royalty, CA TPF math,
 *                    minimum royalty, ONRR export) lands when this is wired.
 *   - `'private'`    Private/non-federal/non-Texas-state leases the user
 *                    aggregates into the same project. Phase 2.
 *   - `'tribal'`     Tribal/allotted leases. Listed for completeness only;
 *                    no Phase 2 work scheduled until the user adds tribal
 *                    leases to the project.
 *
 * Order matches the project's Texas-first → Phase-2 rollout. New jurisdictions
 * added later should append to the end so the persisted indexes stay stable.
 */
export const LEASE_JURISDICTION_OPTIONS = [
  'tx_fee',
  'tx_state',
  'federal',
  'private',
  'tribal',
] as const;
export type LeaseJurisdiction = (typeof LEASE_JURISDICTION_OPTIONS)[number];

/**
 * Default jurisdiction for any lease that does not carry one — every existing
 * record on import migrates to `'tx_fee'`. Pinned as a const so the migration
 * default and the form default cannot drift apart.
 */
export const DEFAULT_LEASE_JURISDICTION: LeaseJurisdiction = 'tx_fee';

export const LEASE_STATUS_OPTIONS = [
  'Active',
  'Expired',
  'Released',
  'Terminated',
  'Inactive',
  'Dead',
] as const;
export type LeaseStatus = (typeof LEASE_STATUS_OPTIONS)[number];
export const DEFAULT_LEASE_STATUS: LeaseStatus = 'Active';

const CANONICAL_LEASE_STATUS_BY_NORMALIZED = new Map<string, LeaseStatus>(
  LEASE_STATUS_OPTIONS.map((status) => [status.toLowerCase(), status])
);
const INACTIVE_LEASE_STATUS_TEXT = new Set<string>([
  'expired',
  'released',
  'terminated',
  'inactive',
  'dead',
  'cancelled',
  'canceled',
]);

function toNormalizedLeaseStatusText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function normalizeLeaseJurisdiction(value: unknown): LeaseJurisdiction {
  if (typeof value === 'string') {
    const candidate = value.trim() as LeaseJurisdiction;
    if ((LEASE_JURISDICTION_OPTIONS as readonly string[]).includes(candidate)) {
      return candidate;
    }
  }
  return DEFAULT_LEASE_JURISDICTION;
}

export function isLeaseStatusOption(value: string): value is LeaseStatus {
  return CANONICAL_LEASE_STATUS_BY_NORMALIZED.has(value.trim().toLowerCase());
}

export function normalizeLeaseStatus(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return DEFAULT_LEASE_STATUS;
    }

    return CANONICAL_LEASE_STATUS_BY_NORMALIZED.get(trimmed.toLowerCase()) ?? trimmed;
  }

  return DEFAULT_LEASE_STATUS;
}

export function isInactiveLeaseStatus(value: unknown): boolean {
  const normalized = toNormalizedLeaseStatusText(value);
  if (normalized.length === 0) {
    return false;
  }

  return INACTIVE_LEASE_STATUS_TEXT.has(normalized);
}

export interface Lease {
  id: string;
  workspaceId: string;
  ownerId: string;
  leaseName: string;
  lessee: string;
  royaltyRate: string;
  leasedInterest: string;
  effectiveDate: string;
  expirationDate: string;
  status: string;
  docNo: string;
  notes: string;
  /**
   * Jurisdiction discriminator. See `LeaseJurisdiction`. Defaults to `'tx_fee'`
   * for every existing record; Phase 2 will key federal/BLM behaviors off this.
   */
  jurisdiction: LeaseJurisdiction;
  createdAt: string;
  updatedAt: string;
}

export interface ContactLog {
  id: string;
  workspaceId: string;
  ownerId: string;
  contactDate: string;
  method: string;
  subject: string;
  outcome: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export const OWNER_PANEL_TABS = ['info', 'leases', 'contacts', 'docs'] as const;
export type OwnerPanelTab = (typeof OWNER_PANEL_TABS)[number];

export const DOC_CATEGORY_OPTIONS = [
  'Title',
  'Lease',
  'Tax',
  'Map',
  'Correspondence',
  'Other',
] as const;

export type OwnerDocCategory = (typeof DOC_CATEGORY_OPTIONS)[number];

export interface OwnerDoc {
  id: string;
  workspaceId: string;
  ownerId: string;
  leaseId: string | null;
  fileName: string;
  mimeType: string;
  category: OwnerDocCategory;
  notes: string;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function createBlankOwner(
  workspaceId: string,
  overrides: Partial<Owner> = {}
): Owner {
  const now = nowIso();
  const owner: Owner = {
    id: overrides.id ?? `owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    name: '',
    entityType: 'Individual',
    county: '',
    prospect: '',
    mailingAddress: '',
    email: '',
    phone: '',
    notes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  owner.workspaceId = workspaceId;
  return owner;
}

export function createBlankLease(
  workspaceId: string,
  ownerId: string,
  overrides: Partial<Lease> = {}
): Lease {
  const now = nowIso();
  const lease: Lease = {
    id: overrides.id ?? `lease-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    ownerId,
    leaseName: '',
    lessee: '',
    royaltyRate: '',
    leasedInterest: '',
    effectiveDate: '',
    expirationDate: '',
    status: DEFAULT_LEASE_STATUS,
    docNo: '',
    notes: '',
    jurisdiction: DEFAULT_LEASE_JURISDICTION,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  lease.workspaceId = workspaceId;
  lease.ownerId = ownerId;
  // Coerce jurisdiction even when overrides supplies a junk value, so a stray
  // import that hands us {jurisdiction: 'fee'} or undefined still lands on tx_fee.
  lease.jurisdiction = normalizeLeaseJurisdiction(lease.jurisdiction);
  lease.status = normalizeLeaseStatus(lease.status);
  return lease;
}

export function normalizeLease(
  lease: Pick<Lease, 'id'> & Partial<Lease>,
  fallback: { workspaceId?: string; ownerId?: string } = {}
): Lease {
  const workspaceId = asString(lease.workspaceId) || fallback.workspaceId || '';
  const ownerId = asString(lease.ownerId) || fallback.ownerId || '';
  const normalized = createBlankLease(workspaceId, ownerId);

  return {
    ...normalized,
    ...lease,
    workspaceId,
    ownerId,
    leaseName: asString(lease.leaseName),
    lessee: asString(lease.lessee),
    royaltyRate: asString(lease.royaltyRate),
    leasedInterest: asString(lease.leasedInterest),
    effectiveDate: asString(lease.effectiveDate),
    expirationDate: asString(lease.expirationDate),
    status: normalizeLeaseStatus(lease.status),
    docNo: asString(lease.docNo),
    notes: asString(lease.notes),
    jurisdiction: normalizeLeaseJurisdiction(lease.jurisdiction),
    createdAt: asString(lease.createdAt) || normalized.createdAt,
    updatedAt: asString(lease.updatedAt) || normalized.updatedAt,
  };
}

export function createBlankContact(
  workspaceId: string,
  ownerId: string,
  overrides: Partial<ContactLog> = {}
): ContactLog {
  const now = nowIso();
  const contact: ContactLog = {
    id: overrides.id ?? `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    ownerId,
    contactDate: '',
    method: 'Phone',
    subject: '',
    outcome: '',
    notes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  contact.workspaceId = workspaceId;
  contact.ownerId = ownerId;
  return contact;
}

export function createBlankOwnerDoc(
  workspaceId: string,
  ownerId: string,
  file: Blob,
  {
    fileName,
    mimeType,
    overrides,
  }: {
    fileName: string;
    mimeType: string;
    overrides?: Partial<OwnerDoc>;
  }
): OwnerDoc {
  const now = nowIso();
  const doc: OwnerDoc = {
    id: overrides?.id ?? `odoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    ownerId,
    leaseId: null,
    fileName,
    mimeType,
    category: 'Other',
    notes: '',
    blob: file,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...overrides,
  };
  doc.workspaceId = workspaceId;
  doc.ownerId = ownerId;
  doc.fileName = overrides?.fileName ?? fileName;
  doc.mimeType = overrides?.mimeType ?? mimeType;
  doc.blob = overrides?.blob ?? file;
  return doc;
}
