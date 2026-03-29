/** Owner database types — landowner tracking, lease acquisition, contact logs. */

export type OwnerStatus = 'prospect' | 'contacted' | 'negotiating' | 'leased' | 'declined' | 'pending';
export type Priority = 'high' | 'medium' | 'low';
export type LeaseType = 'new' | 'top' | 'renewal_extension';
export type ContactType = 'call' | 'email' | 'visit' | 'letter' | 'text' | 'other';
export type ContactDirection = 'inbound' | 'outbound';
export type DocCategory = 'lease' | 'memorandum' | 'deed' | 'check' | 'plat' | 'mor' | 'other';

export interface Owner {
  id: string;
  name: string;
  additionalLessors: string;
  ssn: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  altPhone: string;
  prospect: string;
  county: string;
  stateJurisdiction: string;
  status: OwnerStatus;
  priority: Priority;
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lease {
  id: string;
  ownerId: string;
  leaseType: LeaseType;
  leaseForm: string;
  lessee: string;
  leaseDate: string;
  effectiveDate: string;
  expirationDate: string;
  primaryTerm: string;
  primaryTermWritten: string;     // e.g. "three (3) years"
  royaltyRate: string;
  royaltyWritten: string;         // e.g. "three sixteenths (3/16)"
  lesseeAddress: string;
  bonusPerAcre: string;
  rentalPerAcre: string;
  paidUp: boolean;
  totalBonus: string;
  totalCheck: string;
  tractNo: string;
  briefDescription: string;
  legalDescription: string;
  lessorInterest: string;
  grossAcres: string;
  netAcres: string;
  provisions: string[];
  provisionNotes: string;
  attachments: string[];
  comments: string;
  preparedBy: string;
  datePrepared: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactLog {
  id: string;
  ownerId: string;
  type: ContactType;
  direction: ContactDirection;
  date: string;
  time: string;
  contactPerson: string;
  summary: string;
  notes: string;
  followUpDate: string;
  followUpCompleted: boolean;
  createdAt: string;
}

export interface OwnerDoc {
  id: string;
  ownerId: string;
  leaseId: string | null;
  category: DocCategory;
  fileName: string;
  mimeType: string;
  blob: Blob;
  notes: string;
  createdAt: string;
}

// ── Constants ─────────────────────────────────────────────

export const STATUS_OPTIONS: { value: OwnerStatus; label: string; color: string }[] = [
  { value: 'prospect', label: 'Prospect', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-amber-100 text-amber-800' },
  { value: 'negotiating', label: 'Negotiating', color: 'bg-purple-100 text-purple-800' },
  { value: 'leased', label: 'Leased', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'declined', label: 'Declined', color: 'bg-red-100 text-red-800' },
  { value: 'pending', label: 'Pending', color: 'bg-gray-100 text-gray-700' },
];

export const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const LEASE_TYPE_OPTIONS: { value: LeaseType; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'top', label: 'Top' },
  { value: 'renewal_extension', label: 'Renew / Ext.' },
];

export const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string; icon: string }[] = [
  { value: 'call', label: 'Phone Call', icon: 'phone' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'visit', label: 'In Person', icon: 'map-pin' },
  { value: 'letter', label: 'Letter', icon: 'file-text' },
  { value: 'text', label: 'Text Message', icon: 'message-square' },
  { value: 'other', label: 'Other', icon: 'more-horizontal' },
];

export const DOC_CATEGORY_OPTIONS: { value: DocCategory; label: string }[] = [
  { value: 'lease', label: 'Lease' },
  { value: 'memorandum', label: 'Memorandum' },
  { value: 'deed', label: 'Deed' },
  { value: 'check', label: 'Check' },
  { value: 'plat', label: 'Plat' },
  { value: 'mor', label: 'Mineral Ownership Report' },
  { value: 'other', label: 'Other' },
];

export const PROVISION_OPTIONS = [
  { key: 'pugh_release', label: 'Pugh / Acreage Rel.' },
  { key: 'shut_in_royalty', label: 'Shut in Royalty' },
  { key: 'royalty_requirements', label: 'Royalty; Free / Min. / Pmt. Req.' },
  { key: 'depth_severance', label: 'Depth Severance' },
  { key: 'pooling_640_gas', label: 'Pooling acreage less than 640 Gas' },
  { key: 'pooling_40_oil', label: 'Pooling acreage less than 40 Oil' },
  { key: 'pooling_80_oil', label: 'Pooling acreage less than 80 Oil' },
  { key: 'offset_well', label: 'Offset Well Requirements' },
  { key: 'consent_assign', label: 'Consent to Assign' },
  { key: 'surface_damages', label: 'Surface Damages / Restrictions' },
  { key: 'drill_seis_title', label: 'Drill / Seis. / Title Info. Req.' },
  { key: 'release_required', label: 'Release of Lease Required' },
  { key: 'security_interest', label: 'Security Interest Retained / Lien' },
  { key: 'indemnification', label: 'Indemnification' },
  { key: 'audits', label: 'Audits' },
  { key: 'take_in_kind', label: 'Take in Kind' },
  { key: 'lease_terminating', label: 'Lease Terminating Provision' },
  { key: 'no_warranty_title', label: 'No Warranty of Title' },
  { key: 'form_struck', label: 'Form Provisions Struck' },
] as const;

export const ATTACHMENT_OPTIONS = [
  { key: 'original_memorandum', label: 'Original Memorandum' },
  { key: 'copy_memorandum', label: 'Copy of Memorandum' },
  { key: 'original_lease', label: 'Original Lease' },
  { key: 'copy_lease', label: 'Copy of Lease' },
  { key: 'copy_check', label: 'Copy of Check' },
  { key: 'reference_deeds', label: 'Copy of Reference Deed(s)' },
  { key: 'mor', label: 'Mineral Ownership Report' },
  { key: 'plat', label: 'Plat' },
] as const;

// ── Factories ─────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createBlankOwner(overrides?: Partial<Owner>): Owner {
  const now = new Date().toISOString();
  return {
    id: uid('own'),
    name: '',
    additionalLessors: '',
    ssn: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    altPhone: '',
    prospect: '',
    county: '',
    stateJurisdiction: '',
    status: 'prospect',
    priority: 'medium',
    assignedTo: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createBlankLease(ownerId: string, overrides?: Partial<Lease>): Lease {
  const now = new Date().toISOString();
  return {
    id: uid('lse'),
    ownerId,
    leaseType: 'new',
    leaseForm: 'Producers 88 (7-69) Paid Up',
    lessee: '',
    leaseDate: '',
    effectiveDate: '',
    expirationDate: '',
    primaryTerm: '',
    primaryTermWritten: 'three (3) years',
    royaltyRate: '3/16',
    royaltyWritten: 'three sixteenths (3/16)',
    lesseeAddress: '',
    bonusPerAcre: '',
    rentalPerAcre: '',
    paidUp: true,
    totalBonus: '',
    totalCheck: '',
    tractNo: '',
    briefDescription: '',
    legalDescription: '',
    lessorInterest: '',
    grossAcres: '',
    netAcres: '',
    provisions: [],
    provisionNotes: '',
    attachments: [],
    comments: '',
    preparedBy: '',
    datePrepared: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createBlankContact(ownerId: string, overrides?: Partial<ContactLog>): ContactLog {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const time = now.slice(11, 16);
  return {
    id: uid('cl'),
    ownerId,
    type: 'call',
    direction: 'outbound',
    date: today,
    time,
    contactPerson: '',
    summary: '',
    notes: '',
    followUpDate: '',
    followUpCompleted: false,
    createdAt: now,
    ...overrides,
  };
}
