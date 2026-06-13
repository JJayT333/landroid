/**
 * Custom React Flow node for freeform shapes (rect, ellipse, diamond, note).
 *
 * Double-click to edit the label inline; the NodeResizer handles persist the
 * new width/height through the store's dimension-change path.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ShapeNodeData } from '../../types/flowchart';
import { useCanvasStore } from '../../store/canvas-store';
import CanvasNodeToolbar from './CanvasNodeToolbar';

function ShapeNodeComponent({ id, data, selected, width, height }: NodeProps & { data: ShapeNodeData }) {
  const shapeData = data as ShapeNodeData;
  const { shapeType, text, fontSize, textAlign, color } = shapeData;
  // NodeResizer drives node.width/height; fall back to the initial data size.
  const w = typeof width === 'number' ? width : shapeData.width;
  const h = typeof height === 'number' ? height : shapeData.height;

  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(text);
      // Focus on the next frame so the textarea is mounted.
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      });
    }
  }, [editing, text]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== text) {
      pushHistory();
      updateNodeData(id, { text: draft });
    }
  }, [draft, text, id, pushHistory, updateNodeData]);

  const handleDoubleClick = useCallback(() => setEditing(true), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditing(false);
        setDraft(text);
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    },
    [commit, text]
  );

  const baseStyle = `
    flex items-center justify-center p-3
    border-2 transition-shadow
    ${selected ? 'border-leather shadow-lg ring-2 ring-gold/50' : 'border-ledger-line'}
    ${color || 'bg-parchment text-ink'}
  `;

  const shapeClass = (() => {
    switch (shapeType) {
      case 'ellipse': return `${baseStyle} rounded-full`;
      case 'roundRect': return `${baseStyle} rounded-md`;
      case 'diamond': return `${baseStyle} rotate-45`;
      case 'note': return `${baseStyle} rounded-sm border-l-4 border-l-gold bg-ledger`;
      default: return `${baseStyle} rounded-md`;
    }
  })();

  return (
    <div style={{ width: w, height: h }} className="relative" onDoubleClick={handleDoubleClick}>
      <CanvasNodeToolbar nodeId={id} isVisible={!!selected && !editing} showColors />
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={40}
        lineClassName="!border-leather"
        handleClassName="!bg-leather !w-2 !h-2"
      />
      <Handle type="target" position={Position.Top} className="!bg-leather !w-2 !h-2" />

      <div className={shapeClass} style={{ width: '100%', height: '100%' }}>
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={`w-full h-full resize-none bg-transparent outline-none ${
              shapeType === 'diamond' ? '-rotate-45' : ''
            }`}
            style={{ fontSize, textAlign }}
            // Stop React Flow from treating typing as canvas drag/pan input.
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={shapeType === 'diamond' ? '-rotate-45' : ''}
            style={{ fontSize, textAlign, whiteSpace: 'pre-wrap' }}
          >
            {text}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-leather !w-2 !h-2" />
    </div>
  );
}

export default memo(ShapeNodeComponent);
