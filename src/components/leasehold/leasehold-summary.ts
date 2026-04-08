import { d } from '../../engine/decimal';
import { isNpriNode, type DeskMap, type OwnershipNode } from '../../types/node';
import type { Lease, Owner } from '../../types/owner';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdUnit,
} from '../../types/leasehold';
import {
  allocateLeaseCoverage,
  getActiveLeases,
  type LeaseCoverageOverlap,
} from '../deskmap/deskmap-coverage';
import { parseInterestString } from '../../utils/interest-string';

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
  leaseSlices: LeaseholdOwnerLeaseSummary[];
  /** Overlap warnings from `allocateLeaseCoverage` for this owner's leases. */
  leaseOverlaps: LeaseCoverageOverlap[];
}

export interface LeaseholdTractSummary {
  deskMapId: string;
  name: string;
  code: string;
  tractId: string | null;
  grossAcres: string;
  pooledAcres: string;
  description: string;
  currentOwnership: string;
  leasedOwnership: string;
  unitParticipation: string;
  weightedRoyaltyRate: string;
  workingInterestBaseRate: string;
  grossOrriBurdenRate: string;
  workingInterestOrriBurdenRate: string;
  netRevenueInterestBaseRate: string;
  netRevenueInterestOrriBurdenRate: string;
  totalOrriBurdenRate: string;
  unitRoyaltyDecimal: string;
  unitOrriDecimal: string;
  preWorkingInterestDecimal: string;
  assignmentShare: string;
  assignedWorkingInterestDecimal: string;
  retainedWorkingInterestDecimal: string;
  overAssigned: boolean;
  /**
   * Warning flag: ORRI burdens on this tract exceed the available after-royalty
   * working interest (`totalOrriBurdenRate > workingInterestBaseRate`). Pre-WI
   * is already clamped to 0 in that case, but the user should see that the
   * clamp happened rather than silently interpreting a zero retained WI. This
   * is warning-only and does not block — it matches the existing `overAssigned`
   * convention.
   */
  overBurdened: boolean;
  /**
   * Aggregated lease-overlap warnings surfaced from this tract's owners. Each
   * entry is a lease that was silently clipped by `allocateLeaseCoverage`
   * because an earlier lease already claimed the owner's share.
   */
  leaseOverlaps: LeaseCoverageOverlap[];
  currentOwnerCount: number;
  includedAssignmentCount: number;
  trackedAssignmentCount: number;
  includedOrriCount: number;
  trackedOrriCount: number;
  uniqueLessees: string[];
  owners: LeaseholdOwnerSummary[];
}

export interface LeaseholdOrriSummary {
  id: string;
  payee: string;
  scope: LeaseholdOrri['scope'];
  deskMapId: string | null;
  tractName: string;
  burdenFraction: string;
  burdenBasis: LeaseholdOrri['burdenBasis'];
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
  includedInMath: boolean;
  unitDecimal: string;
}

export interface LeaseholdAssignmentSummary {
  id: string;
  assignor: string;
  assignee: string;
  scope: LeaseholdAssignment['scope'];
  deskMapId: string | null;
  tractName: string;
  workingInterestFraction: string;
  effectiveDate: string;
  sourceDocNo: string;
  notes: string;
  includedInMath: boolean;
  unitDecimal: string;
}

export interface LeaseholdUnitSummary {
  tractCount: number;
  totalGrossAcres: string;
  totalPooledAcres: string;
  totalRoyaltyDecimal: string;
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
  /**
   * Number of tracts that have at least one lease-overlap warning. Warning-only;
   * affected tracts still roll up their clipped allocations and the leasehold
   * math still reaches a valid total, but the user should review the overlap.
   */
  leaseOverlapTractCount: number;
  /** Total count of individual overlap warnings across all tracts. */
  leaseOverlapWarningCount: number;
  trackedOrriCount: number;
  includedOrriCount: number;
  excludedOrriCount: number;
  uniqueLessees: string[];
  assignments: LeaseholdAssignmentSummary[];
  orris: LeaseholdOrriSummary[];
  tracts: LeaseholdTractSummary[];
}

export type LeaseholdDecimalRowKind =
  | 'royalty'
  | 'orri'
  | 'retained_wi'
  | 'assigned_wi';

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
  orri: 1,
  retained_wi: 2,
  assigned_wi: 3,
};

function nameOwner(node: OwnershipNode, ownerById: Map<string, Owner>): string {
  if (!node.linkedOwnerId) {
    return node.grantee || 'Unlinked Owner';
  }

  return ownerById.get(node.linkedOwnerId)?.name || node.grantee || 'Linked Owner';
}

/**
 * NPRI exclusion gate for the leasehold decimal pipeline (audit finding #5).
 *
 * Every downstream calculation in this file — owner slices, weighted royalty,
 * lease coverage allocation, ORRI burden base, transfer-order rows — flows
 * through `currentMineralOwners`. NPRI nodes are intentionally filtered out
 * here so that `royaltyKind` ("fixed" vs "floating") never reaches the decimal
 * math. The field is deed-text preservation only; see `src/types/node.ts` →
 * `RoyaltyKind` and `docs/architecture/ownership-math-reference.md` →
 * "Fixed vs. floating royalty". Do not relax this filter without wiring both
 * branches end-to-end at the same time.
 */
function currentMineralOwners(nodes: OwnershipNode[]) {
  return nodes.filter(
    (node) => node.type !== 'related' && !isNpriNode(node) && d(node.fraction).greaterThan(0)
  );
}

function buildOwnerLeaseSummaries({
  leases,
  ownerFraction,
  tractPooledAcres,
  totalPooledAcres,
}: {
  leases: Lease[];
  ownerFraction: ReturnType<typeof d>;
  tractPooledAcres: ReturnType<typeof d>;
  totalPooledAcres: ReturnType<typeof d>;
}): { slices: LeaseholdOwnerLeaseSummary[]; overlaps: LeaseCoverageOverlap[] } {
  const { allocations, overlaps } = allocateLeaseCoverage(
    leases,
    ownerFraction.toString()
  );
  const slices = allocations.map(({ lease, allocatedFraction }) => {
    const leaseFraction = d(allocatedFraction);
    const leasedPooledAcres = tractPooledAcres.times(leaseFraction);
    const leaseRoyaltyRate = parseInterestString(lease.royaltyRate);
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
    };
  });

  return { slices, overlaps };
}

function sumDecimalStrings(values: string[]) {
  return values.reduce((sum, value) => sum.plus(d(value)), d(0));
}

function calculateOrriBasisRates({
  leasedOwnership,
  weightedRoyaltyRate,
  orris,
}: {
  leasedOwnership: ReturnType<typeof d>;
  weightedRoyaltyRate: ReturnType<typeof d>;
  orris: LeaseholdOrri[];
}) {
  const grossBasisShare = orris
    .filter((orri) => orri.burdenBasis === 'gross_8_8')
    .reduce((sum, orri) => sum.plus(parseInterestString(orri.burdenFraction)), d(0));
  const workingInterestBasisShare = orris
    .filter((orri) => orri.burdenBasis === 'working_interest')
    .reduce((sum, orri) => sum.plus(parseInterestString(orri.burdenFraction)), d(0));
  const netRevenueInterestBasisShare = orris
    .filter((orri) => orri.burdenBasis === 'net_revenue_interest')
    .reduce((sum, orri) => sum.plus(parseInterestString(orri.burdenFraction)), d(0));

  const workingInterestBaseRate = leasedOwnership.minus(weightedRoyaltyRate);
  const safeWorkingInterestBaseRate = workingInterestBaseRate.greaterThan(0)
    ? workingInterestBaseRate
    : d(0);
  const grossOrriBurdenRate = leasedOwnership.times(grossBasisShare);
  // Working-interest ORRIs are carved from the full leased working interest (8/8 of the
  // leasehold estate), not from the lessee's after-royalty share. A "1/80 of WI" ORRI
  // therefore produces leasedOwnership × 1/80 regardless of the lease royalty rate.
  const workingInterestOrriBurdenRate = leasedOwnership.times(workingInterestBasisShare);
  const netRevenueInterestBaseRate = safeWorkingInterestBaseRate
    .minus(grossOrriBurdenRate)
    .minus(workingInterestOrriBurdenRate);
  const safeNetRevenueInterestBaseRate = netRevenueInterestBaseRate.greaterThan(0)
    ? netRevenueInterestBaseRate
    : d(0);
  const netRevenueInterestOrriBurdenRate = safeNetRevenueInterestBaseRate.times(
    netRevenueInterestBasisShare
  );
  const totalOrriBurdenRate = grossOrriBurdenRate
    .plus(workingInterestOrriBurdenRate)
    .plus(netRevenueInterestOrriBurdenRate);

  return {
    workingInterestBaseRate: safeWorkingInterestBaseRate,
    grossOrriBurdenRate,
    workingInterestOrriBurdenRate,
    netRevenueInterestBaseRate: safeNetRevenueInterestBaseRate,
    netRevenueInterestOrriBurdenRate,
    totalOrriBurdenRate,
  };
}

function calculateSingleOrriBurdenRate({
  burdenBasis,
  burdenFraction,
  leasedOwnership,
  netRevenueInterestBaseRate,
}: {
  burdenBasis: LeaseholdOrri['burdenBasis'];
  burdenFraction: string;
  leasedOwnership: ReturnType<typeof d>;
  netRevenueInterestBaseRate: ReturnType<typeof d>;
}) {
  const parsedBurden = parseInterestString(burdenFraction);

  switch (burdenBasis) {
    case 'working_interest':
      // See calculateOrriBasisRates: WI-basis ORRIs multiply the full leased WI, not the
      // after-royalty share.
      return leasedOwnership.times(parsedBurden);
    case 'net_revenue_interest':
      return netRevenueInterestBaseRate.times(parsedBurden);
    case 'gross_8_8':
    default:
      return leasedOwnership.times(parsedBurden);
  }
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

  const tracts = deskMaps.map((deskMap) => {
    const nodeIds = new Set(deskMap.nodeIds);
    const tractNodes = nodes.filter((node) => nodeIds.has(node.id));
    const presentOwners = currentMineralOwners(tractNodes);
    const tractGrossAcres = d(deskMap.grossAcres);
    const tractPooledAcres = d(deskMap.pooledAcres);
    const currentOwnership = presentOwners.reduce(
      (sum, node) => sum.plus(d(node.fraction)),
      d(0)
    );

    const ownersForTract = presentOwners
      .map((node) => {
        const ownerFraction = d(node.fraction);
        const ownerLeases = node.linkedOwnerId
          ? activeLeasesByOwnerId.get(node.linkedOwnerId) ?? []
          : [];
        const { slices: leaseSlices, overlaps: leaseOverlaps } = buildOwnerLeaseSummaries({
          leases: ownerLeases,
          ownerFraction,
          tractPooledAcres,
          totalPooledAcres,
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

    const leasedOwnership = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.leasedFraction)),
      d(0)
    );
    const weightedRoyaltyRate = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.ownerTractRoyalty)),
      d(0)
    );
    const unitParticipation = totalPooledAcres.greaterThan(0)
      ? tractPooledAcres.div(totalPooledAcres)
      : d(0);
    const relevantOrris = leaseholdOrris.filter(
      (orri) => orri.scope === 'unit' || orri.deskMapId === deskMap.id
    );
    const {
      workingInterestBaseRate,
      grossOrriBurdenRate,
      workingInterestOrriBurdenRate,
      netRevenueInterestBaseRate,
      netRevenueInterestOrriBurdenRate,
      totalOrriBurdenRate,
    } = calculateOrriBasisRates({
      leasedOwnership,
      weightedRoyaltyRate,
      orris: relevantOrris,
    });
    const unitRoyaltyDecimal = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.unitRoyaltyDecimal)),
      d(0)
    );
    const unitOrriDecimal = unitParticipation.times(totalOrriBurdenRate);
    const preWorkingInterestRate = workingInterestBaseRate.minus(totalOrriBurdenRate);
    // Warning flag: if the ORRI stack consumed more than the available
    // after-royalty WI, `preWorkingInterestRate` went negative and was clamped
    // to 0 below. Surface this as `overBurdened` so the UI can render a
    // warning chip instead of silently displaying a zero retained WI.
    const overBurdened = preWorkingInterestRate.isNegative();
    const preWorkingInterestDecimal = preWorkingInterestRate.greaterThan(0)
      ? unitParticipation.times(preWorkingInterestRate)
      : d(0);
    const relevantAssignments = leaseholdAssignments.filter(
      (assignment) => assignment.scope === 'unit' || assignment.deskMapId === deskMap.id
    );
    const assignmentShare = relevantAssignments.reduce(
      (sum, assignment) =>
        sum.plus(parseInterestString(assignment.workingInterestFraction)),
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
    const trackedOrriCount = relevantOrris.length;
    const includedOrriCount = relevantOrris.length;

    return {
      deskMapId: deskMap.id,
      name: deskMap.name,
      code: deskMap.code,
      tractId: deskMap.tractId,
      grossAcres: tractGrossAcres.toString(),
      pooledAcres: tractPooledAcres.toString(),
      description: deskMap.description,
      currentOwnership: currentOwnership.toString(),
      leasedOwnership: leasedOwnership.toString(),
      unitParticipation: unitParticipation.toString(),
      weightedRoyaltyRate: weightedRoyaltyRate.toString(),
      workingInterestBaseRate: workingInterestBaseRate.toString(),
      grossOrriBurdenRate: grossOrriBurdenRate.toString(),
      workingInterestOrriBurdenRate: workingInterestOrriBurdenRate.toString(),
      netRevenueInterestBaseRate: netRevenueInterestBaseRate.toString(),
      netRevenueInterestOrriBurdenRate: netRevenueInterestOrriBurdenRate.toString(),
      totalOrriBurdenRate: totalOrriBurdenRate.toString(),
      unitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
      unitOrriDecimal: unitOrriDecimal.toString(),
      preWorkingInterestDecimal: preWorkingInterestDecimal.toString(),
      assignmentShare: assignmentShare.toString(),
      assignedWorkingInterestDecimal: assignedWorkingInterestDecimal.toString(),
      retainedWorkingInterestDecimal: retainedWorkingInterestDecimal.greaterThan(0)
        ? retainedWorkingInterestDecimal.toString()
        : '0',
      overAssigned: assignmentShare.greaterThan(1),
      overBurdened,
      leaseOverlaps: tractLeaseOverlaps,
      currentOwnerCount: ownersForTract.length,
      includedAssignmentCount,
      trackedAssignmentCount,
      includedOrriCount,
      trackedOrriCount,
      uniqueLessees,
      owners: ownersForTract,
    };
  });
  const tractSummaryById = new Map(tracts.map((tract) => [tract.deskMapId, tract]));
  const totalPreWorkingInterestDecimal = tracts.reduce(
    (sum, tract) => sum.plus(d(tract.preWorkingInterestDecimal)),
    d(0)
  );
  const assignments = leaseholdAssignments.map((assignment) => {
    const tract = assignment.deskMapId
      ? tractSummaryById.get(assignment.deskMapId) ?? null
      : null;
    const includedInMath =
      assignment.scope === 'unit'
        ? totalPreWorkingInterestDecimal.greaterThan(0)
        : Boolean(tract);
    const workingInterestFraction = includedInMath
      ? parseInterestString(assignment.workingInterestFraction)
      : d(0);
    const unitDecimal = includedInMath
      ? assignment.scope === 'unit'
        ? totalPreWorkingInterestDecimal.times(workingInterestFraction)
        : d(tract?.preWorkingInterestDecimal ?? '0').times(workingInterestFraction)
      : d(0);

    return {
      id: assignment.id,
      assignor: assignment.assignor,
      assignee: assignment.assignee,
      scope: assignment.scope,
      deskMapId: assignment.deskMapId,
      tractName:
        assignment.scope === 'tract'
          ? tract?.name
            ?? deskMapById.get(assignment.deskMapId ?? '')?.name
            ?? 'Unassigned tract'
          : 'Unit-wide',
      workingInterestFraction: assignment.workingInterestFraction,
      effectiveDate: assignment.effectiveDate,
      sourceDocNo: assignment.sourceDocNo,
      notes: assignment.notes,
      includedInMath,
      unitDecimal: unitDecimal.toString(),
    };
  });
  const orris = leaseholdOrris.map((orri) => {
    const tract = orri.deskMapId ? tractSummaryById.get(orri.deskMapId) ?? null : null;
    const includedInMath =
      (
        orri.scope === 'unit'
          ? tracts.some((candidate) => d(candidate.unitParticipation).greaterThan(0))
          : Boolean(tract)
      );
    const unitDecimal = includedInMath
      ? orri.scope === 'unit'
        ? tracts.reduce(
            (sum, candidate) =>
              sum.plus(
                d(candidate.unitParticipation).times(
                  calculateSingleOrriBurdenRate({
                    burdenBasis: orri.burdenBasis,
                    burdenFraction: orri.burdenFraction,
                    leasedOwnership: d(candidate.leasedOwnership),
                    netRevenueInterestBaseRate: d(candidate.netRevenueInterestBaseRate),
                  })
                )
              ),
            d(0)
          )
        : d(tract?.unitParticipation ?? '0').times(
            calculateSingleOrriBurdenRate({
              burdenBasis: orri.burdenBasis,
              burdenFraction: orri.burdenFraction,
              leasedOwnership: d(tract?.leasedOwnership ?? '0'),
              netRevenueInterestBaseRate: d(tract?.netRevenueInterestBaseRate ?? '0'),
            })
          )
      : d(0);

    return {
      id: orri.id,
      payee: orri.payee,
      scope: orri.scope,
      deskMapId: orri.deskMapId,
      tractName:
        orri.scope === 'tract'
          ? tract?.name ?? deskMapById.get(orri.deskMapId ?? '')?.name ?? 'Unassigned tract'
          : 'Unit-wide',
      burdenFraction: orri.burdenFraction,
      burdenBasis: orri.burdenBasis,
      effectiveDate: orri.effectiveDate,
      sourceDocNo: orri.sourceDocNo,
      notes: orri.notes,
      includedInMath,
      unitDecimal: unitDecimal.toString(),
    };
  });

  return {
    tractCount: tracts.length,
    totalGrossAcres: totalGrossAcres.toString(),
    totalPooledAcres: totalPooledAcres.toString(),
    totalRoyaltyDecimal: tracts.reduce(
      (sum, tract) => sum.plus(d(tract.unitRoyaltyDecimal)),
      d(0)
    ).toString(),
    totalOrriDecimal: tracts.reduce(
      (sum, tract) => sum.plus(d(tract.unitOrriDecimal)),
      d(0)
    ).toString(),
    preWorkingInterestDecimal: totalPreWorkingInterestDecimal.toString(),
    totalAssignedWorkingInterestDecimal: tracts.reduce(
      (sum, tract) => sum.plus(d(tract.assignedWorkingInterestDecimal)),
      d(0)
    ).toString(),
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
    leaseOverlapTractCount: tracts.filter((tract) => tract.leaseOverlaps.length > 0).length,
    leaseOverlapWarningCount: tracts.reduce(
      (sum, tract) => sum + tract.leaseOverlaps.length,
      0
    ),
    trackedOrriCount: orris.length,
    includedOrriCount: orris.filter((orri) => orri.includedInMath).length,
    excludedOrriCount: orris.filter((orri) => !orri.includedInMath).length,
    uniqueLessees: [...new Set(tracts.flatMap((tract) => tract.uniqueLessees))],
    assignments,
    orris,
    tracts,
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
              ? `${leaseSlice.leaseName || leaseSlice.lessee}${leaseSlice.leaseRoyaltyRate ? ` • Royalty ${leaseSlice.leaseRoyaltyRate}` : ''}`
              : 'Lease royalty',
          effectiveDate: leaseSlice.leaseEffectiveDate,
          sourceDocNo: leaseSlice.leaseDocNo,
          decimal: leaseSlice.unitRoyaltyDecimal,
        });
      });
    });

    unitSummary.orris
      .filter((orri) => orri.scope === 'unit' || orri.deskMapId === focusedTract.deskMapId)
      .forEach((orri) => {
        const decimal =
          orri.scope === 'unit'
            ? d(focusedTract.unitParticipation).times(
                calculateSingleOrriBurdenRate({
                  burdenBasis: orri.burdenBasis,
                  burdenFraction: orri.burdenFraction,
                  leasedOwnership: d(focusedTract.leasedOwnership),
                  netRevenueInterestBaseRate: d(focusedTract.netRevenueInterestBaseRate),
                })
              ).toString()
            : orri.unitDecimal;
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
      .filter(
        (assignment) =>
          assignment.scope === 'unit' || assignment.deskMapId === focusedTract.deskMapId
      )
      .forEach((assignment) => {
        const decimal =
          assignment.scope === 'unit'
            ? d(focusedTract.preWorkingInterestDecimal)
                .times(parseInterestString(assignment.workingInterestFraction))
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
                ? `${tract.code} • ${leaseSlice.leaseName || leaseSlice.lessee}${leaseSlice.leaseRoyaltyRate ? ` • Royalty ${leaseSlice.leaseRoyaltyRate}` : ''}`
                : `${tract.code} lease royalty`,
            effectiveDate: leaseSlice.leaseEffectiveDate,
            sourceDocNo: leaseSlice.leaseDocNo,
            decimal: leaseSlice.unitRoyaltyDecimal,
          });
        });
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

function leaseholdCoverageDecimal(tract: Pick<LeaseholdTractSummary, 'unitParticipation' | 'leasedOwnership'>) {
  return d(tract.unitParticipation).times(d(tract.leasedOwnership));
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
        totalDecimal: rollup?.totalDecimal.toString() ?? '0',
      };
    })
    .filter((summary) => summary.rowCount > 0);
  const reviewableRows = rows.filter((row) => row.category !== 'retained_wi');

  return {
    rows,
    totalDecimal: totalDecimal.toString(),
    expectedDecimal: expectedDecimal.toString(),
    varianceDecimal: totalDecimal.minus(expectedDecimal).abs().toString(),
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
