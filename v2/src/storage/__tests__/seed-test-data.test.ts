import { describe, expect, it } from 'vitest';
import { buildStressWorkspaceData } from '../seed-test-data';

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
    expect(cardCounts).toEqual([100, 150, 200]);
    expect(workspace.activeDeskMapId).toBe(workspace.deskMaps[0].id);

    const nodeIds = new Set(workspace.nodes.map((node) => node.id));
    const deskMapIds = workspace.deskMaps.flatMap((deskMap) => deskMap.nodeIds);
    expect(cardCounts.reduce((sum, count) => sum + count, 0)).toBe(450);
    expect(deskMapIds).toHaveLength(workspace.nodes.length);
    expect(new Set(deskMapIds)).toEqual(nodeIds);
    expect(workspace.pdfMappings.length).toBeGreaterThan(0);
  });
});
