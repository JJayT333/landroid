/**
 * Lease Purchase Report (LPR) — the landman lease abstract.
 *
 * An LPR is the parent record for a single oil-and-gas lease instrument. It
 * groups one-or-more per-tract {@link Lease} slices (linked by
 * `leasePurchaseReportId`) and carries the shared abstract data: parties,
 * economics, lease form, provisions checklist, attachments, and comments.
 *
 * Math note: nothing on the LPR enters ownership/royalty/NRI math. The math is
 * driven entirely by the per-tract {@link Lease} slices (their `leasedInterest`,
 * `royaltyRate`, `status`, `jurisdiction`). On save the editor derives those
 * slice scalars from the LPR (e.g. slice.royaltyRate = lpr.royalty) so the
 * existing coverage/summary pipeline needs no refactor. Every other LPR field
 * (lease type, form, bonus, rental, provisions, attachments, comments, preparer)
 * is descriptive only.
 *
 * Lessor identity/contact (name, address, phone, email, SSN) is NOT stored here
 * — it is referenced through the linked owner record. SSN in particular is
 * sensitive and lives only on the owner, optional and excluded from shared
 * exports.
 */

export const DEFAULT_LEASE_FORM = 'Producers 88 (7-69)';

export const LEASE_TYPE_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
  { value: 'renewal_ext', label: 'Renewal / Ext.' },
] as const;
export type LeaseType = (typeof LEASE_TYPE_OPTIONS)[number]['value'];
export const DEFAULT_LEASE_TYPE: LeaseType = 'new';

/**
 * Significant-provisions checklist from the LPR form. Each entry is a clause the
 * landman flags as present, optionally with the lease paragraph number where it
 * appears. Keys are stable; labels track the source form (`B_LPR_01`).
 */
export const LEASE_PROVISION_DEFINITIONS = [
  { key: 'pugh_acreage_release', label: 'Pugh / Acreage Rel.' },
  { key: 'shut_in_royalty', label: 'Shut-in Royalty' },
  { key: 'royalty_free_min_pmt', label: 'Royalty; Free / Min. / Pmt. Req.' },
  { key: 'depth_severance', label: 'Depth Severance' },
  { key: 'pooling_640_gas', label: 'Pooling acreage less than 640 Gas' },
  { key: 'pooling_40_oil', label: 'Pooling acreage less than 40 Oil' },
  { key: 'pooling_80_oil', label: 'Pooling acreage less than 80 Oil' },
  { key: 'offset_well', label: 'Offset Well Requirements' },
  { key: 'consent_to_assign', label: 'Consent to Assign' },
  { key: 'surface_damages', label: 'Surface Damages / Restrictions' },
  { key: 'drill_seismic_title_info', label: 'Drill / Seis. / Title Info. Req.' },
  { key: 'release_required', label: 'Release of Lease Required' },
  { key: 'security_interest_lien', label: 'Security Interest Retained / Lien' },
  { key: 'indemnification', label: 'Indemnification' },
  { key: 'audits', label: 'Audits' },
  { key: 'take_in_kind', label: 'Take in Kind' },
  { key: 'form_provisions_struck', label: 'Form Provisions Struck' },
  { key: 'lease_terminating_provision', label: 'Lease Terminating Provision' },
  { key: 'no_warranty_of_title', label: 'No Warranty of Title' },
] as const;
export type LeaseProvisionKey =
  (typeof LEASE_PROVISION_DEFINITIONS)[number]['key'];
const LEASE_PROVISION_KEYS = new Set<string>(
  LEASE_PROVISION_DEFINITIONS.map((entry) => entry.key)
);

export interface LeaseProvision {
  key: LeaseProvisionKey;
  present: boolean;
  paragraph: string;
}

export const LEASE_ATTACHMENT_DEFINITIONS = [
  { key: 'original_memorandum', label: 'Original Memorandum' },
  { key: 'copy_memorandum', label: 'Copy of Memorandum' },
  { key: 'original_lease', label: 'Original Lease' },
  { key: 'copy_lease', label: 'Copy of Lease' },
  { key: 'copy_check', label: 'Copy of Check' },
  { key: 'copy_reference_deeds', label: 'Copy of Reference Deed(s)' },
  { key: 'mineral_ownership_report', label: 'Mineral Ownership Report' },
  { key: 'plat', label: 'Plat' },
] as const;
export type LeaseAttachmentKey =
  (typeof LEASE_ATTACHMENT_DEFINITIONS)[number]['key'];
const LEASE_ATTACHMENT_KEYS = new Set<string>(
  LEASE_ATTACHMENT_DEFINITIONS.map((entry) => entry.key)
);

export interface LeasePurchaseReport {
  id: string;
  workspaceId: string;
  /** Lessor reference — identity/contact lives on the owner, not here. */
  ownerId: string;
  lesseeName: string;
  leaseType: LeaseType;
  leaseForm: string;
  leaseDate: string;
  effectiveDate: string;
  expirationDate: string;
  primaryTerm: string;
  heldByProduction: boolean;
  /** Royalty as raw text (e.g. "1/4"); copied onto tract slices for the math. */
  royalty: string;
  bonusPerAcre: string;
  rentalPerAcre: string;
  paidUp: boolean;
  legalDescription: string;
  /** Only meaningful provisions are stored (present or carrying a paragraph). */
  provisions: LeaseProvision[];
  /** Present attachment keys. */
  attachments: LeaseAttachmentKey[];
  comments: string;
  preparedBy: string;
  preparedDate: string;
  createdAt: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

export function normalizeLeaseType(value: unknown): LeaseType {
  if (typeof value === 'string') {
    const trimmed = value.trim() as LeaseType;
    if (LEASE_TYPE_OPTIONS.some((option) => option.value === trimmed)) {
      return trimmed;
    }
  }
  return DEFAULT_LEASE_TYPE;
}

function normalizeProvisions(value: unknown): LeaseProvision[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: LeaseProvision[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const key = asString((entry as { key?: unknown }).key);
    if (!LEASE_PROVISION_KEYS.has(key) || seen.has(key)) continue;
    const present = asBoolean((entry as { present?: unknown }).present);
    const paragraph = asString((entry as { paragraph?: unknown }).paragraph).trim();
    // Drop empty entries so records stay lean (present=false, no paragraph).
    if (!present && paragraph.length === 0) continue;
    seen.add(key);
    result.push({ key: key as LeaseProvisionKey, present, paragraph });
  }
  return result;
}

function normalizeAttachments(value: unknown): LeaseAttachmentKey[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: LeaseAttachmentKey[] = [];
  for (const entry of value) {
    const key = asString(entry);
    if (!LEASE_ATTACHMENT_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(key as LeaseAttachmentKey);
  }
  return result;
}

export function createBlankLeasePurchaseReport(
  workspaceId: string,
  ownerId: string,
  overrides: Partial<LeasePurchaseReport> = {}
): LeasePurchaseReport {
  const now = nowIso();
  const lpr: LeasePurchaseReport = {
    id:
      overrides.id
      ?? `lpr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    ownerId,
    lesseeName: '',
    leaseType: DEFAULT_LEASE_TYPE,
    leaseForm: DEFAULT_LEASE_FORM,
    leaseDate: '',
    effectiveDate: '',
    expirationDate: '',
    primaryTerm: '',
    heldByProduction: false,
    royalty: '',
    bonusPerAcre: '',
    rentalPerAcre: '',
    paidUp: false,
    legalDescription: '',
    provisions: [],
    attachments: [],
    comments: '',
    preparedBy: '',
    preparedDate: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  lpr.workspaceId = workspaceId;
  lpr.ownerId = ownerId;
  lpr.leaseType = normalizeLeaseType(lpr.leaseType);
  lpr.leaseForm = lpr.leaseForm || DEFAULT_LEASE_FORM;
  lpr.provisions = normalizeProvisions(lpr.provisions);
  lpr.attachments = normalizeAttachments(lpr.attachments);
  return lpr;
}

export function normalizeLeasePurchaseReport(
  lpr: Pick<LeasePurchaseReport, 'id'> & Partial<LeasePurchaseReport>,
  fallback: { workspaceId?: string; ownerId?: string } = {}
): LeasePurchaseReport {
  const workspaceId = asString(lpr.workspaceId) || fallback.workspaceId || '';
  const ownerId = asString(lpr.ownerId) || fallback.ownerId || '';
  const normalized = createBlankLeasePurchaseReport(workspaceId, ownerId);
  return {
    ...normalized,
    ...lpr,
    workspaceId,
    ownerId,
    lesseeName: asString(lpr.lesseeName),
    leaseType: normalizeLeaseType(lpr.leaseType),
    leaseForm: asString(lpr.leaseForm) || DEFAULT_LEASE_FORM,
    leaseDate: asString(lpr.leaseDate),
    effectiveDate: asString(lpr.effectiveDate),
    expirationDate: asString(lpr.expirationDate),
    primaryTerm: asString(lpr.primaryTerm),
    heldByProduction: asBoolean(lpr.heldByProduction),
    royalty: asString(lpr.royalty),
    bonusPerAcre: asString(lpr.bonusPerAcre),
    rentalPerAcre: asString(lpr.rentalPerAcre),
    paidUp: asBoolean(lpr.paidUp),
    legalDescription: asString(lpr.legalDescription),
    provisions: normalizeProvisions(lpr.provisions),
    attachments: normalizeAttachments(lpr.attachments),
    comments: asString(lpr.comments),
    preparedBy: asString(lpr.preparedBy),
    preparedDate: asString(lpr.preparedDate),
    createdAt: asString(lpr.createdAt) || normalized.createdAt,
    updatedAt: asString(lpr.updatedAt) || normalized.updatedAt,
  };
}
