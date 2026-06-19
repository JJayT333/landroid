/**
 * Whole-codebase audit (confirmed HIGH): Fit-to-Grid and the Resize overlay
 * scaled `data.width/height`, but ShapeNode / ImageNode / FrameNode (and the
 * print path) render from the TOP-LEVEL `node.width/height` — the live size
 * NodeResizer drives, which the store always sets. So scaling only `data.*`
 * left every shape/image/frame visually unchanged. This pins that the scale
 * helper now scales the dimensions the renderer actually reads.
 */
import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import { scaleNonOwnershipNodeSize } from '../FlowchartView';

function data(node: Node): Record<string, unknown> {
  return node.data as Record<string, unknown>;
}

describe('scaleNonOwnershipNodeSize', () => {
  it('scales the top-level node.width/height the renderer reads (plus data.*)', () => {
    const node = {
      id: 'shape-1',
      type: 'shape',
      position: { x: 10, y: 20 },
      width: 200,
      height: 100,
      data: { width: 120, height: 60, fontSize: 14, shapeType: 'rectangle' },
    } as unknown as Node;

    const scaled = scaleNonOwnershipNodeSize(node, 2);

    // The renderer reads node.width/height first — these MUST scale.
    expect(scaled.width).toBe(400);
    expect(scaled.height).toBe(200);
    // data.* (the fallback) stays consistent, and fontSize scales too.
    expect(data(scaled).width).toBe(240);
    expect(data(scaled).height).toBe(120);
    expect(data(scaled).fontSize).toBe(28);
    // Non-dimension data is preserved.
    expect(data(scaled).shapeType).toBe('rectangle');
  });

  it('leaves undefined dimensions untouched', () => {
    const node = {
      id: 'frame-1',
      type: 'frame',
      position: { x: 0, y: 0 },
      data: { label: 'Frame' },
    } as unknown as Node;

    const scaled = scaleNonOwnershipNodeSize(node, 3);

    expect(scaled.width).toBeUndefined();
    expect(scaled.height).toBeUndefined();
    expect(data(scaled).fontSize).toBeUndefined();
    expect(data(scaled).label).toBe('Frame');
  });
});
