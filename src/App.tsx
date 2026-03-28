/**
 * Root application component — switches between views.
 */
import { Suspense, lazy } from 'react';
import { useUIStore } from './store/ui-store';
import Navbar from './components/shared/Navbar';
import DeskMapView from './views/DeskMapView';
import RunsheetView from './views/RunsheetView';

const FlowchartView = lazy(() => import('./views/FlowchartView'));

function PlaceholderView({
  name,
  description = 'Phase 3 — coming next',
}: {
  name: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-display font-bold text-ink">{name}</h2>
        <p className="text-ink-light">{description}</p>
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
        {view === 'flowchart' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Flowchart"
                description="Preparing the flowchart workspace."
              />
            }
          >
            <FlowchartView />
          </Suspense>
        )}
        {view === 'chart' && <DeskMapView />}
        {view === 'master' && <RunsheetView />}
        {view === 'research' && <PlaceholderView name="Research Hub" />}
      </main>
    </div>
  );
}
