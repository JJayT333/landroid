import { describe, expect, it } from 'vitest';
import type { Connection, Edge, Node } from '@xyflow/react';
import {
  addCanvasEdge,
  applyCanvasEdgeChanges,
  applyCanvasNodeChanges,
} from '../canvas-change-utils';

function buildNode(id: string): Node {
  return {
    id,
    position: { x: 0, y: 0 },
    data: { label: id },
  };
}

function buildEdge(id: string): Edge {
  return {
    id,
    source: 'a',
    target: 'b',
  };
}

describe('canvas-change-utils', () => {
  it('applies node selection, position, and dimension changes', () => {
    const nodes = [buildNode('node-1')];

    const next = applyCanvasNodeChanges(
      [
        { id: 'node-1', type: 'select', selected: true },
        {
          id: 'node-1',
          type: 'position',
          position: { x: 40, y: 60 },
          dragging: true,
        },
        {
          id: 'node-1',
          type: 'dimensions',
          dimensions: { width: 180, height: 80 },
          setAttributes: true,
        },
      ],
      nodes
    );

    expect(next[0]).toMatchObject({
      selected: true,
      dragging: true,
      position: { x: 40, y: 60 },
      width: 180,
      height: 80,
      measured: { width: 180, height: 80 },
    });
  });

  it('applies edge add, select, replace, and remove changes', () => {
    const edges = [buildEdge('edge-1')];

    const next = applyCanvasEdgeChanges(
      [
        {
          type: 'add',
          item: {
            id: 'edge-2',
            source: 'b',
            target: 'c',
          },
        },
        { id: 'edge-1', type: 'select', selected: true },
        {
          id: 'edge-2',
          type: 'replace',
          item: {
            id: 'edge-2',
            source: 'b',
            target: 'd',
          },
        },
        { id: 'edge-1', type: 'remove' },
      ],
      edges
    );

    expect(next).toEqual([
      {
        id: 'edge-2',
        source: 'b',
        target: 'd',
      },
    ]);
  });

  it('adds a new connection edge once and ignores duplicates', () => {
    const connection: Connection = {
      source: 'source-1',
      sourceHandle: null,
      target: 'target-1',
      targetHandle: 'in',
    };

    const once = addCanvasEdge(connection, []);
    const twice = addCanvasEdge(connection, once);

    expect(once).toHaveLength(1);
    expect(once[0]).toMatchObject({
      id: 'edge-source-1-source-target-1-in',
      source: 'source-1',
      target: 'target-1',
      sourceHandle: null,
      targetHandle: 'in',
    });
    expect(twice).toHaveLength(1);
  });
});
