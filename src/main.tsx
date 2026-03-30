import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme/index.css';
import { useMapStore } from './store/map-store';
import { useOwnerStore } from './store/owner-store';
import { useResearchStore } from './store/research-store';
import { useWorkspaceStore } from './store/workspace-store';
import { useCanvasStore } from './store/canvas-store';
import { saveWorkspaceToDb, loadWorkspaceFromDb } from './storage/workspace-persistence';
import { saveCanvasToDb, loadCanvasFromDb } from './storage/canvas-persistence';
import {
  buildCanvasAutosavePayload,
  buildWorkspaceAutosavePayload,
  canvasAutosaveStateChanged,
  captureCanvasAutosaveSnapshot,
  captureWorkspaceAutosaveSnapshot,
  workspaceAutosaveStateChanged,
} from './storage/autosave-change-detection';

// ── Auto-load saved workspace on startup ─────────────────
async function bootstrapWorkspace() {
  const data = await loadWorkspaceFromDb();
  if (data) {
    useWorkspaceStore.getState().loadWorkspace(data);
    await Promise.all([
      useOwnerStore.getState().setWorkspace(data.workspaceId),
      useMapStore.getState().setWorkspace(data.workspaceId),
      useResearchStore.getState().setWorkspace(data.workspaceId),
    ]);
    return;
  }

  useWorkspaceStore.getState().setHydrated();
  const workspaceId = useWorkspaceStore.getState().workspaceId;
  await Promise.all([
    useOwnerStore.getState().setWorkspace(workspaceId),
    useMapStore.getState().setWorkspace(workspaceId),
    useResearchStore.getState().setWorkspace(workspaceId),
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
let prevWorkspaceSnapshot: ReturnType<typeof captureWorkspaceAutosaveSnapshot> | null = null;

useWorkspaceStore.subscribe((state) => {
  if (!state._hydrated) return;
  if (!prevWorkspaceSnapshot) {
    prevWorkspaceSnapshot = captureWorkspaceAutosaveSnapshot(state);
    return;
  }
  if (!workspaceAutosaveStateChanged(prevWorkspaceSnapshot, state)) return;
  prevWorkspaceSnapshot = captureWorkspaceAutosaveSnapshot(state);

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveWorkspaceToDb(buildWorkspaceAutosavePayload(state));
  }, 2000);
});

// ── Auto-save canvas on changes (debounced 2s) ───────────
let canvasSaveTimer: ReturnType<typeof setTimeout> | null = null;
let prevCanvasSnapshot: ReturnType<typeof captureCanvasAutosaveSnapshot> | null = null;

useCanvasStore.subscribe((state) => {
  if (!state._hydrated) return;
  if (!prevCanvasSnapshot) {
    prevCanvasSnapshot = captureCanvasAutosaveSnapshot(state);
    return;
  }
  if (!canvasAutosaveStateChanged(prevCanvasSnapshot, state)) return;
  prevCanvasSnapshot = captureCanvasAutosaveSnapshot(state);

  if (canvasSaveTimer) clearTimeout(canvasSaveTimer);
  canvasSaveTimer = setTimeout(() => {
    saveCanvasToDb(buildCanvasAutosavePayload(state));
  }, 2000);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
