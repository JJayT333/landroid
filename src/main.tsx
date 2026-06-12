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
import { openMostRecentSavedProject } from './app/project-workspace-lifecycle';
import { useStorageHealthStore } from './store/storage-health-store';
import {
  flushTitleActionLogToStorage,
  hydrateTitleActionLogFromStorageOrBaseline,
  setTitleCutoverArmed,
} from './store/title-action-log';

// DA-C1 exit, final step: the title read-flip governance is ARMED (operator
// decision, 2026-06-10, after the Springhill soak on the merged hardening).
// Arming only permits the flip — it still requires the readiness gates green
// plus the banner's explicit manual click, and revertReadPathToShadow stays
// available at all times. Disarm by deleting this call.
setTitleCutoverArmed(true);
import { saveWorkspaceShardsToDb, loadWorkspaceFromDb } from './storage/workspace-persistence';
import { saveCanvasToDb, loadCanvasFromDb } from './storage/canvas-persistence';
import {
  ensureWorkspaceWritable,
  initWorkspaceWriteLease,
  releaseWorkspaceWriteLease,
} from './storage/workspace-write-lease';
import { awaitWorkspaceKeyReady } from './storage/active-workspace-key';
import {
  estimateBrowserStorage,
  requestPersistentStorage,
} from './storage/persistent-storage';
import {
  initializeRollingAutoExport,
  scheduleRollingAutoExport,
} from './storage/rolling-auto-export-runtime';
import { backfillBlankDocumentContentHashes } from './storage/content-hash-backfill';
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

function readTitleOwnerData() {
  const owner = useOwnerStore.getState();
  return { owners: owner.owners, leases: owner.leases };
}

// ── Auto-load saved workspace and canvas on startup ─────
async function bootstrapApp() {
  // Audit M-1: in hosted mode, the IndexedDB row key is namespaced by the
  // Cognito ID-token `sub`. AuthProvider populates it; bootstrap waits so
  // the first read uses the per-user key, not the legacy 'default' row.
  // In local mode awaitWorkspaceKeyReady resolves at module load.
  await awaitWorkspaceKeyReady();

  // Phase 0.5: ask the browser to keep this origin's IndexedDB persistent so
  // it is not evicted under storage pressure (PWA / iPad durability). Fire and
  // forget — a refusal is recorded, never a reason to block local-first work.
  void requestPersistentStorage().then(async (result) => {
    useStorageHealthStore.getState().setPersistentStorageResult(result);
    const estimate = await estimateBrowserStorage();
    useStorageHealthStore.getState().setBrowserStorageEstimate(estimate);

    if (result.status === 'denied') {
      console.warn(
        '[landroid] Persistent storage was not granted; the browser may evict '
          + 'local data under storage pressure. Export a .landroid backup to keep '
          + 'a permanent copy.'
      );
    } else {
      console.info(`[landroid] Persistent storage: ${result.status}.`);
    }
  });

  // Phase 5 / A5b: one-shot v7 `.landroid` backup the first time the user
  // boots into a v8 schema. The Dexie v7→v8 migration is non-destructive
  // (the v7 `pdfs` table is preserved), so reading it post-`db.open()` is
  // safe. Tracked via a localStorage flag so a refresh doesn't redownload.
  // Errors are warnings, never blocking.
  await runPostV8BackupIfNeeded().catch((err) => {
    console.warn('[landroid] post-v8 backup hook failed:', err);
  });

  const startupWarnings: string[] = [];
  const savedProjectOpenResult = await openMostRecentSavedProject().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    startupWarnings.push(`Saved project restore failed: ${message}`);
    return null;
  });

  if (savedProjectOpenResult) {
    if (savedProjectOpenResult.warning) {
      startupWarnings.push(savedProjectOpenResult.warning);
    }
    useWorkspaceStore.getState().setStartupWarning(
      startupWarnings.length > 0 ? startupWarnings.join(' ') : null
    );
  } else {
    const [workspaceResult, canvasResult] = await Promise.all([
      loadWorkspaceFromDb(),
      loadCanvasFromDb(),
    ]);

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
      await hydrateTitleActionLogFromStorageOrBaseline(
        workspaceResult.data,
        readTitleOwnerData()
      ).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        startupWarnings.push(`Title ledger hydration failed: ${message}`);
      });
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
  }

  await initializeRollingAutoExport().catch((err) => {
    console.warn('[landroid] rolling auto-export initialization failed:', err);
  });
  void backfillBlankDocumentContentHashes().catch((err) => {
    console.warn('[landroid] document content-hash backfill failed:', err);
  });

  if (!isHostedMode()) {
    void runBackendSpineContractCheck({ logger: console });
  }
}

void bootstrapApp();

// ── Auto-save workspace on changes (debounced 2s) ────────
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let prevWorkspaceSnapshot: ReturnType<typeof captureWorkspaceAutosaveSnapshot> | null = null;
let workspaceSaveGeneration = 0;

useWorkspaceStore.subscribe((state) => {
  if (!state._hydrated) return;
  if (!prevWorkspaceSnapshot) {
    prevWorkspaceSnapshot = captureWorkspaceAutosaveSnapshot(state);
    return;
  }
  if (!workspaceAutosaveStateChanged(prevWorkspaceSnapshot, state)) return;
  prevWorkspaceSnapshot = captureWorkspaceAutosaveSnapshot(state);
  workspaceSaveGeneration += 1;

  if (saveTimer) clearTimeout(saveTimer);
  const saveGeneration = workspaceSaveGeneration;
  const payload = buildWorkspaceAutosavePayload(state);
  saveTimer = setTimeout(() => {
    void (async () => {
      const result = await saveWorkspaceShardsToDb(payload);
      if (result.status !== 'written') return;
      if (saveGeneration !== workspaceSaveGeneration) return;
      await flushTitleActionLogToStorage(payload.workspaceId);
      if (saveGeneration !== workspaceSaveGeneration) return;
      useStorageHealthStore.getState().recordWorkspaceSaved();
      scheduleRollingAutoExport();
    })().catch((err) => {
      console.warn('[landroid] title ledger autosave failed:', err);
    });
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
    // Canvas autosave shares the workspace's single-writer lease, so a
    // read-only tab cannot overwrite the active writer's viewport/layout.
    const workspaceId = useWorkspaceStore.getState().workspaceId;
    void ensureWorkspaceWritable(workspaceId).then(async (writable) => {
      if (!writable) return;
      await saveCanvasToDb(buildCanvasAutosavePayload(state), workspaceId);
      scheduleRollingAutoExport();
    });
  }, AUTOSAVE_DEBOUNCE_MS);
});

// ── Engage the single-writer lease for the active workspace ──
// Acquiring at load (and re-acquiring after a workspace swap) makes a second
// tab's read-only state known before the first edit, and releases the prior
// workspace's lease so a peer can claim it without waiting for expiry.
let leaseWorkspaceId: string | null = null;
useWorkspaceStore.subscribe((state) => {
  if (!state._hydrated) return;
  if (state.workspaceId === leaseWorkspaceId) return;
  const previous = leaseWorkspaceId;
  leaseWorkspaceId = state.workspaceId;
  if (previous) void releaseWorkspaceWriteLease(previous);
  void initWorkspaceWriteLease(state.workspaceId);
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
