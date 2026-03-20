/**
 * Toolbar for the flowchart canvas — tool selection, import, page grid, print.
 */
import type { FlowTool } from '../../types/flowchart';
import type { PageOrientation } from './PageGrid';

interface CanvasToolbarProps {
  activeTool: FlowTool;
  onToolChange: (tool: FlowTool) => void;
  onImportTree: () => void;
  onClear: () => void;
  // Page grid
  gridCols: number;
  gridRows: number;
  orientation: PageOrientation;
  onGridColsChange: (cols: number) => void;
  onGridRowsChange: (rows: number) => void;
  onOrientationChange: (orientation: PageOrientation) => void;
  onFitToGrid: () => void;
  onSelectAll: () => void;
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
  activeTool,
  onToolChange,
  onImportTree,
  onClear,
  gridCols,
  gridRows,
  orientation,
  onGridColsChange,
  onGridRowsChange,
  onOrientationChange,
  onFitToGrid,
  onSelectAll,
  onPrint,
}: CanvasToolbarProps) {
  return (
    <div className="no-print absolute top-3 left-3 z-10 flex items-center gap-1 rounded-xl bg-parchment/95 backdrop-blur border border-ledger-line shadow-lg px-2 py-1.5">
      {/* Drawing tools */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolChange(tool.id)}
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

      {/* Page grid controls */}
      <StepperButton
        label="Col"
        value={gridCols}
        min={1}
        max={26}
        onChange={onGridColsChange}
      />
      <StepperButton
        label="Row"
        value={gridRows}
        min={1}
        max={26}
        onChange={onGridRowsChange}
      />

      <button
        onClick={() =>
          onOrientationChange(
            orientation === 'landscape' ? 'portrait' : 'landscape'
          )
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
        onClick={onSelectAll}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-light hover:bg-parchment-dark transition-colors"
        title="Select all nodes (then drag to move entire tree)"
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
        onClick={onClear}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-seal hover:bg-seal/10 transition-colors"
        title="Clear all canvas nodes"
      >
        Clear
      </button>
    </div>
  );
}
