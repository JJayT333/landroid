/**
 * Toolbar for the flowchart canvas — tool selection, import, print.
 */
import type { FlowTool } from '../../types/flowchart';

interface CanvasToolbarProps {
  activeTool: FlowTool;
  onToolChange: (tool: FlowTool) => void;
  onImportTree: () => void;
  onImportCSV: () => void;
  onClear: () => void;
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

export default function CanvasToolbar({ activeTool, onToolChange, onImportTree, onImportCSV, onClear }: CanvasToolbarProps) {
  return (
    <div className="no-print absolute top-3 left-3 z-10 flex items-center gap-1 rounded-xl bg-parchment/95 backdrop-blur border border-ledger-line shadow-lg px-2 py-1.5">
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

      <button
        onClick={onImportCSV}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
        title="Import CSV file"
      >
        Import CSV
      </button>
      <button
        onClick={onImportTree}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-ink-light hover:bg-parchment-dark transition-colors"
        title="Re-layout current tree on canvas"
      >
        Re-layout
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
