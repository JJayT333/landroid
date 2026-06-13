/**
 * Frame / section container — a titled rectangular region used to group and
 * label parts of the diagram (Miro-style frames). Purely visual: it renders
 * behind other nodes and does not reparent content. Double-click the title to
 * rename; drag the corner (NodeResizer) to resize.
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FrameNodeData } from '../../types/flowchart';
import { useCanvasStore } from '../../store/canvas-store';
import CanvasNodeToolbar from './CanvasNodeToolbar';

function FrameNodeComponent({ id, data, selected }: NodeProps & { data: FrameNodeData }) {
  const frameData = data as FrameNodeData;
  const { title, width, height } = frameData;

  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(title);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, title]);

  const commit = useCallback(() => {
    setEditing(false);
    if (draft !== title) {
      pushHistory();
      updateNodeData(id, { title: draft });
    }
  }, [draft, title, id, pushHistory, updateNodeData]);

  return (
    <div style={{ width, height }} className="relative">
      <CanvasNodeToolbar nodeId={id} isVisible={!!selected && !editing} />
      <NodeResizer
        isVisible={selected}
        minWidth={160}
        minHeight={120}
        lineClassName="!border-leather"
        handleClassName="!bg-leather !w-2 !h-2"
      />
      <div
        className={`w-full h-full rounded-md border-2 ${
          selected ? 'border-leather' : 'border-ledger-line'
        }`}
        style={{ background: 'rgba(201, 162, 39, 0.06)' }}
      >
        <div
          className="inline-flex items-center px-2 py-0.5 rounded-br-md bg-parchment-dark border-b border-r border-ledger-line text-xs font-semibold text-ink-light"
          onDoubleClick={() => setEditing(true)}
          style={{ cursor: 'text' }}
        >
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
                  setDraft(title);
                }
              }}
              className="nodrag nopan bg-transparent outline-none text-xs font-semibold"
              style={{ width: Math.max(60, draft.length * 7) }}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            title || 'Frame'
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(FrameNodeComponent);
