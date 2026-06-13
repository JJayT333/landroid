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
