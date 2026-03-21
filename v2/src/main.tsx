import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme/index.css';
import { useWorkspaceStore } from './store/workspace-store';
import { saveWorkspaceToDb, loadWorkspaceFromDb } from './storage/workspace-persistence';

// ── Auto-load saved workspace on startup ─────────────────
loadWorkspaceFromDb().then((data) => {
  if (data) {
    useWorkspaceStore.getState().loadWorkspace(data);
  } else {
    useWorkspaceStore.getState().setHydrated();
  }
});

// ── Auto-save on changes (debounced 2s) ──────────────────
// Only save when data-relevant fields change, not UI-only state (activeNodeId, lastAudit, lastError).
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let prevSnapshot: string | null = null;

useWorkspaceStore.subscribe((state) => {
  if (!state._hydrated) return;
  const snapshot = JSON.stringify({
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
      projectName: state.projectName,
      nodes: state.nodes,
      deskMaps: state.deskMaps,
      activeDeskMapId: state.activeDeskMapId,
      instrumentTypes: state.instrumentTypes,
    });
  }, 2000);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
