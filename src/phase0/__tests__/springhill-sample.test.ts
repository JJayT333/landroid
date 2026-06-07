import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { calculateDeskMapCoverageSummary } from '../../components/deskmap/deskmap-coverage';
import { buildLeaseholdUnitSummary } from '../../components/leasehold/leasehold-summary';
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
    const exported = await exportLandroidFile(imported);
    const reloaded = await importLandroidFile(
      new File([await exported.text()], 'springhill-dr-elmore-roundtrip.landroid', {
        type: 'application/json',
      })
    );
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
});
