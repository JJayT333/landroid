import {
  DEFAULT_LEASE_JURISDICTION,
  normalizeLeaseJurisdiction,
  type LeaseJurisdiction,
} from './owner';
import type { DeskMapUnitCode } from './node';

export interface LeaseholdUnit {
  name: string;
  description: string;
  operator: string;
  effectiveDate: string;
  /**
   * Jurisdiction discriminator (audit finding C2 / §7 item 7). LANDroid is
   * Texas-only today, so every existing unit migrates to `'tx_fee'`. Phase 2
   * will key federal CA/TPF math, ONRR exports, and federal-only views off
   * this so the Texas baseline has a clean attachment point.
   */
  jurisdiction: LeaseJurisdiction;
}

export const LEASEHOLD_INTEREST_SCOPE_OPTIONS = ['unit', 'tract'] as const;
export type LeaseholdInterestScope =
  (typeof LEASEHOLD_INTEREST_SCOPE_OPTIONS)[number];

export const LEASEHOLD_ORRI_SCOPE_OPTIONS = LEASEHOLD_INTEREST_SCOPE_OPTIONS;
export type LeaseholdOrriScope = LeaseholdInterestScope;
export const LEASEHOLD_ASSIGNMENT_SCOPE_OPTIONS = LEASEHOLD_INTEREST_SCOPE_OPTIONS;
export type LeaseholdAssignmentScope = LeaseholdInterestScope;
export const LEASEHOLD_TRANSFER_ORDER_STATUS_OPTIONS = [
  'draft',
  'ready',
  'hold',
] as const;
export type LeaseholdTransferOrderStatus =
  (typeof LEASEHOLD_TRANSFER_ORDER_STATUS_OPTIONS)[number];

export const LEASEHOLD_ORRI_BURDEN_BASIS_OPTIONS = [
  'gross_8_8',
  'net_revenue_interest',
  'working_interest',
] as const;
export type LeaseholdOrriBurdenBasis =
  (typeof LEASEHOLD_ORRI_BURDEN_BASIS_OPTIONS)[number];

export interface LeaseholdOrri {
  id: string;
  payee: string;
  scope: LeaseholdOrriScope;
  /** Unit code for unit-wide burdens in multi-unit workspaces. */
  unitCode?: DeskMapUnitCode | null;
  deskMapId: string | null;
  burdenFraction: string;
  burdenBasis: LeaseholdOrriBurdenBasis;
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
}

export interface LeaseholdAssignment {
  id: string;
  assignor: string;
  assignee: string;
  scope: LeaseholdAssignmentScope;
  /** Unit code for unit-wide WI assignments in multi-unit workspaces. */
  unitCode?: DeskMapUnitCode | null;
  deskMapId: string | null;
  workingInterestFraction: string;
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
}

export interface LeaseholdTransferOrderEntry {
  id: string;
  sourceRowId: string;
  ownerNumber: string;
  status: LeaseholdTransferOrderStatus;
  notes: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeUnitCode(
  value: unknown,
  options: { validUnitCodes?: Set<string> } = {}
): DeskMapUnitCode | null {
  const candidate = asString(value);
  if (!candidate) {
    return null;
  }
  if (options.validUnitCodes && !options.validUnitCodes.has(candidate)) {
    return null;
  }
  return candidate;
}

function normalizeInterestScope(value: unknown): LeaseholdInterestScope {
  return value === 'tract' ? 'tract' : 'unit';
}

function normalizeOrriBurdenBasis(value: unknown): LeaseholdOrriBurdenBasis {
  if (value === 'net_revenue_interest' || value === 'working_interest') {
    return value;
  }
  return 'gross_8_8';
}

function normalizeTransferOrderStatus(value: unknown): LeaseholdTransferOrderStatus {
  if (value === 'ready' || value === 'hold') {
    return value;
  }
  return 'draft';
}

export function createBlankLeaseholdUnit(
  overrides: Partial<LeaseholdUnit> = {}
): LeaseholdUnit {
  const unit: LeaseholdUnit = {
    name: '',
    description: '',
    operator: '',
    effectiveDate: '',
    jurisdiction: DEFAULT_LEASE_JURISDICTION,
    ...overrides,
  };
  // Coerce so an override of `{jurisdiction: 'fee'}` or undefined still
  // lands on tx_fee instead of a structurally-invalid value.
  unit.jurisdiction = normalizeLeaseJurisdiction(unit.jurisdiction);
  return unit;
}

export function normalizeLeaseholdUnit(value: unknown): LeaseholdUnit {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createBlankLeaseholdUnit();
  }

  return createBlankLeaseholdUnit({
    name: asString((value as { name?: unknown }).name),
    description: asString((value as { description?: unknown }).description),
    operator: asString((value as { operator?: unknown }).operator),
    effectiveDate: asString((value as { effectiveDate?: unknown }).effectiveDate),
    jurisdiction: normalizeLeaseJurisdiction(
      (value as { jurisdiction?: unknown }).jurisdiction
    ),
  });
}

export function createBlankLeaseholdOrri(
  overrides: Partial<LeaseholdOrri> = {}
): LeaseholdOrri {
  return {
    id:
      overrides.id ?? `orri-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payee: '',
    scope: 'unit',
    unitCode: null,
    deskMapId: null,
    burdenFraction: '',
    burdenBasis: 'gross_8_8',
    effectiveDate: '',
    sourceDocNo: '',
    notes: '',
    ...overrides,
  };
}

export function normalizeLeaseholdOrri(
  value: unknown,
  options: { validDeskMapIds?: Set<string>; validUnitCodes?: Set<string> } = {}
): LeaseholdOrri {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createBlankLeaseholdOrri();
  }

  const record = value as {
    id?: unknown;
    payee?: unknown;
    scope?: unknown;
    unitCode?: unknown;
    deskMapId?: unknown;
    burdenFraction?: unknown;
    burdenBasis?: unknown;
    effectiveDate?: unknown;
    sourceDocNo?: unknown;
    notes?: unknown;
  };
  const scope = normalizeInterestScope(record.scope);
  const candidateDeskMapId = asString(record.deskMapId);
  const validDeskMapId = candidateDeskMapId.length > 0
    && (!options.validDeskMapIds || options.validDeskMapIds.has(candidateDeskMapId))
      ? candidateDeskMapId
      : null;

  return createBlankLeaseholdOrri({
    id: asString(record.id) || undefined,
    payee: asString(record.payee),
    scope,
    unitCode: scope === 'unit' ? normalizeUnitCode(record.unitCode, options) : null,
    deskMapId: scope === 'tract' ? validDeskMapId : null,
    burdenFraction: asString(record.burdenFraction),
    burdenBasis: normalizeOrriBurdenBasis(record.burdenBasis),
    effectiveDate: asString(record.effectiveDate),
    sourceDocNo: asString(record.sourceDocNo),
    notes: asString(record.notes),
  });
}

export function normalizeLeaseholdOrris(
  value: unknown,
  options: { validDeskMapIds?: Set<string>; validUnitCodes?: Set<string> } = {}
): LeaseholdOrri[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return [];
    }
    return [normalizeLeaseholdOrri(candidate, options)];
  });
}

export function createBlankLeaseholdAssignment(
  overrides: Partial<LeaseholdAssignment> = {}
): LeaseholdAssignment {
  return {
    id:
      overrides.id
      ?? `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    assignor: '',
    assignee: '',
    scope: 'unit',
    unitCode: null,
    deskMapId: null,
    workingInterestFraction: '',
    effectiveDate: '',
    sourceDocNo: '',
    notes: '',
    ...overrides,
  };
}

export function normalizeLeaseholdAssignment(
  value: unknown,
  options: { validDeskMapIds?: Set<string>; validUnitCodes?: Set<string> } = {}
): LeaseholdAssignment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createBlankLeaseholdAssignment();
  }

  const record = value as {
    id?: unknown;
    assignor?: unknown;
    assignee?: unknown;
    scope?: unknown;
    unitCode?: unknown;
    deskMapId?: unknown;
    workingInterestFraction?: unknown;
    effectiveDate?: unknown;
    sourceDocNo?: unknown;
    notes?: unknown;
  };
  const scope = normalizeInterestScope(record.scope);
  const candidateDeskMapId = asString(record.deskMapId);
  const validDeskMapId = candidateDeskMapId.length > 0
    && (!options.validDeskMapIds || options.validDeskMapIds.has(candidateDeskMapId))
      ? candidateDeskMapId
      : null;

  return createBlankLeaseholdAssignment({
    id: asString(record.id) || undefined,
    assignor: asString(record.assignor),
    assignee: asString(record.assignee),
    scope,
    unitCode: scope === 'unit' ? normalizeUnitCode(record.unitCode, options) : null,
    deskMapId: scope === 'tract' ? validDeskMapId : null,
    workingInterestFraction: asString(record.workingInterestFraction),
    effectiveDate: asString(record.effectiveDate),
    sourceDocNo: asString(record.sourceDocNo),
    notes: asString(record.notes),
  });
}

export function normalizeLeaseholdAssignments(
  value: unknown,
  options: { validDeskMapIds?: Set<string>; validUnitCodes?: Set<string> } = {}
): LeaseholdAssignment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return [];
    }
    return [normalizeLeaseholdAssignment(candidate, options)];
  });
}

export function createBlankLeaseholdTransferOrderEntry(
  overrides: Partial<LeaseholdTransferOrderEntry> = {}
): LeaseholdTransferOrderEntry {
  return {
    id:
      overrides.id
      ?? `transfer-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceRowId: '',
    ownerNumber: '',
    status: 'draft',
    notes: '',
    ...overrides,
  };
}

export function normalizeLeaseholdTransferOrderEntry(
  value: unknown
): LeaseholdTransferOrderEntry {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createBlankLeaseholdTransferOrderEntry();
  }

  const record = value as {
    id?: unknown;
    sourceRowId?: unknown;
    ownerNumber?: unknown;
    status?: unknown;
    notes?: unknown;
  };

  return createBlankLeaseholdTransferOrderEntry({
    id: asString(record.id) || undefined,
    sourceRowId: asString(record.sourceRowId),
    ownerNumber: asString(record.ownerNumber),
    status: normalizeTransferOrderStatus(record.status),
    notes: asString(record.notes),
  });
}

export function normalizeLeaseholdTransferOrderEntries(
  value: unknown
): LeaseholdTransferOrderEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return [];
    }
    const normalized = normalizeLeaseholdTransferOrderEntry(candidate);
    return normalized.sourceRowId ? [normalized] : [];
  });
}
