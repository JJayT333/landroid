/**
 * Custom React Flow node for freeform shapes (rect, ellipse, diamond, note).
 */
import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ShapeNodeData } from '../../types/flowchart';

function ShapeNodeComponent({ data, selected }: NodeProps & { data: ShapeNodeData }) {
  const shapeData = data as ShapeNodeData;
  const { shapeType, text, width, height, fontSize, textAlign, color } = shapeData;

  const baseStyle = `
    flex items-center justify-center p-3
    border-2 transition-shadow
    ${selected ? 'border-leather shadow-lg ring-2 ring-gold/50' : 'border-ledger-line'}
    ${color || 'bg-parchment text-ink'}
  `;

  const shapeClass = (() => {
    switch (shapeType) {
      case 'ellipse': return `${baseStyle} rounded-full`;
      case 'roundRect': return `${baseStyle} rounded-2xl`;
      case 'diamond': return `${baseStyle} rotate-45`;
      case 'note': return `${baseStyle} rounded-sm border-l-4 border-l-gold bg-ledger`;
      default: return `${baseStyle} rounded-md`;
    }
  })();

  return (
    <div style={{ width, height }} className="relative">
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={40}
        lineClassName="!border-leather"
        handleClassName="!bg-leather !w-2 !h-2"
      />
      <Handle type="target" position={Position.Top} className="!bg-leather !w-2 !h-2" />

      <div className={shapeClass} style={{ width: '100%', height: '100%' }}>
        <span
          className={shapeType === 'diamond' ? '-rotate-45' : ''}
          style={{ fontSize, textAlign }}
        >
          {text}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-leather !w-2 !h-2" />
    </div>
  );
}

export default memo(ShapeNodeComponent);
