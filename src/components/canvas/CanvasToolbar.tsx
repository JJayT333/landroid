/**
 * Toolbar for the flowchart canvas — tools, undo/redo, page grid, print.
 *
 * Reads tool/grid/snap state directly from canvas-store.
 * Callbacks for actions needing React Flow instance are passed as props.
 */
import { PAGE_SIZE_DEFINITIONS, getPageSizeOptionLabel } from '../../engine/flowchart-pages';
import {
  MAX_TREE_SPACING_FACTOR,
  MIN_TREE_SPACING_FACTOR,
  TREE_SPACING_STEP,
} from '../../engine/flowchart-metrics';
import { useCanvasStore } from '../../store/canvas-store';
import type { FlowTool } from '../../types/flowchart';
import { useConfirmation } from '../shared/ConfirmationProvider';

interface CanvasToolbarProps {
  onImportTree: () => void;
  onFitToGrid: () => void;
  onResize: () => void;
  onHorizontalSpacingChange: (value: number) => void;
  onVerticalSpacingChange: (value: number) => void;
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
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
        className="w-5 h-5 rounded text-xs font-bold text-ink-light hover:bg-parchment-dark disabled:opacity-30 transition-colors flex items-center justify-center"
      >
        -
      </button>
      <span className="text-xs font-mono font-semibold text-ink w-4 text-center">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
        className="w-5 h-5 rounded text-xs font-bold text-ink-light hover:bg-parchment-dark disabled:opacity-30 transition-colors flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

function FactorStepperButton({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const decimals = 2;
  const decreaseValue = Number(Math.max(min, value - step).toFixed(decimals));
  const increaseValue = Number(Math.min(max, value + step).toFixed(decimals));

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[10px] text-ink-light uppercase tracking-wider mr-1">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(decreaseValue)}
        disabled={value <= min}
        aria-label={`Decrease ${label.toLowerCase()} spacing`}
        className="w-5 h-5 rounded text-xs font-bold text-ink-light hover:bg-parchment-dark disabled:opacity-30 transition-colors flex items-center justify-center"
        title={`Decrease ${label.toLowerCase()} spacing`}
      >
        -
      </button>
      <span className="text-xs font-mono font-semibold text-ink w-10 text-center">
        {value.toFixed(decimals)}x
      </span>
      <button
        type="button"
        onClick={() => onChange(increaseValue)}
        disabled={value >= max}
        aria-label={`Increase ${label.toLowerCase()} spacing`}
        className="w-5 h-5 rounded text-xs font-bold text-ink-light hover:bg-parchment-dark disabled:opacity-30 transition-colors flex items-center justify-center"
        title={`Increase ${label.toLowerCase()} spacing`}
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
  onHorizontalSpacingChange,
  onVerticalSpacingChange,
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
  const pageSize = useCanvasStore((s) => s.pageSize);
  const setPageSize = useCanvasStore((s) => s.setPageSize);
  const setOrientation = useCanvasStore((s) => s.setOrientation);
  const horizontalSpacingFactor = useCanvasStore((s) => s.horizontalSpacingFactor);
  const verticalSpacingFactor = useCanvasStore((s) => s.verticalSpacingFactor);
  const snapToGrid = useCanvasStore((s) => s.snapToGrid);
  const setSnapToGrid = useCanvasStore((s) => s.setSnapToGrid);
  const selectAll = useCanvasStore((s) => s.selectAll);
  const clearCanvas = useCanvasStore((s) => s.clearCanvas);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s._past.length > 0);
  const canRedo = useCanvasStore((s) => s._future.length > 0);
  const { confirm: requestConfirmation } = useConfirmation();

  const handleClearCanvas = async () => {
    const confirmed = await requestConfirmation({
      title: 'Clear Flowchart Canvas?',
      message:
        'This removes all nodes and edges from the flowchart canvas. Desk Map title data stays in the workspace.',
      confirmLabel: 'Clear Canvas',
      tone: 'danger',
    });
    if (confirmed) clearCanvas();
  };

  return (
    <div className="no-print absolute top-3 left-3 z-10 flex items-center gap-1 rounded-md bg-parchment/95 backdrop-blur border border-ledger-line shadow-lg px-2 py-1.5">
      {/* Undo / Redo */}
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        className="px-2 py-1.5 rounded-md text-sm transition-colors text-ink-light hover:bg-parchment-dark disabled:opacity-30"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        ↩
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        className="px-2 py-1.5 rounded-md text-sm transition-colors text-ink-light hover:bg-parchment-dark disabled:opacity-30"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
      >
        ↪
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Drawing tools */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          type="button"
          onClick={() => setActiveTool(tool.id)}
          aria-label={tool.label}
          aria-pressed={activeTool === tool.id}
          className={`
            px-2.5 py-1.5 rounded-md text-sm transition-colors
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
        type="button"
        onClick={onImportTree}
        className="px-3 py-1.5 rounded-md text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
        title="Import active desk map to canvas"
      >
        Import Desk Map
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Snap toggle */}
      <button
        type="button"
        onClick={() => setSnapToGrid(!snapToGrid)}
        aria-label="Snap to grid"
        aria-pressed={snapToGrid}
        className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
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
      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-light">
        <span>Paper</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(e.target.value as typeof pageSize)}
          className="rounded-md border border-ledger-line bg-parchment px-2 py-1 text-[11px] font-medium text-ink outline-none"
          title="Canvas paper size"
        >
          {PAGE_SIZE_DEFINITIONS.map((definition) => (
            <option key={definition.id} value={definition.id}>
              {getPageSizeOptionLabel(definition.id)}
            </option>
          ))}
        </select>
      </label>
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
        type="button"
        onClick={() =>
          setOrientation(orientation === 'landscape' ? 'portrait' : 'landscape')
        }
        aria-label={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'}`}
        className="px-2 py-1.5 rounded-md text-xs font-medium text-ink-light hover:bg-parchment-dark transition-colors"
        title={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'}`}
      >
        {orientation === 'landscape' ? '⬌' : '⬍'}
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Tree positioning */}
      <FactorStepperButton
        label="H"
        value={horizontalSpacingFactor}
        min={MIN_TREE_SPACING_FACTOR}
        max={MAX_TREE_SPACING_FACTOR}
        step={TREE_SPACING_STEP}
        onChange={onHorizontalSpacingChange}
      />
      <FactorStepperButton
        label="V"
        value={verticalSpacingFactor}
        min={MIN_TREE_SPACING_FACTOR}
        max={MAX_TREE_SPACING_FACTOR}
        step={TREE_SPACING_STEP}
        onChange={onVerticalSpacingChange}
      />
      <button
        type="button"
        onClick={onFitToGrid}
        className="px-3 py-1.5 rounded-md text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
        title="Scale tree to fit within page grid"
      >
        Fit to Grid
      </button>
      <button
        type="button"
        onClick={onResize}
        aria-pressed={resizeMode}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
          resizeMode
            ? 'bg-leather text-parchment'
            : 'text-leather hover:bg-leather/10'
        }`}
        title="Drag corners to resize all nodes and edges uniformly"
      >
        Resize All
      </button>
      <button
        type="button"
        onClick={selectAll}
        className="px-3 py-1.5 rounded-md text-xs font-medium text-ink-light hover:bg-parchment-dark transition-colors"
        title="Select all nodes (Ctrl+A)"
      >
        Select All
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      {/* Print */}
      <button
        type="button"
        onClick={onPrint}
        className="px-3 py-1.5 rounded-md text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
        title="Print flowchart pages"
      >
        Print
      </button>

      <div className="w-px h-6 bg-ledger-line mx-1" />

      <button
        type="button"
        onClick={() => void handleClearCanvas()}
        className="px-3 py-1.5 rounded-md text-xs font-medium text-seal hover:bg-seal/10 transition-colors"
        title="Clear all canvas nodes"
      >
        Clear
      </button>
    </div>
  );
}
