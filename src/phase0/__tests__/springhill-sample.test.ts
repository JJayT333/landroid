import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { calculateDeskMapCoverageSummary } from '../../title-math';
import {
  buildLeaseholdTransferOrderHoldReasons,
  buildLeaseholdUnitSummary,
} from '../../title-math';
import { d } from '../../engine/decimal';
import {
  exportLandroidFile,
  importLandroidFile,
  type LandroidFileData,
} from '../../storage/workspace-persistence';
import type { Lease, Owner } from '../../types/owner';

const SAMPLE_PATH = join(process.cwd(), 'public', 'samples', 'springhill-dr-elmore.landroid');
const LCT_OWNER_NAME = 'Charlyn K. Tyra, as Trustee of the LCT Revocable Trust';
const LCT_OGML = 'OGML-LCT-Trust';

function readSampleText() {
  return readFileSync(SAMPLE_PATH, 'utf8');
}

function readSample() {
  return JSON.parse(readSampleText()) as LandroidFileData;
}

function activeLeasesByOwnerId(leases: Lease[]) {
  const result = new Map<string, Lease[]>();
  for (const lease of leases) {
    const current = result.get(lease.ownerId) ?? [];
    current.push(lease);
    result.set(lease.ownerId, current);
  }
  return result;
}

function findLctOwner(owners: Owner[]) {
  const owner = owners.find((candidate) => candidate.name === LCT_OWNER_NAME);
  expect(owner).toBeDefined();
  return owner!;
}

describe('Springhill Dr. Elmore public sample', () => {
  it('keeps the LCT OGML lease attached to the Tract 1 owner and math', () => {
    const sample = readSample();
    const lctOwner = findLctOwner(sample.ownerData!.owners);
    const lctLease = sample.ownerData!.leases.find(
      (lease) => lease.ownerId === lctOwner.id && lease.docNo === LCT_OGML
    );
    expect(lctLease).toMatchObject({
      royaltyRate: '1/4',
      status: 'Active',
      jurisdiction: 'tx_fee',
    });
    expect(lctLease!.notes).toContain('one-year primary term');
    expect(lctLease!.notes.toLowerCase()).not.toContain('3 years');

    const lctOwnerNode = sample.nodes.find(
      (node) =>
        node.linkedOwnerId === lctOwner.id &&
        node.parentId === 'tr1c-3' &&
        node.fraction === '0.250000000'
    );
    expect(lctOwnerNode).toBeDefined();
    expect(sample.nodes).toContainEqual(
      expect.objectContaining({
        parentId: lctOwnerNode!.id,
        relatedKind: 'lease',
        linkedOwnerId: lctOwner.id,
        linkedLeaseId: lctLease!.id,
        docNo: LCT_OGML,
      })
    );

    const tractOne = sample.deskMaps.find((deskMap) => deskMap.code === 'TR1');
    expect(tractOne).toBeDefined();
    const tractOneNodes = sample.nodes.filter((node) => tractOne!.nodeIds.includes(node.id));
    const coverage = calculateDeskMapCoverageSummary(
      tractOneNodes,
      activeLeasesByOwnerId(sample.ownerData!.leases),
      sample.nodes
    );
    expect(coverage.leasedOwnership).toBe('1');
    expect(coverage.unleasedOwnership).toBe('0');

    const unitSummary = buildLeaseholdUnitSummary({
      deskMaps: sample.deskMaps,
      nodes: sample.nodes,
      owners: sample.ownerData!.owners,
      leases: sample.ownerData!.leases,
      leaseholdAssignments: sample.leaseholdAssignments ?? [],
      leaseholdOrris: sample.leaseholdOrris ?? [],
    });
    const tractOneSummary = unitSummary.tracts.find((tract) => tract.code === 'TR1');
    expect(tractOneSummary).toMatchObject({
      leasedOwnership: '1',
      weightedRoyaltyRate: '0.225',
      nriBeforeOrriRate: '0.775',
    });
  });

  it('preserves the LCT OGML through .landroid import/export reload', async () => {
    const imported = await importLandroidFile(
      new File([readSampleText()], 'springhill-dr-elmore.landroid', {
        type: 'application/json',
      })
    );
    expect(imported.documentFixityWarning).toBeUndefined();
    const exported = await exportLandroidFile(imported);
    const reloaded = await importLandroidFile(
      new File([await exported.text()], 'springhill-dr-elmore-roundtrip.landroid', {
        type: 'application/json',
      })
    );
    expect(reloaded.documentFixityWarning).toBeUndefined();
    const lctOwner = findLctOwner(reloaded.ownerData!.owners);
    const lctLease = reloaded.ownerData!.leases.find(
      (lease) => lease.ownerId === lctOwner.id && lease.docNo === LCT_OGML
    );
    expect(lctLease?.royaltyRate).toBe('1/4');
    expect(
      reloaded.nodes.some(
        (node) =>
          node.relatedKind === 'lease' &&
          node.linkedOwnerId === lctOwner.id &&
          node.linkedLeaseId === lctLease?.id &&
          node.docNo === LCT_OGML
      )
    ).toBe(true);
  });

  // HAND-VERIFIED ANCHORS (non-refreezable). These literals are the review's
  // own hand-recomputes on the real Springhill oracle. Unlike the frozen
  // baselines (which are re-captured from the engine and so cannot fail for a
  // uniform regression), changing one of these requires editing this test -- a
  // visible, reviewed change -- so they defend the interest stack against a
  // silently-refrozen regression. See scripts/title-math-baseline.ts for why the
  // baseline alone is not a correctness proof.
  it('pins the DA-H1 fixed-NPRI-from-royalty interest stack on Tract 2', () => {
    const sample = readSample();
    const unitSummary = buildLeaseholdUnitSummary({
      deskMaps: sample.deskMaps,
      nodes: sample.nodes,
      owners: sample.ownerData!.owners,
      leases: sample.ownerData!.leases,
      leaseholdAssignments: sample.leaseholdAssignments ?? [],
      leaseholdOrris: sample.leaseholdOrris ?? [],
    });
    const tr2 = unitSummary.tracts.find((tract) => tract.code === 'TR2');
    expect(tr2).toBeDefined();

    // The royalty / NRI / fixed-NPRI stack up to the WI (the numbers that must
    // stay clear), hand-verified.
    expect(tr2).toMatchObject({
      weightedRoyaltyRate: '0.154745133',
      nriBeforeOrriRate: '0.633175025',
      fixedNpriBurdenRate: '0.012311252',
      // DA-H1: the WI's NRI is reduced only by the fixed-NPRI EXCESS over the
      // lessor royalty, not the full fixed burden.
      npriAdjustedNriBeforeOrriRate: '0.633041075',
      fixedNpriExceedsRoyalty: true,
    });

    // The excess charged to the WI = nriBeforeOrri - npriAdjusted, hand-checked
    // to 0.000133950 (= the two zero-royalty slices' fixed NPRI, per the review).
    const excess = d(tr2!.nriBeforeOrriRate).minus(d(tr2!.npriAdjustedNriBeforeOrriRate));
    expect(excess.toFixed(9)).toBe('0.000133950');

    // The DA-H1 counsel-sign-off warning fires on the real oracle (TR2) and is
    // surfaced as a transfer-order hold reason (F4).
    expect(unitSummary.fixedNpriExceedsRoyaltyTractCount).toBe(1);
    expect(
      buildLeaseholdTransferOrderHoldReasons(unitSummary).some((reason) =>
        reason.includes('counsel-approved')
      )
    ).toBe(true);
  });

  it('pins the ratification mixed-demo state on the real oracle', () => {
    const sample = readSample();
    const unitSummary = buildLeaseholdUnitSummary({
      deskMaps: sample.deskMaps,
      nodes: sample.nodes,
      owners: sample.ownerData!.owners,
      leases: sample.ownerData!.leases,
      leaseholdAssignments: sample.leaseholdAssignments ?? [],
      leaseholdOrris: sample.leaseholdOrris ?? [],
    });
    // 6 NPRI owners who also hold minerals are 'ratified'; the 118 NPRI-only
    // nodes are 'unratified' and held. Ratification changes no decimal (the math
    // is deferred), so this guards only the flags / hold count.
    const ratified = unitSummary.npris.filter((npri) => npri.ratificationStatus === 'ratified');
    const unratified = unitSummary.npris.filter((npri) => npri.ratificationStatus === 'unratified');
    expect(ratified).toHaveLength(6);
    expect(unratified).toHaveLength(118);
    expect(unitSummary.npriRatificationHoldCount).toBe(118);
  });
});
