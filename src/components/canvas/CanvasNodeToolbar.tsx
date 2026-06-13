/**
 * Floating quick-action toolbar shown above a selected canvas node
 * (React Flow's NodeToolbar). Provides Miro-style actions: duplicate, z-order,
 * delete, and (for shapes) a small color palette.
 */
import { NodeToolbar, Position } from '@xyflow/react';
import { useCanvasStore } from '../../store/canvas-store';

const SHAPE_COLORS: { label: string; value: string; swatch: string }[] = [
  { label: 'Parchment', value: 'bg-parchment text-ink', swatch: '#faf3e8' },
  { label: 'Gold', value: 'bg-gold/20 text-ink', swatch: '#e9d8a6' },
  { label: 'Leather', value: 'bg-leather/15 text-ink', swatch: '#c8a27a' },
  { label: 'Seal', value: 'bg-seal/15 text-ink', swatch: '#d99' },
];

interface CanvasNodeToolbarProps {
  nodeId: string;
  isVisible: boolean;
  /** When true, show the shape color palette. */
  showColors?: boolean;
}

export default function CanvasNodeToolbar({
  nodeId,
  isVisible,
  showColors = false,
}: CanvasNodeToolbarProps) {
  const duplicateSelection = useCanvasStore((s) => s.duplicateSelection);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const removeElements = useCanvasStore((s) => s.removeElements);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const pushHistory = useCanvasStore((s) => s.pushHistory);

  const btn =
    'px-1.5 py-1 rounded text-xs text-ink-light hover:bg-parchment-dark transition-colors';

  return (
    <NodeToolbar isVisible={isVisible} position={Position.Top} offset={8}>
      <div className="flex items-center gap-0.5 rounded-md bg-parchment border border-ledger-line shadow-lg px-1 py-0.5">
        <button
          type="button"
          className={btn}
          title="Duplicate (Ctrl+D)"
          onClick={() => duplicateSelection()}
        >
          ⧉
        </button>
        <button
          type="button"
          className={btn}
          title="Bring to front (Ctrl+])"
          onClick={() => bringToFront([nodeId])}
        >
          ⤒
        </button>
        <button
          type="button"
          className={btn}
          title="Send to back (Ctrl+[)"
          onClick={() => sendToBack([nodeId])}
        >
          ⤓
        </button>

        {showColors && (
          <>
            <span className="w-px h-4 bg-ledger-line mx-0.5" />
            {SHAPE_COLORS.map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.label}
                aria-label={`Color ${c.label}`}
                onClick={() => {
                  pushHistory();
                  updateNodeData(nodeId, { color: c.value });
                }}
                className="w-4 h-4 rounded-sm border border-ledger-line"
                style={{ background: c.swatch }}
              />
            ))}
          </>
        )}

        <span className="w-px h-4 bg-ledger-line mx-0.5" />
        <button
          type="button"
          className={`${btn} !text-seal`}
          title="Delete (Del)"
          onClick={() => {
            pushHistory();
            removeElements([nodeId], []);
          }}
        >
          🗑
        </button>
      </div>
    </NodeToolbar>
  );
}
