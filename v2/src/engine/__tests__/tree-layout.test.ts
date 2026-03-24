/**
 * Tree layout tests.
 *
 * Verifies that the layout algorithm produces correct, non-overlapping
 * positions for trees of various sizes. Critical: ALL nodes must land
 * on a single canvas — no pages, no sheets.
 */
import { describe, it, expect } from 'vitest';
import { layoutOwnershipTree, layoutOwnershipTreeWithElk } from '../tree-layout';
import { createBlankNode } from '../../types/node';
import type { OwnershipNode } from '../../types/node';

function makeNode(id: string, parentId: string | null, initial: string, fraction: string): OwnershipNode {
  return {
    ...createBlankNode(id, parentId),
    initialFraction: initial,
    fraction,
    grantee: `Grantee ${id}`,
    grantor: parentId ? `Grantee ${parentId}` : 'State of NM',
    instrument: parentId ? 'Mineral Deed' : 'Patent',
  };
}

describe('layoutOwnershipTree', () => {
  it('empty array returns empty result', () => {
    const result = layoutOwnershipTree([]);
    expect(result.flowNodes).toHaveLength(0);
    expect(result.flowEdges).toHaveLength(0);
  });

  it('single root node', () => {
    const nodes = [makeNode('root', null, '1.0', '1.0')];
    const result = layoutOwnershipTree(nodes);
    expect(result.flowNodes).toHaveLength(1);
    expect(result.flowEdges).toHaveLength(0);
    expect(result.flowNodes[0].id).toBe('root');
  });

  it('parent with 2 children — children are below parent', () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];
    const result = layoutOwnershipTree(nodes);
    expect(result.flowNodes).toHaveLength(3);
    expect(result.flowEdges).toHaveLength(2);

    const rootY = result.flowNodes.find(n => n.id === 'root')!.position.y;
    const childAY = result.flowNodes.find(n => n.id === 'a')!.position.y;
    const childBY = result.flowNodes.find(n => n.id === 'b')!.position.y;

    // Children must be below parent
    expect(childAY).toBeGreaterThan(rootY);
    expect(childBY).toBeGreaterThan(rootY);

    // Children should be at same Y level
    expect(childAY).toBe(childBY);

    // Children should not overlap horizontally
    const childAX = result.flowNodes.find(n => n.id === 'a')!.position.x;
    const childBX = result.flowNodes.find(n => n.id === 'b')!.position.x;
    expect(Math.abs(childAX - childBX)).toBeGreaterThan(100);
  });

  it('relative share shows fraction of parent, not of whole', () => {
    // Root = 1.0, splits into A (0.5) and B (0.5)
    // A splits into C (0.25) and D (0.25)
    // B splits into E,F,G,H (0.125 each)
    const nodes = [
      makeNode('root', null, '1.000000000', '0.000000000'),
      makeNode('a', 'root', '0.500000000', '0.000000000'),
      makeNode('b', 'root', '0.500000000', '0.000000000'),
      makeNode('c', 'a', '0.250000000', '0.250000000'),
      makeNode('d', 'a', '0.250000000', '0.250000000'),
      makeNode('e', 'b', '0.125000000', '0.125000000'),
      makeNode('f', 'b', '0.125000000', '0.125000000'),
      makeNode('g', 'b', '0.125000000', '0.125000000'),
      makeNode('h', 'b', '0.125000000', '0.125000000'),
    ];
    const result = layoutOwnershipTree(nodes);

    const getData = (id: string) => result.flowNodes.find(n => n.id === id)!.data;

    // Root: relative share = absolute (no parent) = 1.0
    expect(getData('root').relativeShare).toBe('1.000000000');

    // A got 0.5 out of root's 1.0 → relative = 0.5
    expect(getData('a').relativeShare).toBe('0.500000000');
    expect(getData('a').grantFraction).toBe('0.500000000'); // absolute = 0.5

    // C got 0.25 out of A's 0.5 → relative = 0.5 (half of parent)
    expect(getData('c').relativeShare).toBe('0.500000000');
    expect(getData('c').grantFraction).toBe('0.250000000'); // absolute = 0.25

    // E got 0.125 out of B's 0.5 → relative = 0.25 (quarter of parent)
    expect(getData('e').relativeShare).toBe('0.250000000');
    expect(getData('e').grantFraction).toBe('0.125000000'); // absolute = 0.125

    // B splits into 4 equal → each gets 1/4 of B
    expect(getData('f').relativeShare).toBe('0.250000000');
    expect(getData('g').relativeShare).toBe('0.250000000');
    expect(getData('h').relativeShare).toBe('0.250000000');
  });

  it('related document sits beside its parent, not below', () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      { ...makeNode('rel1', 'root', '0', '0'), type: 'related' as const, instrument: 'Affidavit' },
    ];
    const result = layoutOwnershipTree(nodes);
    expect(result.flowNodes).toHaveLength(2);

    const rootPos = result.flowNodes.find(n => n.id === 'root')!.position;
    const relPos = result.flowNodes.find(n => n.id === 'rel1')!.position;

    // Related doc should be to the right
    expect(relPos.x).toBeGreaterThan(rootPos.x);
    // And at roughly the same Y
    expect(Math.abs(relPos.y - rootPos.y)).toBeLessThan(200);
  });

  it('all nodes on single canvas — no node at extreme coordinates', () => {
    // Build a 3-level tree with 4 children per level
    const nodes: OwnershipNode[] = [makeNode('root', null, '1.0', '0.0')];
    let count = 1;
    // Level 1: 4 children
    for (let i = 0; i < 4; i++) {
      const id = `L1-${i}`;
      nodes.push(makeNode(id, 'root', '0.25', '0.0'));
      count++;
      // Level 2: 4 children each
      for (let j = 0; j < 4; j++) {
        const cid = `L2-${i}-${j}`;
        nodes.push(makeNode(cid, id, '0.0625', '0.0625'));
        count++;
      }
    }

    const result = layoutOwnershipTree(nodes);
    expect(result.flowNodes.length).toBe(count);

    // All nodes should have finite, reasonable coordinates
    for (const node of result.flowNodes) {
      expect(Number.isFinite(node.position.x)).toBe(true);
      expect(Number.isFinite(node.position.y)).toBe(true);
      // No node should be at absurd coordinates (sanity check)
      expect(Math.abs(node.position.x)).toBeLessThan(100_000);
      expect(Math.abs(node.position.y)).toBeLessThan(100_000);
    }
  });

  it('no overlapping nodes in a 50-node tree', () => {
    // Build a realistic tree
    const nodes: OwnershipNode[] = [makeNode('root', null, '1.0', '0.0')];
    const queue = ['root'];
    let count = 1;

    while (count < 50 && queue.length > 0) {
      const parentId = queue.shift()!;
      const childCount = Math.min(3, 50 - count);
      for (let i = 0; i < childCount; i++) {
        const id = `n${count}`;
        nodes.push(makeNode(id, parentId, '0.1', '0.1'));
        queue.push(id);
        count++;
      }
    }

    const result = layoutOwnershipTree(nodes);
    const NODE_W = 288;
    const NODE_H = 160;

    // Check no two nodes overlap (bounding box intersection)
    for (let i = 0; i < result.flowNodes.length; i++) {
      for (let j = i + 1; j < result.flowNodes.length; j++) {
        const a = result.flowNodes[i].position;
        const b = result.flowNodes[j].position;

        const overlapX = a.x < b.x + NODE_W && a.x + NODE_W > b.x;
        const overlapY = a.y < b.y + NODE_H && a.y + NODE_H > b.y;

        if (overlapX && overlapY) {
          throw new Error(
            `Nodes ${result.flowNodes[i].id} and ${result.flowNodes[j].id} overlap at ` +
            `(${a.x},${a.y}) vs (${b.x},${b.y})`
          );
        }
      }
    }
  });

  it('handles 200 nodes without crashing', () => {
    const nodes: OwnershipNode[] = [makeNode('root', null, '1.0', '0.0')];
    const queue = ['root'];
    let count = 1;

    while (count < 200 && queue.length > 0) {
      const parentId = queue.shift()!;
      const childCount = Math.min(2 + (count % 3), 200 - count);
      for (let i = 0; i < childCount; i++) {
        const id = `n${count}`;
        nodes.push(makeNode(id, parentId, '0.01', '0.01'));
        queue.push(id);
        count++;
      }
    }

    const start = performance.now();
    const result = layoutOwnershipTree(nodes);
    const elapsed = performance.now() - start;

    expect(result.flowNodes.length).toBe(200);
    expect(elapsed).toBeLessThan(500); // Should be <100ms but generous bound
  });

  it('handles 500 nodes without crashing', () => {
    const nodes: OwnershipNode[] = [makeNode('root', null, '1.0', '0.0')];
    const queue = ['root'];
    let count = 1;

    while (count < 500 && queue.length > 0) {
      const parentId = queue.shift()!;
      const childCount = Math.min(3, 500 - count);
      for (let i = 0; i < childCount; i++) {
        const id = `n${count}`;
        nodes.push(makeNode(id, parentId, '0.01', '0.01'));
        queue.push(id);
        count++;
      }
    }

    const start = performance.now();
    const result = layoutOwnershipTree(nodes);
    const elapsed = performance.now() - start;

    expect(result.flowNodes.length).toBe(500);
    expect(elapsed).toBeLessThan(1000);
  });

  it('handles 1000 nodes without crashing', () => {
    const nodes: OwnershipNode[] = [makeNode('root', null, '1.0', '0.0')];
    const queue = ['root'];
    let count = 1;

    while (count < 1000 && queue.length > 0) {
      const parentId = queue.shift()!;
      const childCount = Math.min(3, 1000 - count);
      for (let i = 0; i < childCount; i++) {
        const id = `n${count}`;
        nodes.push(makeNode(id, parentId, '0.01', '0.01'));
        queue.push(id);
        count++;
      }
    }

    const start = performance.now();
    const result = layoutOwnershipTree(nodes);
    const elapsed = performance.now() - start;

    expect(result.flowNodes.length).toBe(1000);
    expect(elapsed).toBeLessThan(2000);
  });

  it('applies independent horizontal and vertical spacing factors', () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];

    const defaultLayout = layoutOwnershipTree(nodes);
    const spacedLayout = layoutOwnershipTree(nodes, {
      horizontalSpacingFactor: 2,
      verticalSpacingFactor: 1.5,
    });

    const defaultA = defaultLayout.flowNodes.find((node) => node.id === 'a')!;
    const defaultB = defaultLayout.flowNodes.find((node) => node.id === 'b')!;
    const spacedRoot = spacedLayout.flowNodes.find((node) => node.id === 'root')!;
    const spacedA = spacedLayout.flowNodes.find((node) => node.id === 'a')!;
    const spacedB = spacedLayout.flowNodes.find((node) => node.id === 'b')!;

    expect(spacedRoot.position.y).toBe(0);
    expect(spacedB.position.x - spacedA.position.x).toBeGreaterThan(
      defaultB.position.x - defaultA.position.x
    );
    expect(spacedA.position.y).toBeGreaterThan(defaultA.position.y);
  });

  it('scales layout geometry with node scale', () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];

    const defaultLayout = layoutOwnershipTree(nodes);
    const scaledLayout = layoutOwnershipTree(nodes, { nodeScale: 0.5 });

    const defaultA = defaultLayout.flowNodes.find((node) => node.id === 'a')!;
    const defaultB = defaultLayout.flowNodes.find((node) => node.id === 'b')!;
    const scaledRoot = scaledLayout.flowNodes.find((node) => node.id === 'root')!;
    const scaledA = scaledLayout.flowNodes.find((node) => node.id === 'a')!;
    const scaledB = scaledLayout.flowNodes.find((node) => node.id === 'b')!;

    expect(scaledRoot.data.nodeScale).toBe(0.5);
    expect(scaledB.position.x - scaledA.position.x).toBeLessThan(
      defaultB.position.x - defaultA.position.x
    );
    expect(scaledA.position.y).toBeLessThan(defaultA.position.y);
  });

  it('still applies spacing changes after the chart is scaled down', () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];

    const compactLayout = layoutOwnershipTree(nodes, {
      nodeScale: 0.35,
      horizontalSpacingFactor: 1,
      verticalSpacingFactor: 1,
    });
    const spacedLayout = layoutOwnershipTree(nodes, {
      nodeScale: 0.35,
      horizontalSpacingFactor: 1.75,
      verticalSpacingFactor: 1.75,
    });

    const compactA = compactLayout.flowNodes.find((node) => node.id === 'a')!;
    const compactB = compactLayout.flowNodes.find((node) => node.id === 'b')!;
    const spacedA = spacedLayout.flowNodes.find((node) => node.id === 'a')!;
    const spacedB = spacedLayout.flowNodes.find((node) => node.id === 'b')!;

    expect(spacedB.position.x - spacedA.position.x).toBeGreaterThan(
      compactB.position.x - compactA.position.x
    );
    expect(spacedA.position.y).toBeGreaterThan(compactA.position.y);
  });
});

describe('layoutOwnershipTreeWithElk', () => {
  it('empty array returns empty result', async () => {
    const result = await layoutOwnershipTreeWithElk([]);
    expect(result.flowNodes).toHaveLength(0);
    expect(result.flowEdges).toHaveLength(0);
  });

  it('lays out parent-child hierarchy with children below parent', async () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];

    const result = await layoutOwnershipTreeWithElk(nodes);
    const root = result.flowNodes.find((n) => n.id === 'root');
    const a = result.flowNodes.find((n) => n.id === 'a');
    const b = result.flowNodes.find((n) => n.id === 'b');

    expect(root).toBeTruthy();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a!.position.y).toBeGreaterThan(root!.position.y);
    expect(b!.position.y).toBeGreaterThan(root!.position.y);
    expect(a!.data.relativeShare).toBe('0.250000000');
    expect(b!.data.relativeShare).toBe('0.250000000');
  });

  it('keeps related documents beside their parent', async () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      { ...makeNode('rel1', 'root', '0', '0'), type: 'related' as const, instrument: 'Affidavit' },
    ];

    const result = await layoutOwnershipTreeWithElk(nodes);
    const root = result.flowNodes.find((n) => n.id === 'root');
    const rel = result.flowNodes.find((n) => n.id === 'rel1');

    expect(root).toBeTruthy();
    expect(rel).toBeTruthy();
    expect(rel!.position.x).toBeGreaterThan(root!.position.x);
    expect(Math.abs(rel!.position.y - root!.position.y)).toBeLessThan(200);
  });

  it('respects independent spacing factors', async () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];

    const defaultLayout = await layoutOwnershipTreeWithElk(nodes);
    const spacedLayout = await layoutOwnershipTreeWithElk(nodes, {
      horizontalSpacingFactor: 2,
      verticalSpacingFactor: 1.5,
    });

    const defaultRoot = defaultLayout.flowNodes.find((node) => node.id === 'root')!;
    const defaultA = defaultLayout.flowNodes.find((node) => node.id === 'a')!;
    const defaultB = defaultLayout.flowNodes.find((node) => node.id === 'b')!;
    const spacedRoot = spacedLayout.flowNodes.find((node) => node.id === 'root')!;
    const spacedA = spacedLayout.flowNodes.find((node) => node.id === 'a')!;
    const spacedB = spacedLayout.flowNodes.find((node) => node.id === 'b')!;

    expect(spacedRoot.position.y).toBe(defaultRoot.position.y);
    expect(spacedB.position.x - spacedA.position.x).toBeGreaterThan(
      defaultB.position.x - defaultA.position.x
    );
    expect(spacedA.position.y - spacedRoot.position.y).toBeGreaterThan(
      defaultA.position.y - defaultRoot.position.y
    );
  });

  it('preserves smaller node scale in elk layout', async () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];

    const defaultLayout = await layoutOwnershipTreeWithElk(nodes);
    const scaledLayout = await layoutOwnershipTreeWithElk(nodes, { nodeScale: 0.5 });

    const defaultRoot = defaultLayout.flowNodes.find((node) => node.id === 'root')!;
    const defaultA = defaultLayout.flowNodes.find((node) => node.id === 'a')!;
    const defaultB = defaultLayout.flowNodes.find((node) => node.id === 'b')!;
    const scaledRoot = scaledLayout.flowNodes.find((node) => node.id === 'root')!;
    const scaledA = scaledLayout.flowNodes.find((node) => node.id === 'a')!;
    const scaledB = scaledLayout.flowNodes.find((node) => node.id === 'b')!;

    expect(scaledRoot.data.nodeScale).toBe(0.5);
    expect(scaledB.position.x - scaledA.position.x).toBeLessThan(
      defaultB.position.x - defaultA.position.x
    );
    expect(scaledA.position.y - scaledRoot.position.y).toBeLessThan(
      defaultA.position.y - defaultRoot.position.y
    );
  });

  it('keeps elk spacing adjustments visible after node scale shrinks', async () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
    ];

    const compactLayout = await layoutOwnershipTreeWithElk(nodes, {
      nodeScale: 0.35,
      horizontalSpacingFactor: 1,
      verticalSpacingFactor: 1,
    });
    const spacedLayout = await layoutOwnershipTreeWithElk(nodes, {
      nodeScale: 0.35,
      horizontalSpacingFactor: 1.75,
      verticalSpacingFactor: 1.75,
    });

    const compactRoot = compactLayout.flowNodes.find((node) => node.id === 'root')!;
    const compactA = compactLayout.flowNodes.find((node) => node.id === 'a')!;
    const compactB = compactLayout.flowNodes.find((node) => node.id === 'b')!;
    const spacedRoot = spacedLayout.flowNodes.find((node) => node.id === 'root')!;
    const spacedA = spacedLayout.flowNodes.find((node) => node.id === 'a')!;
    const spacedB = spacedLayout.flowNodes.find((node) => node.id === 'b')!;

    expect(spacedB.position.x - spacedA.position.x).toBeGreaterThan(
      compactB.position.x - compactA.position.x
    );
    expect(spacedA.position.y - spacedRoot.position.y).toBeGreaterThan(
      compactA.position.y - compactRoot.position.y
    );
  });

  it('uses centered horizontal placement for elk layout import positions', async () => {
    const nodes = [
      makeNode('root', null, '1.0', '0.5'),
      makeNode('a', 'root', '0.25', '0.25'),
      makeNode('b', 'root', '0.25', '0.25'),
      makeNode('c', 'a', '0.125', '0.125'),
      makeNode('d', 'a', '0.125', '0.125'),
    ];

    const fallbackLayout = layoutOwnershipTree(nodes);
    const elkLayout = await layoutOwnershipTreeWithElk(nodes);

    for (const node of fallbackLayout.flowNodes) {
      const elkNode = elkLayout.flowNodes.find((candidate) => candidate.id === node.id);
      expect(elkNode).toBeTruthy();
      expect(elkNode!.position.x).toBe(node.position.x);
    }
  });
});
