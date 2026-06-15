// Leasehold / transfer-order derivation for the unified title-math engine.
//
// Originally a faithful transcription of
// components/leasehold/leasehold-summary.ts (operation ORDER preserved
// field-by-field so the raw residue stayed byte-identical to the old engine).
// Since then it has diverged deliberately, each change guarded by the
// differential harness (Springhill is the oracle):
//   - DA-H1: a fixed NPRI is now satisfied from the lessor royalty first, with
//     only the excess charged to the WI (decision of record; see
//     `calculateOrriBasisRates` + the `fixedNpriExceedsRoyalty` flag).
//   - Stage B: FINAL display rates / unit totals / transfer-order terminals are
//     quantized to 9dp via `emitRate`; re-read intermediates stay full precision
//     (the per-tract string re-reads below are LOSSLESS — `d()` round-trips them
//     exactly, so they pin operation order, not value).
//   - DA-M5 ratification flag + unleased rows (additive).
// The lease-coverage dependency points at this engine's own ./coverage.
//
// Depth severance is not yet modeled; this module assumes
// `depthRange: 'all_depths'` on every node, lease, ORRI, and WI assignment.
// See `src/types/depth-range.ts` for the Phase 8 attachment point.
import { d, type Decimal } from '../../engine/decimal';
import { emitRate } from '../precision/emit';
import {
  isNpriNode,
  type DeskMap,
  type FixedRoyaltyBasis,
  type OwnershipNode,
  type RatificationStatus,
  type RoyaltyKind,
} from '../../types/node';
import type { Lease, Owner } from '../../types/owner';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdUnit,
} from '../../types/leasehold';
import {
  allocateLeaseCoverage,
  buildLeaseScopeIndex,
  getActiveLeases,
  getLeasesForOwnerNode,
  type LeaseCoverageOverlap,
} from './coverage';
import { parseStrictInterestString } from '../../utils/interest-string';

export type LeaseholdInputWarningSourceType = 'lease' | 'orri' | 'assignment';
export type LeaseholdInputWarningField =
  | 'royaltyRate'
  | 'burdenFraction'
  | 'workingInterestFraction';

export interface LeaseholdInputWarning {
  id: string;
  sourceType: LeaseholdInputWarningSourceType;
  sourceId: string;
  sourceLabel: string;
  field: LeaseholdInputWarningField;
  fieldLabel: string;
  value: string;
  message: string;
}

export type LeaseholdUnitAssignmentWarningSourceType = 'orri' | 'assignment';

export interface LeaseholdUnitAssignmentWarning {
  id: string;
  sourceType: LeaseholdUnitAssignmentWarningSourceType;
  sourceId: string;
  sourceLabel: string;
  message: string;
}

interface LeaseholdInputWarningContext {
  sourceType: LeaseholdInputWarningSourceType;
  sourceId: string;
  sourceLabel: string;
  field: LeaseholdInputWarningField;
  fieldLabel: string;
  value: string | number | null | undefined;
  deskMapId?: string | null;
}

type AddLeaseholdInputWarning = (context: LeaseholdInputWarningContext) => void;

export interface LeaseholdOwnerLeaseSummary {
  leaseId: string;
  leaseName: string;
  lessee: string;
  leaseEffectiveDate: string;
  leaseDocNo: string;
  leaseRoyaltyRate: string;
  leasedFraction: string;
  leasedPooledAcres: string;
  ownerTractRoyalty: string;
  unitRoyaltyDecimal: string;
  floatingNpriBurdenRate: string;
  floatingNpriUnitDecimal: string;
  fixedNpriBurdenRate: string;
  fixedNpriUnitDecimal: string;
  netOwnerTractRoyalty: string;
  netOwnerUnitRoyaltyDecimal: string;
}

export interface LeaseholdOwnerSummary {
  nodeId: string;
  ownerId: string | null;
  ownerName: string;
  fraction: string;
  netMineralAcres: string;
  netPooledAcres: string;
  leasedFraction: string;
  leasedPooledAcres: string;
  activeLeaseCount: number;
  lesseeNames: string[];
  ownerTractRoyalty: string;
  unitRoyaltyDecimal: string;
  floatingNpriBurdenRate: string;
  floatingNpriUnitDecimal: string;
  fixedNpriBurdenRate: string;
  fixedNpriUnitDecimal: string;
  totalNpriBurdenRate: string;
  totalNpriUnitDecimal: string;
  netOwnerTractRoyalty: string;
  netOwnerUnitRoyaltyDecimal: string;
  overFloatingNpriBurdened: boolean;
  leaseSlices: LeaseholdOwnerLeaseSummary[];
  /** Overlap warnings from `allocateLeaseCoverage` for this owner's leases. */
  leaseOverlaps: LeaseCoverageOverlap[];
}

export interface LeaseholdTractSummary {
  deskMapId: string;
  name: string;
  code: string;
  unitCode: string | null;
  unitName: string | null;
  tractId: string | null;
  grossAcres: string;
  pooledAcres: string;
  description: string;
  currentOwnership: string;
  leasedOwnership: string;
  unitParticipation: string;
  weightedRoyaltyRate: string;
  nriBeforeOrriRate: string;
  floatingNpriBurdenRate: string;
  fixedNpriBurdenRate: string;
  totalNpriBurdenRate: string;
  npriAdjustedNriBeforeOrriRate: string;
  grossOrriBurdenRate: string;
  workingInterestOrriBurdenRate: string;
  netRevenueInterestBaseRate: string;
  netRevenueInterestOrriBurdenRate: string;
  totalOrriBurdenRate: string;
  unitRoyaltyDecimal: string;
  unitNpriDecimal: string;
  unitOrriDecimal: string;
  preWorkingInterestDecimal: string;
  assignmentShare: string;
  assignedWorkingInterestDecimal: string;
  retainedWorkingInterestDecimal: string;
  overAssigned: boolean;
  /**
   * Warning flag: fixed NPRIs plus ORRI burdens on this tract exceed the
   * available NRI after lease royalty, so pre-WI has been clamped to 0.
   * Warning-only, matching the existing `overAssigned` convention.
   */
  overBurdened: boolean;
  /**
   * Warning flag: floating NPRIs on this tract exceed the available lease
   * royalty on at least one owner lease slice. The owner-side royalty row is
   * clamped to 0, but transfer-order review should still show a positive
   * variance until the title burden is resolved.
   */
  overFloatingNpriBurdened: boolean;
  /**
   * DA-H1 warning flag: a fixed NPRI on this tract exceeds the burdened lessor's
   * royalty (after floating), so the excess is charged to the working interest.
   * Warning-only; the wording recommends counsel sign-off before payout reliance
   * (the excess allocation rests on treatise consensus, not on-point SCOTX
   * authority).
   */
  fixedNpriExceedsRoyalty: boolean;
  /**
   * Aggregated lease-overlap warnings surfaced from this tract's owners. Each
   * entry is a lease that was silently clipped by `allocateLeaseCoverage`
   * because an earlier lease already claimed the owner's share.
   */
  leaseOverlaps: LeaseCoverageOverlap[];
  /**
   * Strict parser warnings for malformed lease royalty, ORRI burden, or WI
   * assignment inputs affecting this tract. Affected inputs are treated as 0
   * in math until corrected.
   */
  inputWarnings: LeaseholdInputWarning[];
  currentOwnerCount: number;
  includedAssignmentCount: number;
  trackedAssignmentCount: number;
  includedNpriCount: number;
  trackedNpriCount: number;
  includedOrriCount: number;
  trackedOrriCount: number;
  uniqueLessees: string[];
  owners: LeaseholdOwnerSummary[];
}

export interface LeaseholdOrriSummary {
  id: string;
  payee: string;
  scope: LeaseholdOrri['scope'];
  unitCode: string | null;
  deskMapId: string | null;
  tractName: string;
  burdenFraction: string;
  burdenBasis: LeaseholdOrri['burdenBasis'];
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
  includedInMath: boolean;
  needsUnitAssignment: boolean;
  unitDecimal: string;
}

export interface LeaseholdNpriSummary {
  id: string;
  payee: string;
  royaltyKind: Exclude<RoyaltyKind, null>;
  fixedRoyaltyBasis: Exclude<FixedRoyaltyBasis, null> | null;
  /**
   * DA-M5: pooling ratification. `'unknown'` (the default) and `'unratified'`
   * are computed unit-weighted but held on the transfer-order sheet until the
   * status is confirmed; only `'ratified'` is payout-reliable today. The
   * `'unratified'` tract-basis payout math is deferred pending counsel review.
   */
  ratificationStatus: RatificationStatus;
  deskMapId: string;
  tractName: string;
  tractCode: string;
  burdenFraction: string;
  burdenedBranchNodeId: string | null;
  burdenedBranchOwner: string;
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
  includedInMath: boolean;
  tractBurdenRate: string;
  unitDecimal: string;
}

export interface LeaseholdAssignmentSummary {
  id: string;
  assignor: string;
  assignee: string;
  scope: LeaseholdAssignment['scope'];
  unitCode: string | null;
  deskMapId: string | null;
  tractName: string;
  workingInterestFraction: string;
  /**
   * `workingInterestFraction` parsed once (with the warning sink) and gated by
   * `includedInMath`. Per-tract WI rows reuse this instead of re-parsing the raw
   * string, so the decimal ledger and the assignment cards agree (DA-M7).
   */
  workingInterestFractionDecimal: string;
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
  includedInMath: boolean;
  needsUnitAssignment: boolean;
  unitDecimal: string;
}

export interface LeaseholdUnitSummary {
  tractCount: number;
  totalGrossAcres: string;
  totalPooledAcres: string;
  totalRoyaltyDecimal: string;
  totalNpriDecimal: string;
  totalOrriDecimal: string;
  preWorkingInterestDecimal: string;
  totalAssignedWorkingInterestDecimal: string;
  retainedWorkingInterestDecimal: string;
  configuredGrossAcresCount: number;
  configuredPooledAcresCount: number;
  fullyLeasedTractCount: number;
  currentOwnerCount: number;
  trackedAssignmentCount: number;
  includedAssignmentCount: number;
  excludedAssignmentCount: number;
  overAssignedTractCount: number;
  /** Number of tracts whose `overBurdened` flag is set (warning-only). */
  overBurdenedTractCount: number;
  /** Number of tracts with floating NPRIs that over-carve the lease royalty. */
  overFloatingNpriBurdenedTractCount: number;
  /** DA-H1: number of tracts whose fixed NPRI exceeds the lessor royalty. */
  fixedNpriExceedsRoyaltyTractCount: number;
  /**
   * DA-M5: number of included NPRIs whose pooling ratification is not confirmed
   * (`'unknown'` or `'unratified'`). They are computed unit-weighted but should
   * be held on the transfer-order sheet until the status is confirmed.
   */
  npriRatificationHoldCount: number;
  /**
   * Number of tracts that have at least one lease-overlap warning. Warning-only;
   * affected tracts still roll up their clipped allocations and the leasehold
   * math still reaches a valid total, but the user should review the overlap.
   */
  leaseOverlapTractCount: number;
  /** Total count of individual overlap warnings across all tracts. */
  leaseOverlapWarningCount: number;
  /** Total count of malformed economic inputs that were excluded as 0. */
  inputWarningCount: number;
  inputWarnings: LeaseholdInputWarning[];
  /**
   * Unit-scoped ORRI/WI records with blank unit assignment in a coded-unit
   * workspace. They stay excluded by the existing math, but are surfaced here
   * so transfer-order review can hold until the user assigns a unit.
   */
  unitAssignmentWarningCount: number;
  unitAssignmentWarnings: LeaseholdUnitAssignmentWarning[];
  trackedOrriCount: number;
  includedOrriCount: number;
  excludedOrriCount: number;
  trackedNpriCount: number;
  includedNpriCount: number;
  excludedNpriCount: number;
  uniqueLessees: string[];
  assignments: LeaseholdAssignmentSummary[];
  npris: LeaseholdNpriSummary[];
  orris: LeaseholdOrriSummary[];
  tracts: LeaseholdTractSummary[];
  /**
   * Per-tract (`deskMapId` → ORRI id → burden rate) map of the sequential ORRI
   * carve computed once in the summary builder. Exposed so consumers — notably
   * `buildLeaseholdDecimalRows` — reuse it instead of recomputing the stack with
   * a divergent filter/parser (DA-M7). Only `includedInMath` ORRIs contribute to
   * the basis, matching the focused-decimal-row filter.
   */
  orriBurdenRateByTractId: Map<string, Map<string, Decimal>>;
}

export type LeaseholdDecimalRowKind =
  | 'royalty'
  | 'npri'
  | 'orri'
  | 'retained_wi'
  | 'assigned_wi'
  // A mineral owner's interest that is not under any active lease. Cost-bearing,
  // surfaced so the transfer-order sheet accounts for 100% of the tract (the
  // owner still holds an unleased mineral interest, not just the leased share).
  | 'unleased';

export interface LeaseholdDecimalRow {
  id: string;
  category: LeaseholdDecimalRowKind;
  payee: string;
  tractName: string;
  tractCode: string;
  sourceLabel: string;
  effectiveDate: string;
  sourceDocNo: string;
  decimal: string;
}

export interface LeaseholdTransferOrderCategorySummary {
  category: LeaseholdDecimalRowKind;
  rowCount: number;
  totalDecimal: string;
}

export interface LeaseholdTransferOrderReview {
  rows: LeaseholdDecimalRow[];
  totalDecimal: string;
  expectedDecimal: string;
  varianceDecimal: string;
  categorySummaries: LeaseholdTransferOrderCategorySummary[];
  reviewableRowCount: number;
  rowsWithCompleteSource: number;
  rowsWithSourceGap: number;
  rowsMissingEffectiveDate: number;
  rowsMissingSourceDocNo: number;
}

export const LEASEHOLD_DECIMAL_CATEGORY_ORDER: Record<LeaseholdDecimalRowKind, number> = {
  royalty: 0,
  npri: 1,
  orri: 2,
  retained_wi: 3,
  assigned_wi: 4,
  unleased: 5,
};

function nameOwner(node: OwnershipNode, ownerById: Map<string, Owner>): string {
  if (!node.linkedOwnerId) {
    return node.grantee || 'Unlinked Owner';
  }

  return ownerById.get(node.linkedOwnerId)?.name || node.grantee || 'Linked Owner';
}

function currentMineralOwners(nodes: OwnershipNode[]) {
  return nodes.filter(
    (node) => node.type !== 'related' && !isNpriNode(node) && d(node.fraction).greaterThan(0)
  );
}

function currentNpriOwners(nodes: OwnershipNode[]) {
  return nodes.filter(
    (node) => node.type !== 'related' && isNpriNode(node) && d(node.fraction).greaterThan(0)
  );
}

function invalidInterestWarningMessage({
  fieldLabel,
  sourceLabel,
}: Pick<LeaseholdInputWarningContext, 'fieldLabel' | 'sourceLabel'>): string {
  return `${fieldLabel} on ${sourceLabel} is not a valid decimal or fraction from 0 to 1; treated as 0 in leasehold math.`;
}

function leaseholdInputWarningId({
  sourceType,
  sourceId,
  field,
}: Pick<LeaseholdInputWarningContext, 'sourceType' | 'sourceId' | 'field'>): string {
  return `${sourceType}:${sourceId}:${field}`;
}

function parseLeaseholdMathInterest(
  value: string | number | null | undefined,
  warningContext?: LeaseholdInputWarningContext,
  addWarning?: AddLeaseholdInputWarning
) {
  const parsed = parseStrictInterestString(value);
  if (parsed !== null) {
    return parsed;
  }

  if (warningContext && addWarning) {
    addWarning(warningContext);
  }
  return d(0);
}

function leaseSourceLabel(lease: Pick<Lease, 'id' | 'leaseName' | 'lessee'>): string {
  return lease.leaseName.trim() || lease.lessee.trim() || `Lease ${lease.id}`;
}

function orriSourceLabel(orri: Pick<LeaseholdOrri, 'id' | 'payee'>): string {
  return orri.payee.trim() || `ORRI ${orri.id}`;
}

function assignmentSourceLabel(
  assignment: Pick<LeaseholdAssignment, 'id' | 'assignor' | 'assignee'>
): string {
  return assignment.assignee.trim()
    || assignment.assignor.trim()
    || `WI assignment ${assignment.id}`;
}

function effectiveNpriRoyaltyKind(node: OwnershipNode): Exclude<RoyaltyKind, null> {
  return node.royaltyKind === 'floating' ? 'floating' : 'fixed';
}

function effectiveFixedNpriBasis(
  node: OwnershipNode
): Exclude<FixedRoyaltyBasis, null> | null {
  if (node.royaltyKind === 'floating') {
    return null;
  }
  return node.fixedRoyaltyBasis === 'whole_tract' ? 'whole_tract' : 'burdened_branch';
}

/**
 * DA-M5: an NPRI's pooling-ratification status. Absent (legacy / unset) is read
 * as `'unknown'`, so the engine no longer silently assumes ratification.
 */
function effectiveNpriRatification(node: OwnershipNode): RatificationStatus {
  return node.ratificationStatus ?? 'unknown';
}

function findBurdenedMineralAncestorId(
  node: OwnershipNode,
  nodeById: Map<string, OwnershipNode>
): string | null {
  let cursor = node.parentId ? nodeById.get(node.parentId) ?? null : null;

  while (cursor) {
    if (!isNpriNode(cursor) && cursor.type !== 'related') {
      return cursor.id;
    }
    cursor = cursor.parentId ? nodeById.get(cursor.parentId) ?? null : null;
  }

  return null;
}

function collectMineralAncestorIds(
  node: OwnershipNode,
  nodeById: Map<string, OwnershipNode>
): Set<string> {
  const ancestorIds = new Set<string>();
  let cursor: OwnershipNode | null = node;

  while (cursor) {
    if (!isNpriNode(cursor) && cursor.type !== 'related') {
      ancestorIds.add(cursor.id);
    }
    cursor = cursor.parentId ? nodeById.get(cursor.parentId) ?? null : null;
  }

  return ancestorIds;
}

function buildOwnerLeaseSummaries({
  leases,
  ownerFraction,
  tractPooledAcres,
  totalPooledAcres,
  deskMapId,
  addInputWarning,
}: {
  leases: Lease[];
  ownerFraction: ReturnType<typeof d>;
  tractPooledAcres: ReturnType<typeof d>;
  totalPooledAcres: ReturnType<typeof d>;
  deskMapId: string;
  addInputWarning: AddLeaseholdInputWarning;
}): { slices: LeaseholdOwnerLeaseSummary[]; overlaps: LeaseCoverageOverlap[] } {
  const { allocations, overlaps } = allocateLeaseCoverage(
    leases,
    ownerFraction.toString()
  );
  const slices = allocations.map(({ lease, allocatedFraction }) => {
    const leaseFraction = d(allocatedFraction);
    const leasedPooledAcres = tractPooledAcres.times(leaseFraction);
    const leaseRoyaltyRate = parseLeaseholdMathInterest(
      lease.royaltyRate,
      {
        sourceType: 'lease',
        sourceId: lease.id,
        sourceLabel: leaseSourceLabel(lease),
        field: 'royaltyRate',
        fieldLabel: 'Lease royalty',
        value: lease.royaltyRate,
        deskMapId,
      },
      addInputWarning
    );
    const ownerTractRoyalty = leaseFraction.times(leaseRoyaltyRate);
    const unitRoyaltyDecimal = totalPooledAcres.greaterThan(0)
      ? leasedPooledAcres.div(totalPooledAcres).times(leaseRoyaltyRate)
      : d(0);

    return {
      leaseId: lease.id,
      leaseName: lease.leaseName,
      lessee: lease.lessee,
      leaseEffectiveDate: lease.effectiveDate,
      leaseDocNo: lease.docNo,
      leaseRoyaltyRate: lease.royaltyRate,
      leasedFraction: leaseFraction.toString(),
      leasedPooledAcres: leasedPooledAcres.toString(),
      ownerTractRoyalty: ownerTractRoyalty.toString(),
      unitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
      floatingNpriBurdenRate: '0',
      floatingNpriUnitDecimal: '0',
      fixedNpriBurdenRate: '0',
      fixedNpriUnitDecimal: '0',
      netOwnerTractRoyalty: ownerTractRoyalty.toString(),
      netOwnerUnitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
    };
  });

  return { slices, overlaps };
}

function sumDecimalStrings(values: string[]) {
  return values.reduce((sum, value) => sum.plus(d(value)), d(0));
}

type OrriBurdenRecord = Pick<
  LeaseholdOrri,
  'id' | 'burdenBasis' | 'burdenFraction' | 'effectiveDate' | 'sourceDocNo'
>;

function compareOrriStackingOrder(left: OrriBurdenRecord, right: OrriBurdenRecord) {
  const leftDate = left.effectiveDate.trim() || '9999-12-31';
  const rightDate = right.effectiveDate.trim() || '9999-12-31';
  const leftDoc = left.sourceDocNo.trim();
  const rightDoc = right.sourceDocNo.trim();

  return `${leftDate}|${leftDoc}|${left.id}`.localeCompare(
    `${rightDate}|${rightDoc}|${right.id}`
  );
}

function calculateOrriBasisRates<T extends OrriBurdenRecord>({
  leasedOwnership,
  weightedRoyaltyRate,
  fixedNpriExcessRate,
  orris,
  parseBurdenFraction,
}: {
  leasedOwnership: ReturnType<typeof d>;
  weightedRoyaltyRate: ReturnType<typeof d>;
  /** DA-H1: only the fixed-NPRI EXCESS over the lessor royalty burdens the WI. */
  fixedNpriExcessRate: ReturnType<typeof d>;
  orris: T[];
  parseBurdenFraction?: (orri: T) => ReturnType<typeof d>;
}) {
  const grossBasisOrris = orris.filter((orri) => orri.burdenBasis === 'gross_8_8');
  const workingInterestBasisOrris = orris.filter(
    (orri) => orri.burdenBasis === 'working_interest'
  );
  const netRevenueInterestBasisOrris = [...orris]
    .filter((orri) => orri.burdenBasis === 'net_revenue_interest')
    .sort(compareOrriStackingOrder);
  const orriBurdenRateById = new Map<string, ReturnType<typeof d>>();

  const nriBeforeOrriRate = leasedOwnership.minus(weightedRoyaltyRate);
  const safeNriBeforeOrriRate = nriBeforeOrriRate.greaterThan(0)
    ? nriBeforeOrriRate
    : d(0);
  // DA-H1: a fixed NPRI is satisfied out of the burdened lessor's royalty first
  // (handled per-slice in the owner net-royalty fold); only the EXCESS over that
  // royalty burdens the working interest. So the WI's NRI is reduced by the
  // fixed-NPRI excess, not the full fixed burden (decision of record:
  // CONTINUATION-PROMPT.md; LANDMAN-MATH-REFERENCE.md s7). The per-slice/tract
  // `fixedNpriExceedsRoyalty` warning recommends counsel sign-off before payout
  // reliance.
  const npriAdjustedNriBeforeOrriRate = safeNriBeforeOrriRate.minus(fixedNpriExcessRate);
  const safeNpriAdjustedNriBeforeOrriRate = npriAdjustedNriBeforeOrriRate.greaterThan(0)
    ? npriAdjustedNriBeforeOrriRate
    : d(0);
  const parseOrriBurdenFraction = parseBurdenFraction
    ?? ((orri: T) => parseLeaseholdMathInterest(orri.burdenFraction));
  const grossOrriBurdenRate = grossBasisOrris.reduce((sum, orri) => {
    const burdenRate = leasedOwnership.times(parseOrriBurdenFraction(orri));
    orriBurdenRateById.set(orri.id, burdenRate);
    return sum.plus(burdenRate);
  }, d(0));
  const workingInterestOrriBurdenRate = workingInterestBasisOrris.reduce((sum, orri) => {
    // Working-interest ORRIs are carved from the full leased working interest (8/8 of the
    // leasehold estate), not from the lessee's after-royalty share. A "1/80 of WI" ORRI
    // therefore produces leasedOwnership × 1/80 regardless of the lease royalty rate.
    const burdenRate = leasedOwnership.times(parseOrriBurdenFraction(orri));
    orriBurdenRateById.set(orri.id, burdenRate);
    return sum.plus(burdenRate);
  }, d(0));
  const netRevenueInterestBaseRate = safeNpriAdjustedNriBeforeOrriRate
    .minus(grossOrriBurdenRate)
    .minus(workingInterestOrriBurdenRate);
  let safeNetRevenueInterestBaseRate = netRevenueInterestBaseRate.greaterThan(0)
    ? netRevenueInterestBaseRate
    : d(0);
  const netRevenueInterestOrriBurdenRate = netRevenueInterestBasisOrris.reduce(
    (sum, orri) => {
      const burdenRate = safeNetRevenueInterestBaseRate.times(
        parseOrriBurdenFraction(orri)
      );
      orriBurdenRateById.set(orri.id, burdenRate);
      safeNetRevenueInterestBaseRate = safeNetRevenueInterestBaseRate.minus(burdenRate);
      if (safeNetRevenueInterestBaseRate.isNegative()) {
        safeNetRevenueInterestBaseRate = d(0);
      }
      return sum.plus(burdenRate);
    },
    d(0)
  );
  const totalOrriBurdenRate = grossOrriBurdenRate
    .plus(workingInterestOrriBurdenRate)
    .plus(netRevenueInterestOrriBurdenRate);

  return {
    nriBeforeOrriRate: safeNriBeforeOrriRate,
    npriAdjustedNriBeforeOrriRate: safeNpriAdjustedNriBeforeOrriRate,
    grossOrriBurdenRate,
    workingInterestOrriBurdenRate,
    netRevenueInterestBaseRate: netRevenueInterestBaseRate.greaterThan(0)
      ? netRevenueInterestBaseRate
      : d(0),
    netRevenueInterestOrriBurdenRate,
    totalOrriBurdenRate,
    orriBurdenRateById,
  };
}

function formatOrriBasisSourceLabel(burdenBasis: LeaseholdOrri['burdenBasis']) {
  switch (burdenBasis) {
    case 'working_interest':
      return 'WI basis';
    case 'net_revenue_interest':
      return 'NRI basis';
    case 'gross_8_8':
    default:
      return 'Gross 8/8';
  }
}

function formatNpriSourceLabel(
  royaltyKind: LeaseholdNpriSummary['royaltyKind'],
  burdenFraction: string,
  fixedRoyaltyBasis: LeaseholdNpriSummary['fixedRoyaltyBasis']
) {
  return royaltyKind === 'floating'
    ? `Floating NPRI • ${burdenFraction || '—'} of lease royalty`
    : `Fixed NPRI • ${burdenFraction || '—'} ${
        fixedRoyaltyBasis === 'whole_tract' ? 'of whole tract' : 'of burdened branch'
      }`;
}

function unitRecordAppliesToDeskMap(
  recordUnitCode: string | null | undefined,
  deskMap: Pick<DeskMap, 'unitCode'>
): boolean {
  const deskMapUnitCode = deskMap.unitCode ?? null;
  const normalizedRecordUnitCode = recordUnitCode ?? null;
  return deskMapUnitCode
    ? normalizedRecordUnitCode === deskMapUnitCode
    : normalizedRecordUnitCode === null;
}

function normalizeUnitCode(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function unitRecordNeedsAssignment(
  record: Pick<LeaseholdOrri | LeaseholdAssignment, 'scope' | 'unitCode'>,
  hasCodedUnitFocus: boolean
): boolean {
  return hasCodedUnitFocus && record.scope === 'unit' && normalizeUnitCode(record.unitCode) === null;
}

function orriAppliesToDeskMap(orri: LeaseholdOrri, deskMap: DeskMap): boolean {
  return orri.scope === 'tract'
    ? orri.deskMapId === deskMap.id
    : unitRecordAppliesToDeskMap(orri.unitCode, deskMap);
}

function assignmentAppliesToDeskMap(
  assignment: LeaseholdAssignment,
  deskMap: DeskMap
): boolean {
  return assignment.scope === 'tract'
    ? assignment.deskMapId === deskMap.id
    : unitRecordAppliesToDeskMap(assignment.unitCode, deskMap);
}

function unitScopedTracts<T extends { scope: 'unit' | 'tract'; unitCode?: string | null }>(
  record: T,
  tracts: LeaseholdTractSummary[],
  deskMapById: Map<string, DeskMap>
): LeaseholdTractSummary[] {
  if (record.scope !== 'unit') {
    return [];
  }

  return tracts.filter((tract) => {
    const deskMap = deskMapById.get(tract.deskMapId);
    return deskMap ? unitRecordAppliesToDeskMap(record.unitCode, deskMap) : false;
  });
}

function unitScopedName(
  unitCode: string | null | undefined,
  tracts: LeaseholdTractSummary[],
  deskMapById: Map<string, DeskMap>
): string {
  const firstTract = tracts.find((tract) => {
    const deskMap = deskMapById.get(tract.deskMapId);
    return deskMap ? unitRecordAppliesToDeskMap(unitCode, deskMap) : false;
  });
  const firstDeskMap = firstTract ? deskMapById.get(firstTract.deskMapId) : null;
  return firstDeskMap?.unitName ?? (unitCode ? `Unit ${unitCode}` : 'Unit-wide');
}

function summaryRecordAppliesToFocusedTract(
  record: {
    scope: 'unit' | 'tract';
    unitCode?: string | null;
    deskMapId: string | null;
    includedInMath: boolean;
  },
  focusedTract: Pick<LeaseholdTractSummary, 'deskMapId' | 'unitCode'>
): boolean {
  if (!record.includedInMath) {
    return false;
  }
  if (record.scope === 'tract') {
    return record.deskMapId === focusedTract.deskMapId;
  }
  const focusedUnitCode = focusedTract.unitCode ?? null;
  const recordUnitCode = record.unitCode ?? null;
  return focusedUnitCode ? recordUnitCode === focusedUnitCode : recordUnitCode === null;
}

export function buildLeaseholdUnitSummary({
  deskMaps,
  nodes,
  owners,
  leases,
  leaseholdAssignments,
  leaseholdOrris,
}: {
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
  owners: Owner[];
  leases: Lease[];
  leaseholdAssignments: LeaseholdAssignment[];
  leaseholdOrris: LeaseholdOrri[];
}): LeaseholdUnitSummary {
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
  const deskMapById = new Map(deskMaps.map((deskMap) => [deskMap.id, deskMap]));
  const hasCodedUnitFocus = deskMaps.some((deskMap) => normalizeUnitCode(deskMap.unitCode) !== null);
  const leaseScopeIndex = buildLeaseScopeIndex(nodes);
  const activeLeasesByOwnerId = new Map<string, Lease[]>();

  leases.forEach((lease) => {
    const existing = activeLeasesByOwnerId.get(lease.ownerId) ?? [];
    existing.push(lease);
    activeLeasesByOwnerId.set(lease.ownerId, existing);
  });

  [...activeLeasesByOwnerId.entries()].forEach(([ownerId, ownerLeases]) => {
    const activeLeases = getActiveLeases(ownerLeases);
    if (activeLeases.length === 0) {
      activeLeasesByOwnerId.delete(ownerId);
      return;
    }
    activeLeasesByOwnerId.set(ownerId, activeLeases);
  });

  const totalGrossAcres = deskMaps.reduce(
    (sum, deskMap) => sum.plus(d(deskMap.grossAcres)),
    d(0)
  );
  const totalPooledAcres = deskMaps.reduce(
    (sum, deskMap) => sum.plus(d(deskMap.pooledAcres)),
    d(0)
  );
  const npriSummariesByTractId = new Map<string, LeaseholdNpriSummary[]>();
  const orriBurdenRateByTractId = new Map<
    string,
    ReturnType<typeof calculateOrriBasisRates>['orriBurdenRateById']
  >();
  const inputWarnings: LeaseholdInputWarning[] = [];
  const inputWarningById = new Map<string, LeaseholdInputWarning>();
  const inputWarningsByTractId = new Map<string, LeaseholdInputWarning[]>();
  const inputWarningIdsByTractId = new Map<string, Set<string>>();
  const unitAssignmentWarnings = new Map<string, LeaseholdUnitAssignmentWarning>();
  const addUnitAssignmentWarning = (
    warning: Omit<LeaseholdUnitAssignmentWarning, 'message'>
  ) => {
    if (unitAssignmentWarnings.has(warning.id)) {
      return;
    }
    unitAssignmentWarnings.set(warning.id, {
      ...warning,
      message: `${warning.sourceLabel} is excluded - needs unit assignment.`,
    });
  };
  const addInputWarning: AddLeaseholdInputWarning = (context) => {
    const id = leaseholdInputWarningId(context);
    const rawValue = context.value === undefined || context.value === null
      ? ''
      : String(context.value);
    let warning = inputWarningById.get(id);
    if (!warning) {
      warning = {
        id,
        sourceType: context.sourceType,
        sourceId: context.sourceId,
        sourceLabel: context.sourceLabel,
        field: context.field,
        fieldLabel: context.fieldLabel,
        value: rawValue,
        message: invalidInterestWarningMessage(context),
      };
      inputWarningById.set(id, warning);
      inputWarnings.push(warning);
    }

    if (!context.deskMapId) {
      return;
    }
    const tractWarningIds = inputWarningIdsByTractId.get(context.deskMapId) ?? new Set<string>();
    if (tractWarningIds.has(id)) {
      return;
    }
    tractWarningIds.add(id);
    inputWarningIdsByTractId.set(context.deskMapId, tractWarningIds);

    const tractWarnings = inputWarningsByTractId.get(context.deskMapId) ?? [];
    tractWarnings.push(warning);
    inputWarningsByTractId.set(context.deskMapId, tractWarnings);
  };

  // Mirror the ORRI-summary `includedInMath` rule (see the `orris` build below)
  // so the sequential burden stack is computed from the same record set the
  // focused decimal rows filter on (`summaryRecordAppliesToFocusedTract`).
  // Tract-scoped ORRIs are included iff they resolve to a real desk map;
  // unit-scoped ORRIs iff at least one desk map in their unit has positive
  // participation (i.e. positive pooled acres). Excluded unit ORRIs only ever
  // apply to zero-participation tracts, whose ORRI decimals are 0 regardless, so
  // dropping them from the basis is golden-safe while removing the divergence
  // that DA-M7 flagged between the builder and `buildLeaseholdDecimalRows`.
  const orriIncludedInMath = (orri: LeaseholdOrri): boolean =>
    orri.scope === 'tract'
      ? orri.deskMapId != null && deskMapById.has(orri.deskMapId)
      : totalPooledAcres.greaterThan(0) &&
        deskMaps.some(
          (deskMap) =>
            unitRecordAppliesToDeskMap(orri.unitCode, deskMap) &&
            d(deskMap.pooledAcres).greaterThan(0)
        );
  // The predicate is the same for every tract, so resolve it once here rather
  // than re-scanning `deskMaps` for each tract's `relevantOrris` filter below.
  const includedOrriIds = new Set(
    leaseholdOrris.filter(orriIncludedInMath).map((orri) => orri.id)
  );

  const tracts = deskMaps.map((deskMap) => {
    const nodeIds = new Set(deskMap.nodeIds);
    const tractNodes = nodes.filter((node) => nodeIds.has(node.id));
    const nodeById = new Map(tractNodes.map((node) => [node.id, node]));
    const presentOwners = currentMineralOwners(tractNodes);
    const presentNpriHolders = currentNpriOwners(tractNodes);
    const tractGrossAcres = d(deskMap.grossAcres);
    const tractPooledAcres = d(deskMap.pooledAcres);
    const unitParticipation = totalPooledAcres.greaterThan(0)
      ? tractPooledAcres.div(totalPooledAcres)
      : d(0);
    const currentOwnership = presentOwners.reduce(
      (sum, node) => sum.plus(d(node.fraction)),
      d(0)
    );

    const ownersForTract = presentOwners
      .map((node) => {
        const ownerFraction = d(node.fraction);
        const ownerLeases = node.linkedOwnerId
          ? getLeasesForOwnerNode(
              activeLeasesByOwnerId.get(node.linkedOwnerId) ?? [],
              node,
              leaseScopeIndex
            )
          : [];
        const { slices: leaseSlices, overlaps: leaseOverlaps } = buildOwnerLeaseSummaries({
          leases: ownerLeases,
          ownerFraction,
          tractPooledAcres,
          totalPooledAcres,
          deskMapId: deskMap.id,
          addInputWarning,
        });
        const leasedFraction = sumDecimalStrings(leaseSlices.map((lease) => lease.leasedFraction));
        const netMineralAcres = tractGrossAcres.times(ownerFraction);
        const netPooledAcres = tractPooledAcres.times(ownerFraction);
        const leasedPooledAcres = sumDecimalStrings(
          leaseSlices.map((lease) => lease.leasedPooledAcres)
        );
        const ownerTractRoyalty = sumDecimalStrings(
          leaseSlices.map((lease) => lease.ownerTractRoyalty)
        );
        const unitRoyaltyDecimal = sumDecimalStrings(
          leaseSlices.map((lease) => lease.unitRoyaltyDecimal)
        );
        const lesseeNames = [...new Set(
          leaseSlices
            .map((lease) => lease.lessee.trim())
            .filter((lessee) => lessee.length > 0)
        )];

        return {
          nodeId: node.id,
          ownerId: node.linkedOwnerId,
          ownerName: nameOwner(node, ownerById),
          fraction: ownerFraction.toString(),
          netMineralAcres: netMineralAcres.toString(),
          netPooledAcres: netPooledAcres.toString(),
          leasedFraction: leasedFraction.toString(),
          leasedPooledAcres: leasedPooledAcres.toString(),
          activeLeaseCount: leaseSlices.length,
          lesseeNames,
          ownerTractRoyalty: ownerTractRoyalty.toString(),
          unitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
          floatingNpriBurdenRate: '0',
          floatingNpriUnitDecimal: '0',
          fixedNpriBurdenRate: '0',
          fixedNpriUnitDecimal: '0',
          totalNpriBurdenRate: '0',
          totalNpriUnitDecimal: '0',
          netOwnerTractRoyalty: ownerTractRoyalty.toString(),
          netOwnerUnitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
          overFloatingNpriBurdened: false,
          leaseSlices,
          leaseOverlaps,
        };
      })
      .sort((left, right) => {
        const acreDiff = d(right.netMineralAcres).comparedTo(d(left.netMineralAcres));
        if (acreDiff !== 0) {
          return acreDiff;
        }
        return left.ownerName.localeCompare(right.ownerName);
      });
    const ownerMineralAncestorIdsByNodeId = new Map(
      ownersForTract.map((owner) => [
        owner.nodeId,
        collectMineralAncestorIds(nodeById.get(owner.nodeId)!, nodeById),
      ])
    );
    const nprisForTract = presentNpriHolders.map((node) => {
      const royaltyKind = effectiveNpriRoyaltyKind(node);
      const fixedRoyaltyBasis = effectiveFixedNpriBasis(node);
      const ratificationStatus = effectiveNpriRatification(node);
      const burdenedMineralAncestorId = findBurdenedMineralAncestorId(node, nodeById);
      const burdenedBranchOwner =
        burdenedMineralAncestorId && nodeById.get(burdenedMineralAncestorId)
          ? nameOwner(nodeById.get(burdenedMineralAncestorId)!, ownerById)
          : 'Unassigned mineral branch';
      const burdenFraction = d(node.fraction);
      const applicableOwners = burdenedMineralAncestorId
        ? ownersForTract.filter((owner) =>
            ownerMineralAncestorIdsByNodeId.get(owner.nodeId)?.has(burdenedMineralAncestorId)
          )
        : [];
      const burdenedBranchOwnership = applicableOwners.reduce(
        (sum, owner) => sum.plus(d(owner.fraction)),
        d(0)
      );
      let tractBurdenRate = d(0);
      let unitDecimal = d(0);

      applicableOwners.forEach((owner) => {
        owner.leaseSlices.forEach((leaseSlice) => {
          const leasedFraction = d(leaseSlice.leasedFraction);
          if (!leasedFraction.greaterThan(0)) {
            return;
          }

          const leaseRoyaltyRate = parseLeaseholdMathInterest(
            leaseSlice.leaseRoyaltyRate,
            {
              sourceType: 'lease',
              sourceId: leaseSlice.leaseId,
              sourceLabel: leaseSlice.leaseName.trim()
                || leaseSlice.lessee.trim()
                || `Lease ${leaseSlice.leaseId}`,
              field: 'royaltyRate',
              fieldLabel: 'Lease royalty',
              value: leaseSlice.leaseRoyaltyRate,
              deskMapId: deskMap.id,
            },
            addInputWarning
          );
          const burdenRate = royaltyKind === 'floating'
            ? leasedFraction.times(leaseRoyaltyRate).times(burdenFraction)
            : fixedRoyaltyBasis === 'whole_tract' && burdenedBranchOwnership.greaterThan(0)
              ? leasedFraction.div(burdenedBranchOwnership).times(burdenFraction)
              : leasedFraction.times(burdenFraction);
          const burdenUnitDecimal = unitParticipation.times(burdenRate);

          tractBurdenRate = tractBurdenRate.plus(burdenRate);
          unitDecimal = unitDecimal.plus(burdenUnitDecimal);

          if (royaltyKind === 'floating') {
            leaseSlice.floatingNpriBurdenRate = d(leaseSlice.floatingNpriBurdenRate)
              .plus(burdenRate)
              .toString();
            leaseSlice.floatingNpriUnitDecimal = d(leaseSlice.floatingNpriUnitDecimal)
              .plus(burdenUnitDecimal)
              .toString();
          } else {
            leaseSlice.fixedNpriBurdenRate = d(leaseSlice.fixedNpriBurdenRate)
              .plus(burdenRate)
              .toString();
            leaseSlice.fixedNpriUnitDecimal = d(leaseSlice.fixedNpriUnitDecimal)
              .plus(burdenUnitDecimal)
              .toString();
          }
        });
      });

      return {
        id: node.id,
        payee: nameOwner(node, ownerById),
        royaltyKind,
        fixedRoyaltyBasis,
        ratificationStatus,
        deskMapId: deskMap.id,
        tractName: deskMap.name,
        tractCode: deskMap.code,
        burdenFraction: node.fraction,
        burdenedBranchNodeId: burdenedMineralAncestorId,
        burdenedBranchOwner,
        effectiveDate: node.date || node.fileDate,
        sourceDocNo: node.docNo,
        notes: node.remarks,
        includedInMath: tractBurdenRate.greaterThan(0),
        tractBurdenRate: tractBurdenRate.toString(),
        unitDecimal: unitDecimal.toString(),
      };
    });
    npriSummariesByTractId.set(deskMap.id, nprisForTract);

    // DA-H1: a fixed NPRI is satisfied first out of the burdened lessor's
    // royalty (after floating NPRIs have already netted), and only the EXCESS
    // (if the fixed burden is larger than the remaining royalty) is charged to
    // the working interest. We accumulate the per-slice excess so the WI-side
    // deduction below uses excess, not the full fixed burden.
    let tractFixedNpriExcessRate = d(0);
    let tractFixedNpriExceedsRoyalty = false;
    ownersForTract.forEach((owner) => {
      owner.leaseSlices = owner.leaseSlices.map((leaseSlice) => {
        const royaltyAfterFloating = d(leaseSlice.ownerTractRoyalty).minus(
          d(leaseSlice.floatingNpriBurdenRate)
        );
        const safeRoyaltyAfterFloating = royaltyAfterFloating.greaterThan(0)
          ? royaltyAfterFloating
          : d(0);
        const fixedBurden = d(leaseSlice.fixedNpriBurdenRate);
        const fixedCoveredByRoyalty = fixedBurden.greaterThan(safeRoyaltyAfterFloating)
          ? safeRoyaltyAfterFloating
          : fixedBurden;
        const fixedExcess = fixedBurden.minus(fixedCoveredByRoyalty);
        if (fixedExcess.greaterThan(0)) {
          tractFixedNpriExceedsRoyalty = true;
        }
        tractFixedNpriExcessRate = tractFixedNpriExcessRate.plus(fixedExcess);

        const unitRoyaltyAfterFloating = d(leaseSlice.unitRoyaltyDecimal).minus(
          d(leaseSlice.floatingNpriUnitDecimal)
        );
        const safeUnitRoyaltyAfterFloating = unitRoyaltyAfterFloating.greaterThan(0)
          ? unitRoyaltyAfterFloating
          : d(0);
        const fixedUnitBurden = d(leaseSlice.fixedNpriUnitDecimal);
        const fixedCoveredByUnitRoyalty = fixedUnitBurden.greaterThan(safeUnitRoyaltyAfterFloating)
          ? safeUnitRoyaltyAfterFloating
          : fixedUnitBurden;

        const netOwnerTractRoyalty = safeRoyaltyAfterFloating.minus(fixedCoveredByRoyalty);
        const netOwnerUnitRoyaltyDecimal = safeUnitRoyaltyAfterFloating.minus(
          fixedCoveredByUnitRoyalty
        );

        return {
          ...leaseSlice,
          netOwnerTractRoyalty: netOwnerTractRoyalty.greaterThan(0)
            ? netOwnerTractRoyalty.toString()
            : '0',
          netOwnerUnitRoyaltyDecimal: netOwnerUnitRoyaltyDecimal.greaterThan(0)
            ? netOwnerUnitRoyaltyDecimal.toString()
            : '0',
        };
      });

      owner.floatingNpriBurdenRate = sumDecimalStrings(
        owner.leaseSlices.map((leaseSlice) => leaseSlice.floatingNpriBurdenRate)
      ).toString();
      owner.floatingNpriUnitDecimal = sumDecimalStrings(
        owner.leaseSlices.map((leaseSlice) => leaseSlice.floatingNpriUnitDecimal)
      ).toString();
      owner.fixedNpriBurdenRate = sumDecimalStrings(
        owner.leaseSlices.map((leaseSlice) => leaseSlice.fixedNpriBurdenRate)
      ).toString();
      owner.fixedNpriUnitDecimal = sumDecimalStrings(
        owner.leaseSlices.map((leaseSlice) => leaseSlice.fixedNpriUnitDecimal)
      ).toString();
      owner.totalNpriBurdenRate = d(owner.floatingNpriBurdenRate)
        .plus(d(owner.fixedNpriBurdenRate))
        .toString();
      owner.totalNpriUnitDecimal = d(owner.floatingNpriUnitDecimal)
        .plus(d(owner.fixedNpriUnitDecimal))
        .toString();
      owner.netOwnerTractRoyalty = sumDecimalStrings(
        owner.leaseSlices.map((leaseSlice) => leaseSlice.netOwnerTractRoyalty)
      ).toString();
      owner.netOwnerUnitRoyaltyDecimal = sumDecimalStrings(
        owner.leaseSlices.map((leaseSlice) => leaseSlice.netOwnerUnitRoyaltyDecimal)
      ).toString();
      owner.overFloatingNpriBurdened = owner.leaseSlices.some((leaseSlice) =>
        d(leaseSlice.floatingNpriBurdenRate).greaterThan(d(leaseSlice.ownerTractRoyalty))
      );
    });

    const leasedOwnership = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.leasedFraction)),
      d(0)
    );
    const weightedRoyaltyRate = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.ownerTractRoyalty)),
      d(0)
    );
    const floatingNpriBurdenRate = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.floatingNpriBurdenRate)),
      d(0)
    );
    const fixedNpriBurdenRate = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.fixedNpriBurdenRate)),
      d(0)
    );
    const totalNpriBurdenRate = floatingNpriBurdenRate.plus(fixedNpriBurdenRate);
    const relevantOrris = leaseholdOrris.filter((orri) =>
      orriAppliesToDeskMap(orri, deskMap)
    );
    // Only `includedInMath` ORRIs drive the burden stack (see `includedOrriIds`),
    // matching the focused-decimal-row filter so the exposed map needs no recompute.
    const includedOrris = relevantOrris.filter((orri) => includedOrriIds.has(orri.id));
    const {
      nriBeforeOrriRate,
      npriAdjustedNriBeforeOrriRate,
      grossOrriBurdenRate,
      workingInterestOrriBurdenRate,
      netRevenueInterestBaseRate,
      netRevenueInterestOrriBurdenRate,
      totalOrriBurdenRate,
      orriBurdenRateById,
    } = calculateOrriBasisRates({
      leasedOwnership,
      weightedRoyaltyRate,
      fixedNpriExcessRate: tractFixedNpriExcessRate,
      orris: includedOrris,
      parseBurdenFraction: (orri) =>
        parseLeaseholdMathInterest(
          orri.burdenFraction,
          {
            sourceType: 'orri',
            sourceId: orri.id,
            sourceLabel: orriSourceLabel(orri),
            field: 'burdenFraction',
            fieldLabel: 'ORRI burden',
            value: orri.burdenFraction,
            deskMapId: deskMap.id,
          },
          addInputWarning
        ),
    });
    orriBurdenRateByTractId.set(deskMap.id, orriBurdenRateById);
    const unitRoyaltyDecimal = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.unitRoyaltyDecimal)),
      d(0)
    );
    const unitNpriDecimal = nprisForTract.reduce(
      (sum, npri) => sum.plus(d(npri.unitDecimal)),
      d(0)
    );
    const unitOrriDecimal = unitParticipation.times(totalOrriBurdenRate);
    const preWorkingInterestRate = npriAdjustedNriBeforeOrriRate.minus(totalOrriBurdenRate);
    // Warning flag: if fixed NPRIs plus the ORRI stack consumed more than the
    // available after-royalty WI, `preWorkingInterestRate` went negative and
    // was clamped to 0 below. Surface this so the UI can render a warning chip
    // instead of silently displaying a zero retained WI.
    const overBurdened = preWorkingInterestRate.isNegative();
    const overFloatingNpriBurdened = ownersForTract.some(
      (owner) => owner.overFloatingNpriBurdened
    );
    const preWorkingInterestDecimal = preWorkingInterestRate.greaterThan(0)
      ? unitParticipation.times(preWorkingInterestRate)
      : d(0);
    const relevantAssignments = leaseholdAssignments.filter((assignment) =>
      assignmentAppliesToDeskMap(assignment, deskMap)
    );
    const assignmentShare = relevantAssignments.reduce(
      (sum, assignment) =>
        sum.plus(
          parseLeaseholdMathInterest(
            assignment.workingInterestFraction,
            {
              sourceType: 'assignment',
              sourceId: assignment.id,
              sourceLabel: assignmentSourceLabel(assignment),
              field: 'workingInterestFraction',
              fieldLabel: 'WI assignment fraction',
              value: assignment.workingInterestFraction,
              deskMapId: deskMap.id,
            },
            addInputWarning
          )
        ),
      d(0)
    );
    const assignedWorkingInterestDecimal = preWorkingInterestDecimal.times(assignmentShare);
    const retainedWorkingInterestDecimal = preWorkingInterestDecimal.minus(
      assignedWorkingInterestDecimal
    );
    const uniqueLessees = [...new Set(
      ownersForTract
        .flatMap((owner) => owner.lesseeNames)
        .filter((lessee) => lessee.length > 0)
    )];
    const tractLeaseOverlaps = ownersForTract.flatMap((owner) => owner.leaseOverlaps);
    const trackedAssignmentCount = relevantAssignments.length;
    const includedAssignmentCount = relevantAssignments.length;
    const trackedNpriCount = nprisForTract.length;
    const includedNpriCount = nprisForTract.filter((npri) => npri.includedInMath).length;
    const trackedOrriCount = relevantOrris.length;
    const includedOrriCount = relevantOrris.length;

    return {
      deskMapId: deskMap.id,
      name: deskMap.name,
      code: deskMap.code,
      unitCode: deskMap.unitCode ?? null,
      unitName: deskMap.unitName ?? null,
      tractId: deskMap.tractId,
      grossAcres: tractGrossAcres.toString(),
      pooledAcres: tractPooledAcres.toString(),
      description: deskMap.description,
      currentOwnership: currentOwnership.toString(),
      leasedOwnership: leasedOwnership.toString(),
      unitParticipation: unitParticipation.toString(),
      // Stage B: these tract-level display rates are final outputs (not re-read
      // and multiplied downstream), so they quantize to 9dp.
      weightedRoyaltyRate: emitRate(weightedRoyaltyRate),
      nriBeforeOrriRate: emitRate(nriBeforeOrriRate),
      floatingNpriBurdenRate: emitRate(floatingNpriBurdenRate),
      fixedNpriBurdenRate: emitRate(fixedNpriBurdenRate),
      totalNpriBurdenRate: emitRate(totalNpriBurdenRate),
      npriAdjustedNriBeforeOrriRate: emitRate(npriAdjustedNriBeforeOrriRate),
      grossOrriBurdenRate: emitRate(grossOrriBurdenRate),
      workingInterestOrriBurdenRate: emitRate(workingInterestOrriBurdenRate),
      netRevenueInterestBaseRate: emitRate(netRevenueInterestBaseRate),
      netRevenueInterestOrriBurdenRate: emitRate(netRevenueInterestOrriBurdenRate),
      totalOrriBurdenRate: emitRate(totalOrriBurdenRate),
      // unitRoyaltyDecimal / unitNpriDecimal / unitOrriDecimal / preWorkingInterestDecimal
      // stay raw -- the unit-total folds below re-read and re-sum them.
      unitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
      unitNpriDecimal: unitNpriDecimal.toString(),
      unitOrriDecimal: unitOrriDecimal.toString(),
      preWorkingInterestDecimal: preWorkingInterestDecimal.toString(),
      assignmentShare: emitRate(assignmentShare),
      assignedWorkingInterestDecimal: assignedWorkingInterestDecimal.toString(),
      retainedWorkingInterestDecimal: retainedWorkingInterestDecimal.greaterThan(0)
        ? retainedWorkingInterestDecimal.toString()
        : '0',
      overAssigned: assignmentShare.greaterThan(1),
      overBurdened,
      overFloatingNpriBurdened,
      fixedNpriExceedsRoyalty: tractFixedNpriExceedsRoyalty,
      leaseOverlaps: tractLeaseOverlaps,
      inputWarnings: inputWarningsByTractId.get(deskMap.id) ?? [],
      currentOwnerCount: ownersForTract.length,
      includedAssignmentCount,
      trackedAssignmentCount,
      includedNpriCount,
      trackedNpriCount,
      includedOrriCount,
      trackedOrriCount,
      uniqueLessees,
      owners: ownersForTract,
    };
  });
  const tractSummaryById = new Map(tracts.map((tract) => [tract.deskMapId, tract]));
  // Each tract's preWorkingInterestDecimal was serialized to a string upstream
  // and is re-parsed here. `d(...)` at precision 40 round-trips every such string
  // LOSSLESSLY, so this re-read preserves the value exactly (it is the per-tract
  // operation order it pins, not any sub-display precision). The Stage-B 9dp
  // quantization is applied once to the SUM (the returned final), not to these
  // re-read intermediates. The same re-read pattern recurs in the WI folds below.
  const totalPreWorkingInterestDecimal = tracts.reduce(
    (sum, tract) => sum.plus(d(tract.preWorkingInterestDecimal)),
    d(0)
  );
  const assignments = leaseholdAssignments.map((assignment) => {
    const tract = assignment.deskMapId
      ? tractSummaryById.get(assignment.deskMapId) ?? null
      : null;
    const needsUnitAssignment = unitRecordNeedsAssignment(assignment, hasCodedUnitFocus);
    if (needsUnitAssignment) {
      addUnitAssignmentWarning({
        id: `assignment:${assignment.id}:unitCode`,
        sourceType: 'assignment',
        sourceId: assignment.id,
        sourceLabel: assignmentSourceLabel(assignment),
      });
    }
    const scopedTracts = unitScopedTracts(assignment, tracts, deskMapById);
    const unitPreWorkingInterestDecimal = scopedTracts.reduce(
      (sum, candidate) => sum.plus(d(candidate.preWorkingInterestDecimal)),
      d(0)
    );
    const includedInMath =
      assignment.scope === 'unit'
        ? unitPreWorkingInterestDecimal.greaterThan(0)
        : Boolean(tract);
    const workingInterestFraction = includedInMath
      ? parseLeaseholdMathInterest(
          assignment.workingInterestFraction,
          {
            sourceType: 'assignment',
            sourceId: assignment.id,
            sourceLabel: assignmentSourceLabel(assignment),
            field: 'workingInterestFraction',
            fieldLabel: 'WI assignment fraction',
            value: assignment.workingInterestFraction,
            deskMapId: assignment.deskMapId ?? null,
          },
          addInputWarning
        )
      : d(0);
    const unitDecimal = includedInMath
      ? assignment.scope === 'unit'
        ? unitPreWorkingInterestDecimal.times(workingInterestFraction)
        : d(tract?.preWorkingInterestDecimal ?? '0').times(workingInterestFraction)
      : d(0);

    return {
      id: assignment.id,
      assignor: assignment.assignor,
      assignee: assignment.assignee,
      scope: assignment.scope,
      unitCode: assignment.unitCode ?? null,
      deskMapId: assignment.deskMapId,
      tractName:
        assignment.scope === 'tract'
          ? tract?.name
            ?? deskMapById.get(assignment.deskMapId ?? '')?.name
            ?? 'Unassigned tract'
          : unitScopedName(assignment.unitCode, tracts, deskMapById),
      workingInterestFraction: assignment.workingInterestFraction,
      workingInterestFractionDecimal: workingInterestFraction.toString(),
      effectiveDate: assignment.effectiveDate,
      sourceDocNo: assignment.sourceDocNo,
      notes: assignment.notes,
      includedInMath,
      needsUnitAssignment,
      unitDecimal: unitDecimal.toString(),
    };
  });
  const npris = tracts.flatMap(
    (tract) => npriSummariesByTractId.get(tract.deskMapId) ?? []
  );
  const orris = leaseholdOrris.map((orri) => {
    const tract = orri.deskMapId ? tractSummaryById.get(orri.deskMapId) ?? null : null;
    const needsUnitAssignment = unitRecordNeedsAssignment(orri, hasCodedUnitFocus);
    if (needsUnitAssignment) {
      addUnitAssignmentWarning({
        id: `orri:${orri.id}:unitCode`,
        sourceType: 'orri',
        sourceId: orri.id,
        sourceLabel: orriSourceLabel(orri),
      });
    }
    const scopedTracts = unitScopedTracts(orri, tracts, deskMapById);
    const includedInMath =
      (
        orri.scope === 'unit'
          ? scopedTracts.some((candidate) => d(candidate.unitParticipation).greaterThan(0))
          : Boolean(tract)
      );
    const unitDecimal = includedInMath
      ? orri.scope === 'unit'
        ? scopedTracts.reduce(
            (sum, candidate) =>
              sum.plus(
                d(candidate.unitParticipation).times(
                  orriBurdenRateByTractId.get(candidate.deskMapId)?.get(orri.id) ?? d(0)
                )
              ),
            d(0)
          )
        : d(tract?.unitParticipation ?? '0').times(
            orriBurdenRateByTractId.get(tract?.deskMapId ?? '')?.get(orri.id) ?? d(0)
          )
      : d(0);

    return {
      id: orri.id,
      payee: orri.payee,
      scope: orri.scope,
      unitCode: orri.unitCode ?? null,
      deskMapId: orri.deskMapId,
      tractName:
        orri.scope === 'tract'
          ? tract?.name ?? deskMapById.get(orri.deskMapId ?? '')?.name ?? 'Unassigned tract'
          : unitScopedName(orri.unitCode, tracts, deskMapById),
      burdenFraction: orri.burdenFraction,
      burdenBasis: orri.burdenBasis,
      effectiveDate: orri.effectiveDate,
      sourceDocNo: orri.sourceDocNo,
      notes: orri.notes,
      includedInMath,
      needsUnitAssignment,
      unitDecimal: unitDecimal.toString(),
    };
  });
  const unitAssignmentWarningList = [...unitAssignmentWarnings.values()];

  return {
    tractCount: tracts.length,
    totalGrossAcres: totalGrossAcres.toString(),
    totalPooledAcres: totalPooledAcres.toString(),
    // Stage B: unit decimal totals are final outputs. They quantize to 9dp;
    // the per-tract decimals they sum stay raw, and an additive re-sum of raw
    // values rounded once at the end stays byte-class (agrees at 9dp).
    totalRoyaltyDecimal: emitRate(tracts.reduce(
      (sum, tract) => sum.plus(d(tract.unitRoyaltyDecimal)),
      d(0)
    )),
    totalNpriDecimal: emitRate(tracts.reduce(
      (sum, tract) => sum.plus(d(tract.unitNpriDecimal)),
      d(0)
    )),
    totalOrriDecimal: emitRate(tracts.reduce(
      (sum, tract) => sum.plus(d(tract.unitOrriDecimal)),
      d(0)
    )),
    preWorkingInterestDecimal: emitRate(totalPreWorkingInterestDecimal),
    totalAssignedWorkingInterestDecimal: emitRate(tracts.reduce(
      (sum, tract) => sum.plus(d(tract.assignedWorkingInterestDecimal)),
      d(0)
    )),
    // NOT quantized: this unit total is re-read as the unit-level retained-WI
    // transfer-order row decimal (`buildLeaseholdDecimalRows`), which is then
    // re-summed into the transfer-order total. Rows stay raw so the grand total
    // is `round(sum(raw))` (a true final), not `round(sum(round(...)))` -- the
    // latter accumulates rounding and shifts the total past 9dp.
    retainedWorkingInterestDecimal: tracts.reduce(
      (sum, tract) => sum.plus(d(tract.retainedWorkingInterestDecimal)),
      d(0)
    ).toString(),
    configuredGrossAcresCount: deskMaps.filter((deskMap) => d(deskMap.grossAcres).greaterThan(0))
      .length,
    configuredPooledAcresCount: deskMaps.filter((deskMap) => d(deskMap.pooledAcres).greaterThan(0))
      .length,
    fullyLeasedTractCount: tracts.filter((tract) =>
      d(tract.leasedOwnership).greaterThanOrEqualTo(d(tract.currentOwnership))
        && d(tract.currentOwnership).greaterThan(0)
    ).length,
    currentOwnerCount: tracts.reduce((sum, tract) => sum + tract.currentOwnerCount, 0),
    trackedAssignmentCount: assignments.length,
    includedAssignmentCount: assignments.filter((assignment) => assignment.includedInMath).length,
    excludedAssignmentCount: assignments.filter((assignment) => !assignment.includedInMath).length,
    overAssignedTractCount: tracts.filter((tract) => tract.overAssigned).length,
    overBurdenedTractCount: tracts.filter((tract) => tract.overBurdened).length,
    overFloatingNpriBurdenedTractCount: tracts.filter(
      (tract) => tract.overFloatingNpriBurdened
    ).length,
    fixedNpriExceedsRoyaltyTractCount: tracts.filter(
      (tract) => tract.fixedNpriExceedsRoyalty
    ).length,
    npriRatificationHoldCount: npris.filter(
      (npri) => npri.includedInMath && npri.ratificationStatus !== 'ratified'
    ).length,
    leaseOverlapTractCount: tracts.filter((tract) => tract.leaseOverlaps.length > 0).length,
    leaseOverlapWarningCount: tracts.reduce(
      (sum, tract) => sum + tract.leaseOverlaps.length,
      0
    ),
    inputWarningCount: inputWarnings.length,
    inputWarnings,
    unitAssignmentWarningCount: unitAssignmentWarningList.length,
    unitAssignmentWarnings: unitAssignmentWarningList,
    trackedOrriCount: orris.length,
    includedOrriCount: orris.filter((orri) => orri.includedInMath).length,
    excludedOrriCount: orris.filter((orri) => !orri.includedInMath).length,
    trackedNpriCount: npris.length,
    includedNpriCount: npris.filter((npri) => npri.includedInMath).length,
    excludedNpriCount: npris.filter((npri) => !npri.includedInMath).length,
    uniqueLessees: [...new Set(tracts.flatMap((tract) => tract.uniqueLessees))],
    assignments,
    npris,
    orris,
    tracts,
    orriBurdenRateByTractId,
  };
}

export function buildLeaseholdDecimalRows({
  unit,
  unitSummary,
  focusedDeskMapId,
}: {
  unit: LeaseholdUnit;
  unitSummary: LeaseholdUnitSummary;
  focusedDeskMapId: string | null;
}): LeaseholdDecimalRow[] {
  const rows: LeaseholdDecimalRow[] = [];
  const focusedTract = focusedDeskMapId
    ? unitSummary.tracts.find((tract) => tract.deskMapId === focusedDeskMapId) ?? null
    : null;
  // Reuse the burden stack the summary already computed for this tract instead
  // of recomputing it with a divergent filter/parser (DA-M7). The builder's map
  // is keyed on the same `includedInMath` ORRI set this view filters on.
  const focusedOrriBurdenRateById = focusedTract
    ? unitSummary.orriBurdenRateByTractId.get(focusedTract.deskMapId) ?? null
    : null;

  const pushRow = (row: LeaseholdDecimalRow) => {
    if (!d(row.decimal).greaterThan(0)) {
      return;
    }
    rows.push(row);
  };

  if (focusedTract) {
    focusedTract.owners.forEach((owner) => {
      owner.leaseSlices.forEach((leaseSlice) => {
        pushRow({
          id: `royalty-${focusedTract.deskMapId}-${owner.nodeId}-${leaseSlice.leaseId}`,
          category: 'royalty',
          payee: owner.ownerName,
          tractName: focusedTract.name,
          tractCode: focusedTract.code,
          sourceLabel:
            leaseSlice.leaseName || leaseSlice.lessee
              ? `${leaseSlice.leaseName || leaseSlice.lessee}${leaseSlice.leaseRoyaltyRate ? ` • Royalty ${leaseSlice.leaseRoyaltyRate}` : ''}${d(leaseSlice.floatingNpriBurdenRate).greaterThan(0) ? ' • Net after floating NPRI' : ''}`
              : 'Lease royalty',
          effectiveDate: leaseSlice.leaseEffectiveDate,
          sourceDocNo: leaseSlice.leaseDocNo,
          decimal: leaseSlice.netOwnerUnitRoyaltyDecimal,
        });
      });
    });

    unitSummary.npris
      .filter((npri) => npri.deskMapId === focusedTract.deskMapId)
      .forEach((npri) => {
        pushRow({
          id: `npri-${focusedTract.deskMapId}-${npri.id}`,
          category: 'npri',
          payee: npri.payee || 'Unnamed NPRI',
          tractName: focusedTract.name,
          tractCode: focusedTract.code,
          sourceLabel: formatNpriSourceLabel(
            npri.royaltyKind,
            npri.burdenFraction,
            npri.fixedRoyaltyBasis
          ),
          effectiveDate: npri.effectiveDate,
          sourceDocNo: npri.sourceDocNo,
          decimal: npri.unitDecimal,
        });
      });

    unitSummary.orris
      .filter((orri) => summaryRecordAppliesToFocusedTract(orri, focusedTract))
      .forEach((orri) => {
        const decimal = d(focusedTract.unitParticipation)
          .times(focusedOrriBurdenRateById?.get(orri.id) ?? d(0))
          .toString();
        pushRow({
          id: `orri-${focusedTract.deskMapId}-${orri.id}`,
          category: 'orri',
          payee: orri.payee || 'Unnamed ORRI',
          tractName: focusedTract.name,
          tractCode: focusedTract.code,
          sourceLabel:
            orri.scope === 'unit'
              ? `Unit ORRI • ${formatOrriBasisSourceLabel(orri.burdenBasis)}`
              : `${focusedTract.code} ORRI • ${formatOrriBasisSourceLabel(orri.burdenBasis)}`,
          effectiveDate: orri.effectiveDate,
          sourceDocNo: orri.sourceDocNo,
          decimal,
        });
      });

    const focusedRetainedRow: LeaseholdDecimalRow = {
      id: `retained-wi-${focusedTract.deskMapId}`,
      category: 'retained_wi',
      payee:
        focusedTract.uniqueLessees[0] || unit.operator || 'Retained operator / lessee',
      tractName: focusedTract.name,
      tractCode: focusedTract.code,
      sourceLabel: `${focusedTract.code} retained WI`,
      effectiveDate: unit.effectiveDate,
      sourceDocNo: '',
      decimal: focusedTract.retainedWorkingInterestDecimal,
    };
    if (d(focusedRetainedRow.decimal).greaterThan(0) || focusedTract.overAssigned) {
      rows.push(focusedRetainedRow);
    }

    unitSummary.assignments
      .filter((assignment) => summaryRecordAppliesToFocusedTract(assignment, focusedTract))
      .forEach((assignment) => {
        const decimal =
          assignment.scope === 'unit'
            ? d(focusedTract.preWorkingInterestDecimal)
                // Reuse the once-parsed WI fraction (warning sink already fired in
                // the summary builder) instead of re-parsing the raw string (DA-M7).
                .times(d(assignment.workingInterestFractionDecimal))
                .toString()
            : assignment.unitDecimal;
        pushRow({
          id: `assignment-${focusedTract.deskMapId}-${assignment.id}`,
          category: 'assigned_wi',
          payee: assignment.assignee || 'Unnamed assignee',
          tractName: focusedTract.name,
          tractCode: focusedTract.code,
          sourceLabel: assignment.assignor
            ? `${assignment.assignor} assignment`
            : 'WI assignment',
          effectiveDate: assignment.effectiveDate,
          sourceDocNo: assignment.sourceDocNo,
          decimal,
        });
      });

    // Unleased mineral interest: the owner's mineral fraction not covered by any
    // active lease. Cost-bearing, so the focused sheet accounts for 100% of the
    // tract rather than only the leased portion.
    focusedTract.owners.forEach((owner) => {
      const unleasedFraction = d(owner.fraction).minus(d(owner.leasedFraction));
      pushRow({
        id: `unleased-${focusedTract.deskMapId}-${owner.nodeId}`,
        category: 'unleased',
        payee: owner.ownerName,
        tractName: focusedTract.name,
        tractCode: focusedTract.code,
        sourceLabel: `${focusedTract.code} unleased mineral`,
        effectiveDate: '',
        sourceDocNo: '',
        decimal: d(focusedTract.unitParticipation).times(unleasedFraction).toString(),
      });
    });
  } else {
    unitSummary.tracts.forEach((tract) => {
      tract.owners.forEach((owner) => {
        owner.leaseSlices.forEach((leaseSlice) => {
          pushRow({
            id: `royalty-${tract.deskMapId}-${owner.nodeId}-${leaseSlice.leaseId}`,
            category: 'royalty',
            payee: owner.ownerName,
            tractName: tract.name,
            tractCode: tract.code,
            sourceLabel:
              leaseSlice.leaseName || leaseSlice.lessee
                ? `${tract.code} • ${leaseSlice.leaseName || leaseSlice.lessee}${leaseSlice.leaseRoyaltyRate ? ` • Royalty ${leaseSlice.leaseRoyaltyRate}` : ''}${d(leaseSlice.floatingNpriBurdenRate).greaterThan(0) ? ' • Net after floating NPRI' : ''}`
                : `${tract.code} lease royalty`,
            effectiveDate: leaseSlice.leaseEffectiveDate,
            sourceDocNo: leaseSlice.leaseDocNo,
            decimal: leaseSlice.netOwnerUnitRoyaltyDecimal,
          });
        });
      });
    });

    unitSummary.npris
      .filter((npri) => npri.includedInMath)
      .forEach((npri) => {
        pushRow({
          id: `npri-${npri.id}`,
          category: 'npri',
          payee: npri.payee || 'Unnamed NPRI',
          tractName: npri.tractName,
          tractCode: npri.tractCode,
          sourceLabel: formatNpriSourceLabel(
            npri.royaltyKind,
            npri.burdenFraction,
            npri.fixedRoyaltyBasis
          ),
          effectiveDate: npri.effectiveDate,
          sourceDocNo: npri.sourceDocNo,
          decimal: npri.unitDecimal,
        });
      });

    unitSummary.orris
      .filter((orri) => orri.includedInMath)
      .forEach((orri) => {
        pushRow({
          id: `orri-${orri.id}`,
          category: 'orri',
          payee: orri.payee || 'Unnamed ORRI',
          tractName: orri.tractName,
          tractCode: orri.scope === 'unit' ? 'UNIT' : 'TRACT',
          sourceLabel:
            orri.scope === 'unit'
              ? `Unit ORRI • ${formatOrriBasisSourceLabel(orri.burdenBasis)}`
              : `${orri.tractName} ORRI • ${formatOrriBasisSourceLabel(orri.burdenBasis)}`,
          effectiveDate: orri.effectiveDate,
          sourceDocNo: orri.sourceDocNo,
          decimal: orri.unitDecimal,
        });
      });

    const unitRetainedRow: LeaseholdDecimalRow = {
      id: 'retained-wi-unit',
      category: 'retained_wi',
      payee: unit.operator || unitSummary.uniqueLessees[0] || 'Retained operator / lessee',
      tractName: unit.name || 'Unit-wide',
      tractCode: 'UNIT',
      sourceLabel: 'Retained WI',
      effectiveDate: unit.effectiveDate,
      sourceDocNo: '',
      decimal: unitSummary.retainedWorkingInterestDecimal,
    };
    if (
      d(unitRetainedRow.decimal).greaterThan(0)
      || unitSummary.overAssignedTractCount > 0
    ) {
      rows.push(unitRetainedRow);
    }

    unitSummary.assignments
      .filter((assignment) => assignment.includedInMath)
      .forEach((assignment) => {
        pushRow({
          id: `assignment-${assignment.id}`,
          category: 'assigned_wi',
          payee: assignment.assignee || 'Unnamed assignee',
          tractName: assignment.tractName,
          tractCode: assignment.scope === 'unit' ? 'UNIT' : 'TRACT',
          sourceLabel: assignment.assignor
            ? `${assignment.assignor} assignment`
            : 'WI assignment',
          effectiveDate: assignment.effectiveDate,
          sourceDocNo: assignment.sourceDocNo,
          decimal: assignment.unitDecimal,
        });
      });

    // Unleased mineral interest across every tract (see the focused path).
    unitSummary.tracts.forEach((tract) => {
      tract.owners.forEach((owner) => {
        const unleasedFraction = d(owner.fraction).minus(d(owner.leasedFraction));
        pushRow({
          id: `unleased-${tract.deskMapId}-${owner.nodeId}`,
          category: 'unleased',
          payee: owner.ownerName,
          tractName: tract.name,
          tractCode: tract.code,
          sourceLabel: `${tract.code} unleased mineral`,
          effectiveDate: '',
          sourceDocNo: '',
          decimal: d(tract.unitParticipation).times(unleasedFraction).toString(),
        });
      });
    });
  }

  return rows.sort((left, right) => {
    const categoryDiff =
      LEASEHOLD_DECIMAL_CATEGORY_ORDER[left.category]
      - LEASEHOLD_DECIMAL_CATEGORY_ORDER[right.category];
    if (categoryDiff !== 0) {
      return categoryDiff;
    }
    const decimalDiff = d(right.decimal).comparedTo(d(left.decimal));
    if (decimalDiff !== 0) {
      return decimalDiff;
    }
    return left.payee.localeCompare(right.payee);
  });
}

export function buildLeaseholdTransferOrderHoldReasons(
  unitSummary: Pick<
    LeaseholdUnitSummary,
    | 'unitAssignmentWarningCount'
    | 'npriRatificationHoldCount'
    | 'fixedNpriExceedsRoyaltyTractCount'
  >
): string[] {
  const reasons: string[] = [];
  // DA-H1 decision of record: where a fixed NPRI exceeds the burdened lessor's
  // royalty, the excess is charged to the WI on treatise consensus (not on-point
  // SCOTX authority), so the sheet must recommend counsel sign-off before payout
  // reliance. The flag is computed per tract; surface it here so it is visible.
  if (unitSummary.fixedNpriExceedsRoyaltyTractCount > 0) {
    reasons.push(
      `${unitSummary.fixedNpriExceedsRoyaltyTractCount} tract${
        unitSummary.fixedNpriExceedsRoyaltyTractCount === 1 ? '' : 's'
      } where a fixed NPRI exceeds the lessor royalty (excess charged to WI) — `
      + `recommend counsel sign-off before payout reliance.`
    );
  }
  // Deliberate readiness gate: a null-unit ORRI/WI record is not transfer-order
  // reliable until it is assigned to the coded unit it affects.
  if (unitSummary.unitAssignmentWarningCount > 0) {
    reasons.push(
      `${unitSummary.unitAssignmentWarningCount} unit-scoped ORRI/WI record${
        unitSummary.unitAssignmentWarningCount === 1 ? '' : 's'
      } excluded - needs unit assignment.`
    );
  }
  // DA-M5: NPRIs whose pooling ratification is unconfirmed are computed
  // unit-weighted but are not payout-reliable until ratification is confirmed
  // (the unratified tract-basis payout is deferred pending counsel review).
  if (unitSummary.npriRatificationHoldCount > 0) {
    reasons.push(
      `${unitSummary.npriRatificationHoldCount} NPRI${
        unitSummary.npriRatificationHoldCount === 1 ? '' : 's'
      } need ratification confirmation before transfer-order payout.`
    );
  }
  return reasons;
}

function leaseholdCoverageDecimal(tract: Pick<LeaseholdTractSummary, 'unitParticipation' | 'currentOwnership'>) {
  // Balance against the FULL current mineral ownership, not just the leased
  // portion: unleased mineral owners now appear as cost-bearing rows, so the
  // expected unit decimal must cover 100% of the tract for the variance to close.
  return d(tract.unitParticipation).times(d(tract.currentOwnership));
}

export function buildLeaseholdTransferOrderReview({
  unit,
  unitSummary,
  focusedDeskMapId,
}: {
  unit: LeaseholdUnit;
  unitSummary: LeaseholdUnitSummary;
  focusedDeskMapId: string | null;
}): LeaseholdTransferOrderReview {
  const rows = buildLeaseholdDecimalRows({
    unit,
    unitSummary,
    focusedDeskMapId,
  });
  const totalDecimal = rows.reduce((sum, row) => sum.plus(d(row.decimal)), d(0));
  const focusedTract = focusedDeskMapId
    ? unitSummary.tracts.find((tract) => tract.deskMapId === focusedDeskMapId) ?? null
    : null;
  const expectedDecimal = focusedTract
    ? leaseholdCoverageDecimal(focusedTract)
    : unitSummary.tracts.reduce(
        (sum, tract) => sum.plus(leaseholdCoverageDecimal(tract)),
        d(0)
      );
  const categoryRollups = new Map<
    LeaseholdDecimalRowKind,
    { rowCount: number; totalDecimal: ReturnType<typeof d> }
  >();

  rows.forEach((row) => {
    const existing = categoryRollups.get(row.category) ?? {
      rowCount: 0,
      totalDecimal: d(0),
    };
    categoryRollups.set(row.category, {
      rowCount: existing.rowCount + 1,
      totalDecimal: existing.totalDecimal.plus(d(row.decimal)),
    });
  });

  const categorySummaries = (
    Object.keys(LEASEHOLD_DECIMAL_CATEGORY_ORDER) as LeaseholdDecimalRowKind[]
  )
    .map((category) => {
      const rollup = categoryRollups.get(category);
      return {
        category,
        rowCount: rollup?.rowCount ?? 0,
        // Stage B: category total is a final output -> 9dp.
        totalDecimal: rollup ? emitRate(rollup.totalDecimal) : '0',
      };
    })
    .filter((summary) => summary.rowCount > 0);
  // retained_wi and unleased are derived (no source instrument), so they are
  // excluded from the source-completeness review counts.
  const reviewableRows = rows.filter(
    (row) => row.category !== 'retained_wi' && row.category !== 'unleased'
  );

  return {
    rows,
    // Stage B: transfer-order terminals are final outputs -> 9dp. Quantizing the
    // variance collapses sub-9dp arithmetic residue to a clean 0 when the sheet
    // balances.
    totalDecimal: emitRate(totalDecimal),
    expectedDecimal: emitRate(expectedDecimal),
    varianceDecimal: emitRate(totalDecimal.minus(expectedDecimal).abs()),
    categorySummaries,
    reviewableRowCount: reviewableRows.length,
    rowsWithCompleteSource: reviewableRows.filter(
      (row) => row.effectiveDate.trim().length > 0 && row.sourceDocNo.trim().length > 0
    ).length,
    rowsWithSourceGap: reviewableRows.filter(
      (row) =>
        row.effectiveDate.trim().length === 0 || row.sourceDocNo.trim().length === 0
    ).length,
    rowsMissingEffectiveDate: reviewableRows.filter(
      (row) => row.effectiveDate.trim().length === 0
    ).length,
    rowsMissingSourceDocNo: reviewableRows.filter(
      (row) => row.sourceDocNo.trim().length === 0
    ).length,
  };
}
