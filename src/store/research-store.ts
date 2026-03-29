import { create } from 'zustand';
import {
  deleteResearchImport,
  loadResearchWorkspaceData,
  replaceResearchWorkspaceData,
  saveResearchImport,
  type ResearchWorkspaceData,
} from '../storage/research-persistence';
import {
  normalizeResearchImport,
  type ResearchImport,
} from '../types/research';

function touch<T extends { updatedAt: string }>(record: T): T {
  return {
    ...record,
    updatedAt: new Date().toISOString(),
  };
}

interface ResearchState {
  workspaceId: string | null;
  imports: ResearchImport[];
  _hydrated: boolean;
  setWorkspace: (workspaceId: string) => Promise<void>;
  replaceWorkspaceData: (
    workspaceId: string,
    data: ResearchWorkspaceData
  ) => Promise<void>;
  exportWorkspaceData: () => Promise<ResearchWorkspaceData>;
  addImport: (researchImport: ResearchImport) => Promise<void>;
  updateImport: (id: string, fields: Partial<ResearchImport>) => Promise<void>;
  removeImport: (id: string) => Promise<void>;
}

export const useResearchStore = create<ResearchState>()((set, get) => ({
  workspaceId: null,
  imports: [],
  _hydrated: false,

  setWorkspace: async (workspaceId) => {
    const data = await loadResearchWorkspaceData(workspaceId);
    set({
      workspaceId,
      imports: data.imports,
      _hydrated: true,
    });
  },

  replaceWorkspaceData: async (workspaceId, data) => {
    await replaceResearchWorkspaceData(workspaceId, data);
    set({
      workspaceId,
      imports: data.imports.map((researchImport) =>
        normalizeResearchImport({ ...researchImport, workspaceId })
      ),
      _hydrated: true,
    });
  },

  exportWorkspaceData: async () => ({ imports: get().imports }),

  addImport: async (researchImport) => {
    const workspaceId = get().workspaceId ?? researchImport.workspaceId;
    const next = normalizeResearchImport({ ...researchImport, workspaceId });
    await saveResearchImport(next);
    set((state) => ({ imports: [next, ...state.imports] }));
  },

  updateImport: async (id, fields) => {
    const current = get().imports.find((researchImport) => researchImport.id === id);
    if (!current) return;
    const next = normalizeResearchImport(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
    );
    await saveResearchImport(next);
    set((state) => ({
      imports: state.imports.map((researchImport) =>
        researchImport.id === id ? next : researchImport
      ),
    }));
  },

  removeImport: async (id) => {
    await deleteResearchImport(id);
    set((state) => ({
      imports: state.imports.filter((researchImport) => researchImport.id !== id),
    }));
  },
}));
