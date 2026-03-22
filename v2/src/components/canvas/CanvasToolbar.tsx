/**
 * Toolbar for the flowchart canvas — tools, undo/redo, page grid, print.
 *
 * Reads tool/grid/snap state directly from canvas-store.
 * Callbacks for actions needing React Flow instance are passed as props.
 */
import { useCanvasStore } from '../../store/canvas-store';
import type { FlowTool } from '../../types/flowchart';

interface CanvasToolbarProps {
  onImportTree: () => void;
  onFitToGrid: () => void;
  onResize: () => void;
  resizeMode: boolean;
  onPrint: () => void;
}

const tools: { id: FlowTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pan', label: 'Pan', icon: '✋' },
  { id: 'connect', label: 'Connect', icon: '⤵' },
  { id: 'draw-rect', label: 'Rectangle', icon: '▭' },
  { id: 'draw-round', label: 'Rounded', icon: '▢' },
  { id: 'draw-ellipse', label: 'Ellipse', icon: '◯' },
  { id: 'draw-diamond', label: 'Diamond', icon: '◇' },
  { id: 'draw-note', label: 'Note', icon: '📝' },
];

function StepperButton({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[10px] text-ink-light uppercase tracking-wider mr-1">
        {label}
      </span>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-5 h-5 rounded text-xs font-bold text-ink-light hover:bg-parchment-dark disabled:opacity-30 transition-colors flex items-center justify-center"
      >
        -
      </button>
      <span className="text-xs font-mono font-semibold text-ink w-4 text-center">
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-5 h-5 rounded text-xs font-bold text-ink-light hover:bg-parchment-dark disabled:opacity-30 transition-colors flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

export default function CanvasToolbar({
  onImportTree,
  onFitToGrid,
  onResize,
  resizeMode,
  onPrint,
}: CanvasToolbarProps) {
  // Read from canvas store
  const activeTool = useCanvasStore((s) => s.activeTool);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const gridCols = useCanvasStore((s) => s.gridCols);
  const setGridCols = useCanvasStore((s) => s.setGridCols);
  const gridRows = useCanvasStore((s) => s.gridRows);
  const setGridRows = useCanvasStore((s) => s.setGridRows);
  const orientation = useCanvasStore((s) => s.orientation);
  const setOrientation = useCanvasStore((s) => s.setOrientation);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid);
  const selectAll = useCanvasStore((s) => s.selectAll);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s._past.length > 0);
  const canRedo = useCanvasStore((s) => s._future.length > 0);

  return (
    <div className="no-print absolute top-3 left-3 z-10 flex items-center gap-1 rounded-xl bg-parchment/95 backdrop-blur border border-ledger-line shadow-lg px-2 py-1.5">
      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={!canUndo}
        className="px-2 py-1.5 rounded-lg text-sm transition-colors text-ink-light hover:bg-parchment-dark disabled:opacity-30"
        title="Undo (Ctrl+Z)"
      >
        ↩
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className="px-2 py-1.5 rounded-lg text-sm transition-colors text-ink-light hover:bg-parchment-dark disabled:opacity-30"
        title="Redo (Ctrl+Shift+Z)"
      >
        ↪
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Drawing tools */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
          className={`
            px-2.5 py-1.5 rounded-lg text-sm transition-colors
            ${activeTool === tool.id
              ? 'bg-leather text-parchment font-semibold'
              : 'text-ink-light hover:bg-parchment-dark'}
          `}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Import / layout */}
      <button
        onClick={onImportTree}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
        title="Import active desk map to canvas"
      >
        Import Desk Map
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Snap toggle */}
      <button
        onClick={() => setSnapToGrid(!snapToGrid)}
        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          snapToGrid
            ? 'bg-leather/20 text-leather font-semibold'
            : 'text-ink-light hover:bg-parchment-dark'
        }`}
        title={`Snap to grid (${snapToGrid ? 'on' : 'off'})`}
      >
        ⊞
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Page grid controls */}
      <StepperButton
        label="Col"
        value={gridCols}
        min={1}
        max={26}
        onChange={setGridCols}
      />
      <StepperButton
        label="Row"
        value={gridRows}
        min={1}
        max={26}
        onChange={setGridRows}
      />

      <button
        onClick={() =>
          setOrientation(orientation === 'landscape' ? 'portrait' : 'landscape')
        }
        className="px-2 py-1.5 rounded-lg text-xs font-medium text-ink-light hover:bg-parchment-dark transition-colors"
        title={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'}`}
      >
        {orientation === 'landscape' ? '⬌' : '⬍'}
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Tree positioning */}
      <button
        onClick={onFitToGrid}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
        title="Scale tree to fit within page grid"
      >
        Fit to Grid
      </button>
      <button
        onClick={onResize}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          resizeMode
            ? 'bg-leather text-parchment'
            : 'text-leather hover:bg-leather/10'
        }`}
        title="Drag corners to resize all nodes and edges uniformly"
      >
        Resize All
      </button>
      <button
        onClick={selectAll}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-light hover:bg-parchment-dark transition-colors"
        title="Select all nodes (Ctrl+A)"
      >
        Select All
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Print */}
      <button
        onClick={onPrint}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
        title="Print flowchart pages"
      >
        Print
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      <button
        onClick={clearCanvas}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-seal hover:bg-seal/10 transition-colors"
        title="Clear all canvas nodes"
      >
        Clear
      </button>
    </div>
  );
}
