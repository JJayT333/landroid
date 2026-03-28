import { Position, getSmoothStepPath } from '@xyflow/react';
import { clampNodeScale } from '../../engine/flowchart-metrics';
import type { FlowEdgeData } from '../../types/flowchart';

interface OwnershipEdgeGeometryInput {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition?: Position;
  targetPosition?: Position;
  edgeData?: FlowEdgeData;
  strokeWidth?: number;
}

export interface OwnershipEdgeGeometry {
  path: string;
  strokeWidth: number;
  interactionWidth: number;
}

export function getOwnershipEdgeGeometry({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  edgeData,
  strokeWidth,
}: OwnershipEdgeGeometryInput): OwnershipEdgeGeometry {
  const edgeScale = clampNodeScale(edgeData?.edgeScale ?? 1);
  const isRelated = edgeData?.variant === 'related';
  const borderRadius = Math.max(2, (isRelated ? 8 : 12) * edgeScale);
  const offset = Math.max(3, (isRelated ? 8 : 16) * edgeScale);
  const resolvedStrokeWidth =
    typeof strokeWidth === 'number'
      ? strokeWidth
      : (isRelated ? 1 : 2) * edgeScale;

  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius,
    offset,
  });

  return {
    path,
    strokeWidth: resolvedStrokeWidth,
    interactionWidth: Math.max(8, 14 * edgeScale),
  };
}
