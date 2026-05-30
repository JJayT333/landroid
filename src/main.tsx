import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import RootErrorBoundary from './components/shared/RootErrorBoundary';
import { ConfirmationProvider } from './components/shared/ConfirmationProvider';
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
import { saveWorkspaceShardsToDb, loadWorkspaceFromDb } from './storage/workspace-persistence';
import { saveCanvasToDb, loadCanvasFromDb } from './storage/canvas-persistence';
import { awaitWorkspaceKeyReady } from './storage/active-workspace-key';
import { runPostV8BackupIfNeeded } from './storage/post-v8-backup';
import { runBackendSpineContractCheck } from './backend-spine/app-contract-check';
import {
  buildCanvasAutosavePayload,
  buildWorkspaceAutosavePayload,
  canvasAutosaveStateChanged,
  captureCanvasAutosaveSnapshot,
  captureWorkspaceAutosaveSnapshot,
  workspaceAutosaveStateChanged,
} from './storage/autosave-change-detection';
import { AUTOSAVE_DEBOUNCE_MS } from './storage/autosave-config';

// ── Auto-load saved workspace and canvas on startup ─────
async function bootstrapApp() {
  // Audit M-1: in hosted mode, the IndexedDB row key is namespaced by the
  // Cognito ID-token `sub`. AuthProvider populates it; bootstrap waits so
  // the first read uses the per-user key, not the legacy 'default' row.
  // In local mode awaitWorkspaceKeyReady resolves at module load.
  await awaitWorkspaceKeyReady();

  // Phase 5 / A5b: one-shot v7 `.landroid` backup the first time the user
  // boots into a v8 schema. The Dexie v7→v8 migration is non-destructive
  // (the v7 `pdfs` table is preserved), so reading it post-`db.open()` is
  // safe. Tracked via a localStorage flag so a refresh doesn't redownload.
  // Errors are warnings, never blocking.
  await runPostV8BackupIfNeeded().catch((err) => {
    console.warn('[landroid] post-v8 backup hook failed:', err);
  });

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
    // Phase 5: pull `node.attachments[]` from Dexie's `documents` +
    // `document_attachments` tables after the workspace state lands.
    // Safe to fail; the rest of the workspace still renders.
    await useWorkspaceStore.getState().hydrateNodeAttachments().catch(() => {});
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
  if (workspaceResult.warning) {
    startupWarnings.push(workspaceResult.warning);
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

  if (!isHostedMode()) {
    void runBackendSpineContractCheck({ logger: console });
  }
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
    void saveWorkspaceShardsToDb(buildWorkspaceAutosavePayload(state));
  }, AUTOSAVE_DEBOUNCE_MS);
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
  }, AUTOSAVE_DEBOUNCE_MS);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      {isHostedMode() ? (
        <AuthProvider>
          <LoginGate>
            <ConfirmationProvider>
              <App />
            </ConfirmationProvider>
          </LoginGate>
        </AuthProvider>
      ) : (
        <ConfirmationProvider>
          <App />
        </ConfirmationProvider>
      )}
    </RootErrorBoundary>
  </StrictMode>
);
