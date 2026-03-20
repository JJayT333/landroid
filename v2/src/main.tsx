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
  }
});

// ── Auto-save on changes (debounced 2s) ──────────────────
let saveTimer: ReturnType<typeof setTimeout> | null = null;

useWorkspaceStore.subscribe((state) => {
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
