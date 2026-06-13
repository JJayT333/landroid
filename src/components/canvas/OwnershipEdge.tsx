import { memo, useEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { getOwnershipEdgeGeometry } from './ownership-edge-geometry';
import { useCanvasStore } from '../../store/canvas-store';
import type { FlowEdgeData } from '../../types/flowchart';

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

  const data = props.data as FlowEdgeData | undefined;
  const label = data?.label ?? '';

  const updateEdgeData = useCanvasStore((s) => s.updateEdgeData);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  const labelX = (props.sourceX + props.targetX) / 2;
  const labelY = (props.sourceY + props.targetY) / 2;

  useEffect(() => {
    if (editing) {
      setDraft(label);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing, label]);

  const commit = () => {
    setEditing(false);
    if (draft !== label) {
      pushHistory();
      updateEdgeData(props.id, { label: draft });
    }
  };

  return (
    <>
      <BaseEdge
        {...props}
        path={geometry.path}
        style={{
          ...props.style,
          strokeWidth: geometry.strokeWidth,
        }}
        interactionWidth={geometry.interactionWidth}
      />
      {(label || editing || props.selected) && (
        <EdgeLabelRenderer>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                  setEditing(false);
                  setDraft(label);
                }
              }}
              className="nodrag nopan"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: 'all',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                padding: '1px 4px',
                border: '1px solid var(--color-leather)',
                borderRadius: 3,
                background: 'var(--color-parchment)',
                color: 'var(--color-ink)',
                width: 90,
              }}
            />
          ) : (
            <div
              onDoubleClick={() => setEditing(true)}
              className="nodrag nopan"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: 'all',
                cursor: 'text',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                padding: '1px 4px',
                border: '1px solid var(--color-ledger-line)',
                borderRadius: 3,
                background: 'var(--color-parchment)',
                color: label ? 'var(--color-ink)' : 'var(--color-ink-light)',
                opacity: label ? 1 : 0.7,
                whiteSpace: 'nowrap',
              }}
              title="Double-click to edit label"
            >
              {label || '＋ label'}
            </div>
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(OwnershipEdgeComponent);
