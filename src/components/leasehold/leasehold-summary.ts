import { d } from '../../engine/decimal';
import { isNpriNode, type DeskMap, type OwnershipNode } from '../../types/node';
import type { Lease, Owner } from '../../types/owner';
import type { LeaseholdOrri } from '../../types/leasehold';
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
  currentOwnerCount: number;
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

export interface LeaseholdUnitSummary {
  tractCount: number;
  totalGrossAcres: string;
  totalPooledAcres: string;
  totalRoyaltyDecimal: string;
  totalOrriDecimal: string;
  preWorkingInterestDecimal: string;
  configuredGrossAcresCount: number;
  configuredPooledAcresCount: number;
  fullyLeasedTractCount: number;
  currentOwnerCount: number;
  trackedOrriCount: number;
  includedOrriCount: number;
  excludedOrriCount: number;
  uniqueLessees: string[];
  orris: LeaseholdOrriSummary[];
  tracts: LeaseholdTractSummary[];
}

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
  leaseholdOrris,
}: {
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
  owners: Owner[];
  leases: Lease[];
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
    const uniqueLessees = [...new Set(
      ownersForTract
        .map((owner) => owner.lessee.trim())
        .filter((lessee) => lessee.length > 0)
    )];
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
      currentOwnerCount: ownersForTract.length,
      includedOrriCount,
      trackedOrriCount,
      uniqueLessees,
      owners: ownersForTract,
    };
  });
  const tractSummaryById = new Map(tracts.map((tract) => [tract.deskMapId, tract]));
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
    preWorkingInterestDecimal: tracts.reduce(
      (sum, tract) => sum.plus(d(tract.preWorkingInterestDecimal)),
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
    trackedOrriCount: orris.length,
    includedOrriCount: orris.filter((orri) => orri.includedInMath).length,
    excludedOrriCount: orris.filter((orri) => !orri.includedInMath).length,
    uniqueLessees: [...new Set(tracts.flatMap((tract) => tract.uniqueLessees))],
    orris,
    tracts,
  };
}
