/**
 * Root application component — switches between views.
 */
import { Suspense, lazy } from 'react';
import { useUIStore } from './store/ui-store';
import Navbar from './components/shared/Navbar';
import DeskMapView from './views/DeskMapView';

const FlowchartView = lazy(() => import('./views/FlowchartView'));
const LeaseholdView = lazy(() => import('./views/LeaseholdView'));
const RunsheetView = lazy(() => import('./views/RunsheetView'));
const OwnerDatabaseView = lazy(() => import('./views/OwnerDatabaseView'));
const MapsView = lazy(() => import('./views/MapsView'));
const ResearchView = lazy(() => import('./views/ResearchView'));

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
        {view === 'leasehold' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Leasehold"
                description="Preparing acreage and leasehold calculations."
              />
            }
          >
            <LeaseholdView />
          </Suspense>
        )}
        {view === 'master' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Runsheet"
                description="Preparing the runsheet workspace."
              />
            }
          >
            <RunsheetView />
          </Suspense>
        )}
        {view === 'owners' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Owners"
                description="Preparing the owner workspace."
              />
            }
          >
            <OwnerDatabaseView />
          </Suspense>
        )}
        {view === 'maps' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Maps"
                description="Preparing the map workspace."
              />
            }
          >
            <MapsView />
          </Suspense>
        )}
        {view === 'research' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Research"
                description="Preparing RRC datasets and imported research files."
              />
            }
          >
            <ResearchView />
          </Suspense>
        )}
      </main>
    </div>
  );
}
