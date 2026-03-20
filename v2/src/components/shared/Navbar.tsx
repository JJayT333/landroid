/**
 * Top navigation bar — view switcher + workspace name.
 */
import { useUIStore, type ViewMode } from '../../store/ui-store';
import { useWorkspaceStore } from '../../store/workspace-store';

const views: { id: ViewMode; label: string }[] = [
  { id: 'chart', label: 'Desk Map' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'master', label: 'Runsheet' },
  { id: 'research', label: 'Research' },
];

export default function Navbar() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const projectName = useWorkspaceStore((s) => s.projectName);

  return (
    <nav className="no-print flex items-center justify-between px-4 py-2 bg-ink text-parchment border-b border-leather">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-display font-bold tracking-wide">LANDroid</h1>
        <span className="text-sm text-parchment/60 font-mono">{projectName}</span>
      </div>

      <div className="flex gap-1">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`
              px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${view === v.id
                ? 'bg-leather text-parchment'
                : 'text-parchment/70 hover:text-parchment hover:bg-ink-light/30'}
            `}
          >
            {v.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
