import { beforeEach, describe, expect, it } from 'vitest';
import type { Edge, Node } from '@xyflow/react';
import { useCanvasStore } from '../canvas-store';
import type { ShapeNodeData } from '../../types/flowchart';

function ownershipNode(id: string, x = 0): Node {
  return { id, type: 'ownership', position: { x, y: 0 }, data: { nodeId: id } };
}

function ownershipEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'ownership' };
}

function resetStore() {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    _past: [],
    _future: [],
    activeTool: 'select',
  });
}

describe('canvas-store: addShapeNode', () => {
  beforeEach(resetStore);

  it('creates a shape node centered on the click position and selects it', () => {
    const id = useCanvasStore.getState().addShapeNode('rect', { x: 200, y: 100 });
    const { nodes } = useCanvasStore.getState();

    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    expect(node.id).toBe(id);
    expect(node.type).toBe('shape');
    expect(node.selected).toBe(true);
    const data = node.data as unknown as ShapeNodeData;
    expect(data.shapeType).toBe('rect');
    // Position is offset so the shape is centered on the click point.
    expect(node.position.x).toBe(200 - data.width / 2);
    expect(node.position.y).toBe(100 - data.height / 2);
  });

  it('deselects existing nodes and pushes history', () => {
    useCanvasStore.setState({ nodes: [{ ...ownershipNode('o1'), selected: true }] });
    useCanvasStore.getState().addShapeNode('ellipse', { x: 0, y: 0 });
    const { nodes, _past } = useCanvasStore.getState();

    expect(nodes.find((n) => n.id === 'o1')?.selected).toBe(false);
    expect(_past.length).toBe(1);
  });
});

describe('canvas-store: mergeImportGraph', () => {
  beforeEach(resetStore);

  it('replaces ownership nodes/edges but preserves user shapes', () => {
    const shape: Node = {
      id: 'shape-1',
      type: 'shape',
      position: { x: 500, y: 500 },
      data: { shapeType: 'note', text: 'my annotation', width: 180, height: 140, fontSize: 14, textAlign: 'center' },
    };
    useCanvasStore.setState({
      nodes: [ownershipNode('old-1'), shape],
      edges: [ownershipEdge('e-old', 'old-1', 'old-1')],
    });

    const newOwnership = [ownershipNode('new-1', 10), ownershipNode('new-2', 320)];
    const newEdges = [ownershipEdge('e-new', 'new-1', 'new-2')];
    useCanvasStore.getState().mergeImportGraph(newOwnership, newEdges);

    const { nodes, edges } = useCanvasStore.getState();
    // Old ownership gone, new ownership present, shape preserved.
    expect(nodes.find((n) => n.id === 'old-1')).toBeUndefined();
    expect(nodes.find((n) => n.id === 'new-1')).toBeDefined();
    expect(nodes.find((n) => n.id === 'new-2')).toBeDefined();
    const preservedShape = nodes.find((n) => n.id === 'shape-1');
    expect(preservedShape).toBeDefined();
    expect((preservedShape!.data as unknown as ShapeNodeData).text).toBe('my annotation');
    // Old ownership edge gone, new ownership edge present.
    expect(edges.find((e) => e.id === 'e-old')).toBeUndefined();
    expect(edges.find((e) => e.id === 'e-new')).toBeDefined();
  });

  it('preserves an edge drawn between two user shapes', () => {
    const shapeA: Node = { id: 's-a', type: 'shape', position: { x: 0, y: 0 }, data: {} };
    const shapeB: Node = { id: 's-b', type: 'shape', position: { x: 100, y: 0 }, data: {} };
    const userEdge = { id: 'user-edge', source: 's-a', target: 's-b' };
    useCanvasStore.setState({ nodes: [shapeA, shapeB], edges: [userEdge] });

    useCanvasStore.getState().mergeImportGraph([ownershipNode('new-1')], []);

    const { edges } = useCanvasStore.getState();
    expect(edges.find((e) => e.id === 'user-edge')).toBeDefined();
  });
});

describe('canvas-store: copy / paste / duplicate', () => {
  beforeEach(resetStore);

  it('pastes selected nodes and their internal edges with fresh ids and offset', () => {
    const a: Node = { id: 'a', type: 'shape', position: { x: 0, y: 0 }, data: {}, selected: true };
    const b: Node = { id: 'b', type: 'shape', position: { x: 50, y: 0 }, data: {}, selected: true };
    const edge: Edge = { id: 'a-b', source: 'a', target: 'b', selected: true };
    useCanvasStore.setState({ nodes: [a, b], edges: [edge] });

    useCanvasStore.getState().copySelection();
    useCanvasStore.getState().paste();

    const { nodes, edges } = useCanvasStore.getState();
    expect(nodes).toHaveLength(4);
    expect(edges).toHaveLength(2);

    // Originals deselected, clones selected.
    const clones = nodes.filter((n) => n.selected);
    expect(clones).toHaveLength(2);
    // Clone ids differ from originals, positions offset.
    for (const clone of clones) {
      expect(clone.id).not.toBe('a');
      expect(clone.id).not.toBe('b');
    }
    // The pasted edge re-points at the cloned node ids (not the originals).
    const pastedEdge = edges.find((e) => e.id !== 'a-b')!;
    const cloneIds = new Set(clones.map((n) => n.id));
    expect(cloneIds.has(pastedEdge.source)).toBe(true);
    expect(cloneIds.has(pastedEdge.target)).toBe(true);
  });

  it('does not copy edges that cross the selection boundary', () => {
    const a: Node = { id: 'a', type: 'shape', position: { x: 0, y: 0 }, data: {}, selected: true };
    const b: Node = { id: 'b', type: 'shape', position: { x: 50, y: 0 }, data: {}, selected: false };
    const edge: Edge = { id: 'a-b', source: 'a', target: 'b' };
    useCanvasStore.setState({ nodes: [a, b], edges: [edge] });

    useCanvasStore.getState().duplicateSelection();
    const { nodes, edges } = useCanvasStore.getState();
    expect(nodes).toHaveLength(3); // a, b, + one clone of a
    expect(edges).toHaveLength(1); // no cloned edge (b wasn't selected)
  });
});

describe('canvas-store: z-order', () => {
  beforeEach(resetStore);

  it('bringToFront raises zIndex above the max; sendToBack lowers below the min', () => {
    useCanvasStore.setState({
      nodes: [
        { id: 'a', type: 'shape', position: { x: 0, y: 0 }, data: {}, zIndex: 0 },
        { id: 'b', type: 'shape', position: { x: 0, y: 0 }, data: {}, zIndex: 5 },
        { id: 'c', type: 'shape', position: { x: 0, y: 0 }, data: {}, zIndex: 2 },
      ],
    });

    useCanvasStore.getState().bringToFront(['a']);
    let nodes = useCanvasStore.getState().nodes;
    expect(nodes.find((n) => n.id === 'a')?.zIndex).toBe(6);

    useCanvasStore.getState().sendToBack(['b']);
    nodes = useCanvasStore.getState().nodes;
    expect(nodes.find((n) => n.id === 'b')?.zIndex).toBeLessThan(0);
  });
});

describe('canvas-store: syncOwnershipFractions (DA-H8 overlay)', () => {
  beforeEach(resetStore);

  function ownershipWithFractions(
    id: string,
    grant: string,
    remaining: string,
    relative: string
  ): Node {
    return {
      id,
      type: 'ownership',
      position: { x: 0, y: 0 },
      data: {
        nodeId: id,
        label: id,
        grantee: '',
        grantor: '',
        instrument: '',
        date: '',
        grantFraction: grant,
        remainingFraction: remaining,
        relativeShare: relative,
      },
    };
  }

  it('overlays current fractions onto placed ownership nodes', () => {
    useCanvasStore.setState({
      nodes: [ownershipWithFractions('n1', '0.5', '0.5', '0.5')],
    });
    useCanvasStore.getState().syncOwnershipFractions(
      new Map([['n1', { grantFraction: '0.25', remainingFraction: '0.1', relativeShare: '0.25' }]])
    );
    const data = useCanvasStore.getState().nodes[0].data as Record<string, unknown>;
    expect(data.grantFraction).toBe('0.25');
    expect(data.remainingFraction).toBe('0.1');
    expect(data.relativeShare).toBe('0.25');
    expect(data.stale).toBe(false);
  });

  it('flags a node whose workspace source was deleted as stale', () => {
    useCanvasStore.setState({
      nodes: [ownershipWithFractions('gone', '0.5', '0.5', '0.5')],
    });
    useCanvasStore.getState().syncOwnershipFractions(new Map());
    expect((useCanvasStore.getState().nodes[0].data as Record<string, unknown>).stale).toBe(true);
  });

  it('does not touch undo history (derived sync, not a user edit)', () => {
    useCanvasStore.setState({
      nodes: [ownershipWithFractions('n1', '0.5', '0.5', '0.5')],
      _past: [],
    });
    useCanvasStore.getState().syncOwnershipFractions(
      new Map([['n1', { grantFraction: '0.25', remainingFraction: '0.25', relativeShare: '0.25' }]])
    );
    expect(useCanvasStore.getState()._past).toHaveLength(0);
  });

  it('leaves non-ownership nodes untouched', () => {
    const shapeId = useCanvasStore.getState().addShapeNode('rect', { x: 0, y: 0 });
    useCanvasStore.getState().syncOwnershipFractions(new Map());
    const shape = useCanvasStore.getState().nodes.find((n) => n.id === shapeId)!;
    expect((shape.data as Record<string, unknown>).stale).toBeUndefined();
  });
});
