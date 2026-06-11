/**
 * Root application component — switches between views.
 */
import { Suspense, lazy, useEffect, useState } from 'react';
import { useUIStore } from './store/ui-store';
import { useWorkspaceStore } from './store/workspace-store';
import { isWorkspaceReadOnly, useWriteLeaseStore } from './store/write-lease-store';
import { classifyUndoHotkey } from './utils/undo-hotkey';
import Sidebar from './components/shell/Sidebar';
import UndoRedoControls from './components/shell/UndoRedoControls';
import TitleLedgerStatusBanner from './components/shared/TitleLedgerStatusBanner';
import WriteLeaseBanner from './components/shared/WriteLeaseBanner';
import DeskMapView from './views/DeskMapView';
import ProjectPickerLanding from './components/workspace/ProjectPickerLanding';
import type { ViewMode } from './store/ui-store';

/**
 * Views that mount the Undo/Redo cluster inside their own chrome (Desk Map's
 * canvas next to Fit; Leasehold/Documents command headers). Every other view
 * gets the shell's floating cluster so undo/redo stays visible app-wide
 * (locked decision: always visible, never upper-left).
 */
const VIEWS_WITH_OWN_UNDO: ViewMode[] = ['chart', 'leasehold', 'documents'];

const FlowchartView = lazy(() => import('./views/FlowchartView'));
const LeaseholdView = lazy(() => import('./views/LeaseholdView'));
const RunsheetView = lazy(() => import('./views/RunsheetView'));
const DocumentsView = lazy(() => import('./views/DocumentsView'));
const OwnerDatabaseView = lazy(() => import('./views/OwnerDatabaseView'));
const CurativeView = lazy(() => import('./views/CurativeView'));
const MapsView = lazy(() => import('./views/MapsView'));
const PitchDeckView = lazy(() => import('./views/PitchDeckView'));
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
  const [projectPickerOpen, setProjectPickerOpen] = useState(true);

  // Global Cmd/Ctrl+Z → title undo, Cmd/Ctrl+Shift+Z (Ctrl+Y on Windows) →
  // redo. The classifier refuses editable targets so native text-field undo
  // always wins; read-only tabs no-op.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = classifyUndoHotkey(event);
      if (!action) return;
      if (isWorkspaceReadOnly(useWriteLeaseStore.getState().role)) return;
      event.preventDefault();
      const store = useWorkspaceStore.getState();
      void (action === 'undo'
        ? store.undoLastTitleMutation()
        : store.redoLastTitleMutation());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-parchment">
      <Sidebar onOpenProjectPicker={() => setProjectPickerOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <WriteLeaseBanner />
        <TitleLedgerStatusBanner />
        {startupWarning && (
          <div className="border-b border-tint-amber-line bg-tint-amber px-4 py-3 text-sm text-tint-amber-ink">
            <div className="mx-auto flex max-w-6xl items-start justify-between gap-4">
              <p className="leading-6">{startupWarning}</p>
              <button
                type="button"
                className="shrink-0 rounded-[7px] border border-line-strong px-2 py-1 text-xs font-semibold uppercase tracking-wide hover:bg-parchment-dark"
                onClick={() => setStartupWarning(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <main className="relative flex-1 overflow-hidden">
          {!VIEWS_WITH_OWN_UNDO.includes(view) && (
            <div className="absolute right-4 top-4 z-20">
              <UndoRedoControls />
            </div>
          )}
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
        {view === 'documents' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Documents"
                description="Preparing the document registry."
              />
            }
          >
            <DocumentsView />
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
        {view === 'pitch' && (
          <Suspense
            fallback={
              <PlaceholderView
                name="Loading Sales Deck"
                description="Preparing the LANDroid feature deck."
              />
            }
          >
            <PitchDeckView />
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
      </div>
      <ProjectPickerLanding
        open={projectPickerOpen}
        onClose={() => setProjectPickerOpen(false)}
      />
      <Suspense fallback={null}>
        <AIToggleButton />
      </Suspense>
    </div>
  );
}
