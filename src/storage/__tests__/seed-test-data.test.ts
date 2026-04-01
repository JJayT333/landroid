import { describe, expect, it } from 'vitest';
import { isLeaseNode } from '../../components/deskmap/deskmap-lease-node';
import {
  buildLeaseholdDemoWorkspaceData,
  buildStressWorkspaceData,
} from '../seed-test-data';

describe('buildStressWorkspaceData', () => {
  it('builds separate tract desk maps sized for stress testing', () => {
    const workspace = buildStressWorkspaceData();
    const cardCounts = workspace.deskMaps.map((deskMap) =>
      deskMap.nodeIds.filter((nodeId) => {
        const node = workspace.nodes.find((candidate) => candidate.id === nodeId);
        return node?.type !== 'related';
      }).length
    );

    expect(workspace.projectName).toBe('Stress Test — 3 Tracts');
    expect(workspace.deskMaps).toHaveLength(3);
    expect(workspace.deskMaps.map((deskMap) => deskMap.name)).toEqual([
      'Tract 1',
      'Tract 2',
      'Tract 3',
    ]);
    expect(cardCounts).toEqual([100, 150, 500]);
    expect(workspace.activeDeskMapId).toBe(workspace.deskMaps[0].id);

    const nodeIds = new Set(workspace.nodes.map((node) => node.id));
    const deskMapIds = workspace.deskMaps.flatMap((deskMap) => deskMap.nodeIds);
    expect(cardCounts.reduce((sum, count) => sum + count, 0)).toBe(750);
    expect(deskMapIds).toHaveLength(workspace.nodes.length);
    expect(new Set(deskMapIds)).toEqual(nodeIds);
    expect(workspace.pdfMappings.length).toBeGreaterThan(0);
    expect(
      workspace.nodes.some(
        (node) => node.type !== 'related' && node.instrument === 'Assignment'
      )
    ).toBe(false);
  });

  it('keeps lease overlays separate from present ownership in the stress fixtures', () => {
    const workspace = buildStressWorkspaceData();
    const leasedOwners = workspace.nodes.filter(
      (node) => node.type !== 'related' && Number(node.fraction) > 0 && node.linkedOwnerId
    );
    const leaseNodes = workspace.nodes.filter((node) => isLeaseNode(node));

    expect(
      workspace.nodes.some(
        (node) => node.type !== 'related' && node.instrument === 'Oil & Gas Lease'
      )
    ).toBe(false);
    expect(leasedOwners.length).toBeGreaterThan(0);
    expect(leasedOwners.every((node) => node.linkedOwnerId)).toBe(true);
    expect(leaseNodes.length).toBeGreaterThan(0);
    expect(leaseNodes.every((node) => node.linkedLeaseId)).toBe(true);
    expect(workspace.ownerData.leases).toHaveLength(leaseNodes.length);
  });

  it('fills the generated desk-map nodes with complete metadata', () => {
    const workspace = buildStressWorkspaceData();

    for (const node of workspace.nodes) {
      expect(node.instrument).not.toBe('');
      expect(node.vol).not.toBe('');
      expect(node.page).not.toBe('');
      expect(node.docNo).not.toBe('');
      expect(node.fileDate).not.toBe('');
      expect(node.date).not.toBe('');
      expect(node.grantor).not.toBe('');
      expect(node.grantee).not.toBe('');
      expect(node.landDesc).not.toBe('');
      expect(node.remarks).not.toBe('');
      expect(node.manualAmount).not.toBe('');

      if (node.type !== 'related') {
        expect(node.numerator).not.toBe('0');
        expect(node.denominator).not.toBe('');
      }

      if (node.isDeceased) {
        expect(node.obituary).not.toBe('');
        expect(node.graveyardLink).not.toBe('');
      }
    }
  });

  it('builds a dedicated 8-tract leasehold demo with acreage and lease coverage', () => {
    const workspace = buildLeaseholdDemoWorkspaceData();
    const currentOwners = workspace.nodes.filter(
      (node) => node.type !== 'related' && Number(node.fraction) > 0
    );
    const currentOwnerIds = new Set(currentOwners.map((node) => node.id));
    const leaseParents = new Set(
      workspace.nodes.flatMap((node) =>
        isLeaseNode(node) && node.parentId ? [node.parentId] : []
      )
    );

    expect(workspace.projectName).toBe('Leasehold Demo — 8 Tracts');
    expect(workspace.deskMaps).toHaveLength(8);
    expect(workspace.deskMaps.map((deskMap) => deskMap.grossAcres)).toEqual([
      '80',
      '160',
      '240',
      '320',
      '400',
      '480',
      '560',
      '640',
    ]);
    expect(workspace.deskMaps.map((deskMap) => deskMap.pooledAcres)).toEqual([
      '80',
      '160',
      '240',
      '320',
      '400',
      '480',
      '560',
      '640',
    ]);
    expect(workspace.deskMaps.every((deskMap) => deskMap.description.length > 0)).toBe(true);
    expect(workspace.leaseholdUnit).toEqual({
      name: 'Raven Bend Unit',
      description:
        'Eight-tract pooled unit template with clean acreage, clean fractions, and full lease coverage for leasehold review.',
      operator: 'Permian Basin Operating, LLC',
      effectiveDate: '2024-01-01',
    });
    expect(workspace.leaseholdAssignments).toEqual([
      expect.objectContaining({
        assignor: 'Permian Basin Operating, LLC',
        assignee: 'Raven Bend Partners, LLC',
        scope: 'unit',
        workingInterestFraction: '1/2',
      }),
      expect.objectContaining({
        assignor: 'Permian Basin Operating, LLC',
        assignee: 'Cedar Draw Operating, LLC',
        scope: 'tract',
        workingInterestFraction: '1/4',
      }),
    ]);
    expect(workspace.leaseholdOrris).toEqual([
      expect.objectContaining({
        payee: 'Raven Bend Override, LP',
        scope: 'unit',
        burdenFraction: '1/16',
        burdenBasis: 'gross_8_8',
      }),
    ]);
    expect(workspace.leaseholdTransferOrderEntries).toEqual([]);
    expect(leaseParents).toEqual(currentOwnerIds);
    expect(workspace.ownerData.leases).toHaveLength(currentOwners.length);
    expect(new Set(workspace.ownerData.leases.map((lease) => lease.royaltyRate))).toEqual(
      new Set(['1/8'])
    );
    expect(workspace.ownerData.leases.every((lease) => lease.leasedInterest !== '')).toBe(true);
  });
});
