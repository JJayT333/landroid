/**
 * Root application component — switches between views.
 */
import { useUIStore } from './store/ui-store';
import Navbar from './components/shared/Navbar';
import FlowchartView from './views/FlowchartView';

function PlaceholderView({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-display font-bold text-ink">{name}</h2>
        <p className="text-ink-light">Phase 3 — coming next</p>
      </div>
    </div>
  );
}

export default function App() {
  const view = useUIStore((s) => s.view);

  return (
    <div className="h-screen flex flex-col bg-parchment">
      <Navbar />
      <main className="flex-1 overflow-hidden">
        {view === 'flowchart' && <FlowchartView />}
        {view === 'chart' && <PlaceholderView name="Desk Map" />}
        {view === 'master' && <PlaceholderView name="Master Runsheet" />}
        {view === 'research' && <PlaceholderView name="Research Hub" />}
      </main>
    </div>
  );
}
