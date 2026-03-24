import { describe, expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import { getOwnershipEdgeGeometry } from '../ownership-edge-geometry';

describe('getOwnershipEdgeGeometry', () => {
  it('uses default primary edge metrics', () => {
    const geometry = getOwnershipEdgeGeometry({
      sourceX: 100,
      sourceY: 120,
      targetX: 220,
      targetY: 260,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    expect(geometry.path).toContain('M');
    expect(geometry.strokeWidth).toBe(2);
    expect(geometry.interactionWidth).toBe(14);
  });

  it('shrinks related edges with the supplied scale', () => {
    const geometry = getOwnershipEdgeGeometry({
      sourceX: 100,
      sourceY: 120,
      targetX: 220,
      targetY: 260,
      edgeData: { edgeScale: 0.5, variant: 'related' },
    });

    expect(geometry.strokeWidth).toBe(0.5);
    expect(geometry.interactionWidth).toBe(8);
  });

  it('changes the routed path when edge geometry changes', () => {
    const primary = getOwnershipEdgeGeometry({
      sourceX: 100,
      sourceY: 120,
      targetX: 220,
      targetY: 260,
      edgeData: { edgeScale: 1, variant: 'primary' },
    });
    const related = getOwnershipEdgeGeometry({
      sourceX: 100,
      sourceY: 120,
      targetX: 220,
      targetY: 260,
      edgeData: { edgeScale: 0.5, variant: 'related' },
    });

    expect(primary.path).not.toBe(related.path);
  });
});
