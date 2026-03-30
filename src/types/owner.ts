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
    status: 'Active',
    docNo: '',
    notes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };
  lease.workspaceId = workspaceId;
  lease.ownerId = ownerId;
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
    status: asString(lease.status) || normalized.status,
    docNo: asString(lease.docNo),
    notes: asString(lease.notes),
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
