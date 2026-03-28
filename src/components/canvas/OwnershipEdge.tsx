import { memo } from 'react';
import { BaseEdge, type EdgeProps } from '@xyflow/react';
import { getOwnershipEdgeGeometry } from './ownership-edge-geometry';

function OwnershipEdgeComponent(props: EdgeProps) {
  const geometry = getOwnershipEdgeGeometry({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    edgeData: props.data,
    strokeWidth:
      typeof props.style?.strokeWidth === 'number'
        ? props.style.strokeWidth
        : undefined,
  });

  return (
    <BaseEdge
      {...props}
      path={geometry.path}
      style={{
        ...props.style,
        strokeWidth: geometry.strokeWidth,
      }}
      interactionWidth={geometry.interactionWidth}
    />
  );
}

export default memo(OwnershipEdgeComponent);
