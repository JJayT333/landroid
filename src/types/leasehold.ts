export interface LeaseholdUnit {
  name: string;
  description: string;
  operator: string;
  effectiveDate: string;
}

export const LEASEHOLD_ORRI_SCOPE_OPTIONS = ['unit', 'tract'] as const;
export type LeaseholdOrriScope = (typeof LEASEHOLD_ORRI_SCOPE_OPTIONS)[number];

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
  deskMapId: string | null;
  burdenFraction: string;
  burdenBasis: LeaseholdOrriBurdenBasis;
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrriScope(value: unknown): LeaseholdOrriScope {
  return value === 'tract' ? 'tract' : 'unit';
}

function normalizeOrriBurdenBasis(value: unknown): LeaseholdOrriBurdenBasis {
  if (value === 'net_revenue_interest' || value === 'working_interest') {
    return value;
  }
  return 'gross_8_8';
}

export function createBlankLeaseholdUnit(
  overrides: Partial<LeaseholdUnit> = {}
): LeaseholdUnit {
  return {
    name: '',
    description: '',
    operator: '',
    effectiveDate: '',
    ...overrides,
  };
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
  options: { validDeskMapIds?: Set<string> } = {}
): LeaseholdOrri {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return createBlankLeaseholdOrri();
  }

  const record = value as {
    id?: unknown;
    payee?: unknown;
    scope?: unknown;
    deskMapId?: unknown;
    burdenFraction?: unknown;
    burdenBasis?: unknown;
    effectiveDate?: unknown;
    sourceDocNo?: unknown;
    notes?: unknown;
  };
  const scope = normalizeOrriScope(record.scope);
  const candidateDeskMapId = asString(record.deskMapId);
  const validDeskMapId = candidateDeskMapId.length > 0
    && (!options.validDeskMapIds || options.validDeskMapIds.has(candidateDeskMapId))
      ? candidateDeskMapId
      : null;

  return createBlankLeaseholdOrri({
    id: asString(record.id) || undefined,
    payee: asString(record.payee),
    scope,
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
  options: { validDeskMapIds?: Set<string> } = {}
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
