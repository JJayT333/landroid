/**
 * Root application component — switches between views.
 */
import { Suspense, lazy } from 'react';
import { useUIStore } from './store/ui-store';
import { useWorkspaceStore } from './store/workspace-store';
import Navbar from './components/shared/Navbar';
import DeskMapView from './views/DeskMapView';

const FlowchartView = lazy(() => import('./views/FlowchartView'));
const LeaseholdView = lazy(() => import('./views/LeaseholdView'));
const RunsheetView = lazy(() => import('./views/RunsheetView'));
const OwnerDatabaseView = lazy(() => import('./views/OwnerDatabaseView'));
const CurativeView = lazy(() => import('./views/CurativeView'));
const MapsView = lazy(() => import('./views/MapsView'));
const FederalLeasingView = lazy(() => import('./views/FederalLeasingView'));
const ResearchView = lazy(() => import('./views/ResearchView'));
const AIToggleButton = lazy(() => import('./ai/AIToggleButton'));

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
  const startupWarning = useWorkspaceStore((s) => s.startupWarning);
  const setStartupWarning = useWorkspaceStore((s) => s.setStartupWarning);

  return (
    <div className="h-screen flex flex-col bg-parchment">
      <Navbar />
      {startupWarning && (
        <div className="border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
          <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
            <p className="leading-6">{startupWarning}</p>
            <button
              type="button"
              className="shrink-0 rounded border border-amber-400 px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-amber-200"
              onClick={() => setStartupWarning(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
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
        {view === 'curative' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Curative"
                description="Preparing title issues and curative workflow."
              />
            }
          >
            <CurativeView />
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
        {view === 'federalLeasing' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Federal Leasing"
                description="Preparing federal lease tracking."
              />
            }
          >
            <FederalLeasingView />
          </Suspense>
        )}
        {view === 'research' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Research"
                description="Preparing sources, formulas, and project records."
              />
            }
          >
            <ResearchView />
          </Suspense>
        )}
      </main>
      <Suspense fallback={null}>
        <AIToggleButton />
      </Suspense>
    </div>
  );
}
