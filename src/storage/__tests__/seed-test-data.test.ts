import { describe, expect, it } from 'vitest';
import { buildCombinatorialWorkspaceData } from '../seed-test-data';

describe('buildCombinatorialWorkspaceData', () => {
  // Build once — the generator is deterministic, so sharing a single snapshot
  // across all assertions is safe and keeps the suite fast.
  const workspace = buildCombinatorialWorkspaceData();

  it('produces 10 desk maps in two units of 5 tracts each', () => {
    expect(workspace.deskMaps).toHaveLength(10);
    const unitA = workspace.deskMaps.filter((dm) => dm.unitCode === 'A');
    const unitB = workspace.deskMaps.filter((dm) => dm.unitCode === 'B');
    expect(unitA).toHaveLength(5);
    expect(unitB).toHaveLength(5);
    expect(unitA.every((dm) => dm.unitName === 'Raven Forest Unit A')).toBe(true);
    expect(unitB.every((dm) => dm.unitName === 'Raven Forest Unit B')).toBe(true);
  });

  it('assigns Unit A tracts to Texas Energy Acquisitions LP', () => {
    const unitANodeIds = new Set(
      workspace.deskMaps
        .filter((dm) => dm.unitCode === 'A')
        .flatMap((dm) => dm.nodeIds)
    );
    const unitALeaseNodes = workspace.nodes.filter(
      (n) =>
        unitANodeIds.has(n.id)
        && n.type === 'related'
        && n.relatedKind === 'lease'
        && n.grantee === 'Texas Energy Acquisitions LP'
    );
    expect(unitALeaseNodes.length).toBeGreaterThan(0);
  });

  it('assigns Unit B tracts to Lone Star Minerals LLC', () => {
    const unitBLeaseNodes = workspace.nodes.filter(
      (n) =>
        n.type === 'related'
        && n.relatedKind === 'lease'
        && n.grantee === 'Lone Star Minerals LLC'
    );
    const unitBNodeIds = new Set(
      workspace.deskMaps
        .filter((dm) => dm.unitCode === 'B')
        .flatMap((dm) => dm.nodeIds)
    );
    expect(unitBLeaseNodes.some((n) => unitBNodeIds.has(n.id))).toBe(true);
  });

  it('keeps owner-card names unique across the combinatorial sample', () => {
    const visiblePartyNames = workspace.nodes
      .filter((node) => node.type !== 'related')
      .map((node) => node.grantee.trim())
      .filter((name) => name.length > 0);

    expect(visiblePartyNames.length).toBeGreaterThan(0);
    expect(new Set(visiblePartyNames).size).toBe(visiblePartyNames.length);
  });

  it('marks combinatorial fixed NPRI demo nodes as whole-tract burdens', () => {
    const fixedNpriNodes = workspace.nodes.filter(
      (node) => node.type !== 'related'
        && node.interestClass === 'npri'
        && node.royaltyKind === 'fixed'
    );

    expect(fixedNpriNodes.length).toBeGreaterThan(0);
    expect(fixedNpriNodes.every((node) => node.fixedRoyaltyBasis === 'whole_tract')).toBe(true);
  });

  it('produces variable node counts per tract', () => {
    const nodeCountsByCode = new Map<string, number>();
    for (const dm of workspace.deskMaps) {
      nodeCountsByCode.set(dm.code, dm.nodeIds.length);
    }
    // Kitchen sink (C10) should be substantially larger than baseline (C1).
    const c1 = nodeCountsByCode.get('C1') ?? 0;
    const c10 = nodeCountsByCode.get('C10') ?? 0;
    expect(c1).toBeGreaterThan(30);
    expect(c10).toBeGreaterThan(200);
    expect(c10).toBeGreaterThan(c1 * 2);
  });

  it('C7 has an over-conveyance trigger node', () => {
    const c7NodeIds = new Set(
      workspace.deskMaps.find((dm) => dm.code === 'C7')?.nodeIds ?? []
    );
    const overConveyed = workspace.nodes.find(
      (n) => c7NodeIds.has(n.id) && n.remarks.includes('over-conveyance trigger')
    );
    expect(overConveyed).toBeDefined();
  });

  it('C9 has an orphan node with a broken parentId', () => {
    const c9NodeIds = new Set(
      workspace.deskMaps.find((dm) => dm.code === 'C9')?.nodeIds ?? []
    );
    const orphan = workspace.nodes.find(
      (n) =>
        c9NodeIds.has(n.id)
        && n.parentId === 'missing-parent-orphan-trigger'
    );
    expect(orphan).toBeDefined();
  });

  it('C3 has NPRI nodes triggering discrepancy scenario', () => {
    const c3NodeIds = new Set(
      workspace.deskMaps.find((dm) => dm.code === 'C3')?.nodeIds ?? []
    );
    const npriNodes = workspace.nodes.filter(
      (n) =>
        c3NodeIds.has(n.id)
        && n.interestClass === 'npri'
        && n.royaltyKind === 'fixed'
    );
    expect(npriNodes.length).toBeGreaterThanOrEqual(2);
  });

  it('project name includes Raven Forest', () => {
    expect(workspace.projectName).toMatch(/Raven Forest/);
  });
});
