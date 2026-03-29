import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme/index.css';
import { useMapStore } from './store/map-store';
import { useOwnerStore } from './store/owner-store';
import { useWorkspaceStore } from './store/workspace-store';
import { useCanvasStore } from './store/canvas-store';
import { saveWorkspaceToDb, loadWorkspaceFromDb } from './storage/workspace-persistence';
import { saveCanvasToDb, loadCanvasFromDb } from './storage/canvas-persistence';

// ── Auto-load saved workspace on startup ─────────────────
async function bootstrapWorkspace() {
  const data = await loadWorkspaceFromDb();
  if (data) {
    useWorkspaceStore.getState().loadWorkspace(data);
    await Promise.all([
      useOwnerStore.getState().setWorkspace(data.workspaceId),
      useMapStore.getState().setWorkspace(data.workspaceId),
    ]);
    return;
  }

  useWorkspaceStore.getState().setHydrated();
  const workspaceId = useWorkspaceStore.getState().workspaceId;
  await Promise.all([
    useOwnerStore.getState().setWorkspace(workspaceId),
    useMapStore.getState().setWorkspace(workspaceId),
  ]);
}

void bootstrapWorkspace();

// ── Auto-load saved canvas on startup ────────────────────
loadCanvasFromDb().then((data) => {
  if (data) {
    useCanvasStore.getState().loadCanvas(data);
  } else {
    useCanvasStore.getState().setHydrated();
  }
});

// ── Auto-save workspace on changes (debounced 2s) ────────
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let prevSnapshot: string | null = null;

useWorkspaceStore.subscribe((state) => {
  if (!state._hydrated) return;
  const snapshot = JSON.stringify({
    workspaceId: state.workspaceId,
    projectName: state.projectName,
    nodes: state.nodes,
    deskMaps: state.deskMaps,
    activeDeskMapId: state.activeDeskMapId,
    instrumentTypes: state.instrumentTypes,
  });
  if (snapshot === prevSnapshot) return;
  prevSnapshot = snapshot;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveWorkspaceToDb({
      workspaceId: state.workspaceId,
      projectName: state.projectName,
      nodes: state.nodes,
      deskMaps: state.deskMaps,
      activeDeskMapId: state.activeDeskMapId,
      instrumentTypes: state.instrumentTypes,
    });
  }, 2000);
});

// ── Auto-save canvas on changes (debounced 2s) ───────────
let canvasSaveTimer: ReturnType<typeof setTimeout> | null = null;
let prevCanvasSnapshot: string | null = null;

useCanvasStore.subscribe((state) => {
  if (!state._hydrated) return;
  const snapshot = JSON.stringify({
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
    gridCols: state.gridCols,
    gridRows: state.gridRows,
    orientation: state.orientation,
    pageSize: state.pageSize,
    horizontalSpacingFactor: state.horizontalSpacingFactor,
    verticalSpacingFactor: state.verticalSpacingFactor,
    snapToGrid: state.snapToGrid,
    gridSize: state.gridSize,
  });
  if (snapshot === prevCanvasSnapshot) return;
  prevCanvasSnapshot = snapshot;

  if (canvasSaveTimer) clearTimeout(canvasSaveTimer);
  canvasSaveTimer = setTimeout(() => {
    saveCanvasToDb({
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
      gridCols: state.gridCols,
      gridRows: state.gridRows,
      orientation: state.orientation,
      pageSize: state.pageSize,
      horizontalSpacingFactor: state.horizontalSpacingFactor,
      verticalSpacingFactor: state.verticalSpacingFactor,
      snapToGrid: state.snapToGrid,
      gridSize: state.gridSize,
    });
  }, 2000);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
