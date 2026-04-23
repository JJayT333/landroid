import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import RootErrorBoundary from './components/shared/RootErrorBoundary';
import { AuthProvider } from './auth/AuthProvider';
import LoginGate from './auth/LoginGate';
import { isHostedMode } from './utils/deploy-env';
import './theme/index.css';
import { useMapStore } from './store/map-store';
import { useOwnerStore } from './store/owner-store';
import { useResearchStore } from './store/research-store';
import { useCurativeStore } from './store/curative-store';
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

// ── Auto-load saved workspace and canvas on startup ─────
async function bootstrapApp() {
  const [workspaceResult, canvasResult] = await Promise.all([
    loadWorkspaceFromDb(),
    loadCanvasFromDb(),
  ]);
  const startupWarnings: string[] = [];

  if (workspaceResult.status === 'loaded' && workspaceResult.data) {
    useWorkspaceStore.getState().loadWorkspace(workspaceResult.data);
    await Promise.all([
      useOwnerStore.getState().setWorkspace(workspaceResult.data.workspaceId),
      useMapStore.getState().setWorkspace(workspaceResult.data.workspaceId),
      useResearchStore.getState().setWorkspace(workspaceResult.data.workspaceId),
      useCurativeStore.getState().setWorkspace(workspaceResult.data.workspaceId),
    ]);
  } else {
    useWorkspaceStore.getState().setHydrated();
    const workspaceId = useWorkspaceStore.getState().workspaceId;
    await Promise.all([
      useOwnerStore.getState().setWorkspace(workspaceId),
      useMapStore.getState().setWorkspace(workspaceId),
      useResearchStore.getState().setWorkspace(workspaceId),
      useCurativeStore.getState().setWorkspace(workspaceId),
    ]);
  }

  if (workspaceResult.status === 'corrupt' && workspaceResult.error) {
    startupWarnings.push(workspaceResult.error);
  }

  if (canvasResult.status === 'loaded' && canvasResult.data) {
    useCanvasStore.getState().loadCanvas(canvasResult.data);
  } else {
    useCanvasStore.getState().setHydrated();
  }

  if (canvasResult.status === 'corrupt' && canvasResult.error) {
    startupWarnings.push(canvasResult.error);
  }

  useWorkspaceStore.getState().setStartupWarning(
    startupWarnings.length > 0 ? startupWarnings.join(' ') : null
  );
}

void bootstrapApp();

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
    <RootErrorBoundary>
      {isHostedMode() ? (
        <AuthProvider>
          <LoginGate>
            <App />
          </LoginGate>
        </AuthProvider>
      ) : (
        <App />
      )}
    </RootErrorBoundary>
  </StrictMode>
);
