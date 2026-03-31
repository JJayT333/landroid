import { d } from '../../engine/decimal';
import { isNpriNode, type DeskMap, type OwnershipNode } from '../../types/node';
import type { Lease, Owner } from '../../types/owner';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdUnit,
} from '../../types/leasehold';
import { pickPrimaryLease } from '../deskmap/deskmap-coverage';
import { parseInterestString } from '../../utils/interest-string';

export interface LeaseholdOwnerSummary {
  nodeId: string;
  ownerId: string | null;
  ownerName: string;
  fraction: string;
  netMineralAcres: string;
  leasedFraction: string;
  leasedAcres: string;
  leaseId: string | null;
  leaseName: string;
  lessee: string;
  leaseEffectiveDate: string;
  leaseDocNo: string;
  royaltyRate: string;
  royaltyBurden: string;
  unitRoyaltyDecimal: string;
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
  grossOrriRate: string;
  unitRoyaltyDecimal: string;
  unitOrriDecimal: string;
  preWorkingInterestDecimal: string;
  assignmentShare: string;
  assignedWorkingInterestDecimal: string;
  retainedWorkingInterestDecimal: string;
  overAssigned: boolean;
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

function currentMineralOwners(nodes: OwnershipNode[]) {
  return nodes.filter(
    (node) => node.type !== 'related' && !isNpriNode(node) && d(node.fraction).greaterThan(0)
  );
}

function leaseFractionForOwner(lease: Lease | null, ownerFraction: ReturnType<typeof d>) {
  if (!lease) {
    return d(0);
  }

  const leasedInterest = lease.leasedInterest.trim()
    ? parseInterestString(lease.leasedInterest)
    : ownerFraction;

  return leasedInterest.greaterThan(ownerFraction) ? ownerFraction : leasedInterest;
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
  const primaryLeaseByOwnerId = new Map<string, Lease>();

  leases.forEach((lease) => {
    const existing = primaryLeaseByOwnerId.get(lease.ownerId);
    if (!existing) {
      primaryLeaseByOwnerId.set(lease.ownerId, lease);
      return;
    }

    const picked = pickPrimaryLease([existing, lease]);
    if (picked) {
      primaryLeaseByOwnerId.set(lease.ownerId, picked);
    }
  });

  const totalGrossAcres = deskMaps.reduce(
    (sum, deskMap) => sum.plus(d(deskMap.grossAcres)),
    d(0)
  );
  const totalPooledAcres = deskMaps.reduce(
    (sum, deskMap) => sum.plus(d(deskMap.pooledAcres)),
    d(0)
  );
  const unitScopedGrossOrris = leaseholdOrris.filter(
    (orri) => orri.scope === 'unit' && orri.burdenBasis === 'gross_8_8'
  );
  const unitScopedGrossOrriRate = unitScopedGrossOrris.reduce(
    (sum, orri) => sum.plus(parseInterestString(orri.burdenFraction)),
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
        const primaryLease = node.linkedOwnerId
          ? primaryLeaseByOwnerId.get(node.linkedOwnerId) ?? null
          : null;
        const leasedFraction = leaseFractionForOwner(primaryLease, ownerFraction);
        const netMineralAcres = tractPooledAcres.times(ownerFraction);
        const leasedAcres = tractPooledAcres.times(leasedFraction);
        const royaltyRate = primaryLease ? parseInterestString(primaryLease.royaltyRate) : d(0);
        const royaltyBurden = leasedFraction.times(royaltyRate);
        const unitRoyaltyDecimal = totalPooledAcres.greaterThan(0)
          ? leasedAcres.div(totalPooledAcres).times(royaltyRate)
          : d(0);

        return {
          nodeId: node.id,
          ownerId: node.linkedOwnerId,
          ownerName: nameOwner(node, ownerById),
          fraction: ownerFraction.toString(),
          netMineralAcres: netMineralAcres.toString(),
          leasedFraction: leasedFraction.toString(),
          leasedAcres: leasedAcres.toString(),
          leaseId: primaryLease?.id ?? null,
          leaseName: primaryLease?.leaseName ?? '',
          lessee: primaryLease?.lessee ?? '',
          leaseEffectiveDate: primaryLease?.effectiveDate ?? '',
          leaseDocNo: primaryLease?.docNo ?? '',
          royaltyRate: primaryLease?.royaltyRate ?? '',
          royaltyBurden: royaltyBurden.toString(),
          unitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
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
      (sum, owner) => sum.plus(d(owner.royaltyBurden)),
      d(0)
    );
    const unitParticipation = totalPooledAcres.greaterThan(0)
      ? tractPooledAcres.div(totalPooledAcres)
      : d(0);
    const tractScopedGrossOrris = leaseholdOrris.filter(
      (orri) =>
        orri.scope === 'tract'
        && orri.deskMapId === deskMap.id
        && orri.burdenBasis === 'gross_8_8'
    );
    const tractScopedGrossOrriRate = tractScopedGrossOrris.reduce(
      (sum, orri) => sum.plus(parseInterestString(orri.burdenFraction)),
      d(0)
    );
    const grossOrriRate = unitScopedGrossOrriRate.plus(tractScopedGrossOrriRate);
    const leasedOrriBurden = leasedOwnership.times(grossOrriRate);
    const unitRoyaltyDecimal = ownersForTract.reduce(
      (sum, owner) => sum.plus(d(owner.unitRoyaltyDecimal)),
      d(0)
    );
    const unitOrriDecimal = unitParticipation.times(leasedOrriBurden);
    const preWorkingInterestRate = leasedOwnership
      .minus(weightedRoyaltyRate)
      .minus(leasedOrriBurden);
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
        .map((owner) => owner.lessee.trim())
        .filter((lessee) => lessee.length > 0)
    )];
    const trackedAssignmentCount = relevantAssignments.length;
    const includedAssignmentCount = relevantAssignments.filter((assignment) =>
      assignment.scope === 'unit' || assignment.deskMapId === deskMap.id
    ).length;
    const trackedOrriCount = leaseholdOrris.filter(
      (orri) => orri.scope === 'unit' || orri.deskMapId === deskMap.id
    ).length;
    const includedOrriCount = leaseholdOrris.filter(
      (orri) =>
        orri.burdenBasis === 'gross_8_8'
        && (orri.scope === 'unit' || orri.deskMapId === deskMap.id)
    ).length;

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
      grossOrriRate: grossOrriRate.toString(),
      unitRoyaltyDecimal: unitRoyaltyDecimal.toString(),
      unitOrriDecimal: unitOrriDecimal.toString(),
      preWorkingInterestDecimal: preWorkingInterestDecimal.toString(),
      assignmentShare: assignmentShare.toString(),
      assignedWorkingInterestDecimal: assignedWorkingInterestDecimal.toString(),
      retainedWorkingInterestDecimal: retainedWorkingInterestDecimal.greaterThan(0)
        ? retainedWorkingInterestDecimal.toString()
        : '0',
      overAssigned: assignmentShare.greaterThan(1),
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
      orri.burdenBasis === 'gross_8_8'
      && (
        orri.scope === 'unit'
          ? tracts.some((candidate) => d(candidate.unitParticipation).greaterThan(0))
          : Boolean(tract)
      );
    const grossBurden = includedInMath ? parseInterestString(orri.burdenFraction) : d(0);
    const unitDecimal = includedInMath
      ? orri.scope === 'unit'
        ? tracts.reduce(
            (sum, candidate) =>
              sum.plus(
                d(candidate.unitParticipation)
                  .times(d(candidate.leasedOwnership))
                  .times(grossBurden)
              ),
            d(0)
          )
        : d(tract?.unitParticipation ?? '0')
            .times(d(tract?.leasedOwnership ?? '0'))
            .times(grossBurden)
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
      pushRow({
        id: `royalty-${focusedTract.deskMapId}-${owner.nodeId}`,
        category: 'royalty',
        payee: owner.ownerName,
        tractName: focusedTract.name,
        tractCode: focusedTract.code,
        sourceLabel:
          owner.leaseName || owner.lessee
            ? `${owner.leaseName || owner.lessee}${owner.royaltyRate ? ` • Royalty ${owner.royaltyRate}` : ''}`
            : 'Lease royalty',
        effectiveDate: owner.leaseEffectiveDate,
        sourceDocNo: owner.leaseDocNo,
        decimal: owner.unitRoyaltyDecimal,
      });
    });

    unitSummary.orris
      .filter((orri) => orri.scope === 'unit' || orri.deskMapId === focusedTract.deskMapId)
      .forEach((orri) => {
        const decimal =
          orri.scope === 'unit'
            ? d(focusedTract.unitParticipation)
                .times(d(focusedTract.leasedOwnership))
                .times(parseInterestString(orri.burdenFraction))
                .toString()
            : orri.unitDecimal;
        pushRow({
          id: `orri-${focusedTract.deskMapId}-${orri.id}`,
          category: 'orri',
          payee: orri.payee || 'Unnamed ORRI',
          tractName: focusedTract.name,
          tractCode: focusedTract.code,
          sourceLabel: orri.scope === 'unit' ? 'Unit ORRI burden' : `${focusedTract.code} ORRI burden`,
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
        pushRow({
          id: `royalty-${tract.deskMapId}-${owner.nodeId}`,
          category: 'royalty',
          payee: owner.ownerName,
          tractName: tract.name,
          tractCode: tract.code,
          sourceLabel:
            owner.leaseName || owner.lessee
              ? `${tract.code} • ${owner.leaseName || owner.lessee}${owner.royaltyRate ? ` • Royalty ${owner.royaltyRate}` : ''}`
              : `${tract.code} lease royalty`,
          effectiveDate: owner.leaseEffectiveDate,
          sourceDocNo: owner.leaseDocNo,
          decimal: owner.unitRoyaltyDecimal,
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
          sourceLabel: orri.scope === 'unit' ? 'Unit ORRI burden' : `${orri.tractName} ORRI burden`,
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
