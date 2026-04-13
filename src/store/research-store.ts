import { create } from 'zustand';
import {
  deleteResearchFormula,
  deleteResearchImport,
  deleteResearchProjectRecord,
  deleteResearchQuestion,
  deleteResearchSource,
  loadResearchWorkspaceData,
  normalizeResearchWorkspaceData,
  replaceResearchWorkspaceData,
  saveResearchFormula,
  saveResearchImport,
  saveResearchProjectRecord,
  saveResearchQuestion,
  saveResearchSource,
  type ResearchWorkspaceData,
} from '../storage/research-persistence';
import {
  normalizeResearchFormula,
  normalizeResearchImport,
  normalizeResearchProjectRecord,
  normalizeResearchQuestion,
  normalizeResearchSource,
  type ResearchFormula,
  type ResearchImport,
  type ResearchProjectRecord,
  type ResearchQuestion,
  type ResearchSource,
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
  sources: ResearchSource[];
  formulas: ResearchFormula[];
  projectRecords: ResearchProjectRecord[];
  questions: ResearchQuestion[];
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
  addSource: (source: ResearchSource) => Promise<void>;
  updateSource: (id: string, fields: Partial<ResearchSource>) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  addFormula: (formula: ResearchFormula) => Promise<void>;
  updateFormula: (id: string, fields: Partial<ResearchFormula>) => Promise<void>;
  removeFormula: (id: string) => Promise<void>;
  addProjectRecord: (projectRecord: ResearchProjectRecord) => Promise<void>;
  updateProjectRecord: (
    id: string,
    fields: Partial<ResearchProjectRecord>
  ) => Promise<void>;
  removeProjectRecord: (id: string) => Promise<void>;
  addQuestion: (question: ResearchQuestion) => Promise<void>;
  updateQuestion: (id: string, fields: Partial<ResearchQuestion>) => Promise<void>;
  removeQuestion: (id: string) => Promise<void>;
}

export const useResearchStore = create<ResearchState>()((set, get) => ({
  workspaceId: null,
  imports: [],
  sources: [],
  formulas: [],
  projectRecords: [],
  questions: [],
  _hydrated: false,

  setWorkspace: async (workspaceId) => {
    const data = await loadResearchWorkspaceData(workspaceId);
    set({
      workspaceId,
      imports: data.imports,
      sources: data.sources,
      formulas: data.formulas,
      projectRecords: data.projectRecords,
      questions: data.questions,
      _hydrated: true,
    });
  },

  replaceWorkspaceData: async (workspaceId, data) => {
    const normalized = normalizeResearchWorkspaceData(workspaceId, data);
    await replaceResearchWorkspaceData(workspaceId, normalized);
    set({
      workspaceId,
      imports: normalized.imports,
      sources: normalized.sources,
      formulas: normalized.formulas,
      projectRecords: normalized.projectRecords,
      questions: normalized.questions,
      _hydrated: true,
    });
  },

  exportWorkspaceData: async () => {
    const state = get();
    return {
      imports: state.imports,
      sources: state.sources,
      formulas: state.formulas,
      projectRecords: state.projectRecords,
      questions: state.questions,
    };
  },

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

  addSource: async (source) => {
    const workspaceId = get().workspaceId ?? source.workspaceId;
    const next = normalizeResearchSource({ ...source, workspaceId });
    await saveResearchSource(next);
    set((state) => ({ sources: [next, ...state.sources] }));
  },

  updateSource: async (id, fields) => {
    const current = get().sources.find((source) => source.id === id);
    if (!current) return;
    const next = normalizeResearchSource(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
    );
    await saveResearchSource(next);
    set((state) => ({
      sources: state.sources.map((source) => (source.id === id ? next : source)),
    }));
  },

  removeSource: async (id) => {
    await deleteResearchSource(id);
    set((state) => ({
      sources: state.sources.filter((source) => source.id !== id),
    }));
  },

  addFormula: async (formula) => {
    const workspaceId = get().workspaceId ?? formula.workspaceId;
    const next = normalizeResearchFormula({ ...formula, workspaceId });
    await saveResearchFormula(next);
    set((state) => ({ formulas: [next, ...state.formulas] }));
  },

  updateFormula: async (id, fields) => {
    const current = get().formulas.find((formula) => formula.id === id);
    if (!current) return;
    const next = normalizeResearchFormula(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
    );
    await saveResearchFormula(next);
    set((state) => ({
      formulas: state.formulas.map((formula) =>
        formula.id === id ? next : formula
      ),
    }));
  },

  removeFormula: async (id) => {
    await deleteResearchFormula(id);
    set((state) => ({
      formulas: state.formulas.filter((formula) => formula.id !== id),
    }));
  },

  addProjectRecord: async (projectRecord) => {
    const workspaceId = get().workspaceId ?? projectRecord.workspaceId;
    const next = normalizeResearchProjectRecord({ ...projectRecord, workspaceId });
    await saveResearchProjectRecord(next);
    set((state) => ({ projectRecords: [next, ...state.projectRecords] }));
  },

  updateProjectRecord: async (id, fields) => {
    const current = get().projectRecords.find((projectRecord) => projectRecord.id === id);
    if (!current) return;
    const next = normalizeResearchProjectRecord(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
    );
    await saveResearchProjectRecord(next);
    set((state) => ({
      projectRecords: state.projectRecords.map((projectRecord) =>
        projectRecord.id === id ? next : projectRecord
      ),
    }));
  },

  removeProjectRecord: async (id) => {
    await deleteResearchProjectRecord(id);
    set((state) => ({
      projectRecords: state.projectRecords.filter(
        (projectRecord) => projectRecord.id !== id
      ),
    }));
  },

  addQuestion: async (question) => {
    const workspaceId = get().workspaceId ?? question.workspaceId;
    const next = normalizeResearchQuestion({ ...question, workspaceId });
    await saveResearchQuestion(next);
    set((state) => ({ questions: [next, ...state.questions] }));
  },

  updateQuestion: async (id, fields) => {
    const current = get().questions.find((question) => question.id === id);
    if (!current) return;
    const next = normalizeResearchQuestion(
      touch({ ...current, ...fields, workspaceId: current.workspaceId })
    );
    await saveResearchQuestion(next);
    set((state) => ({
      questions: state.questions.map((question) =>
        question.id === id ? next : question
      ),
    }));
  },

  removeQuestion: async (id) => {
    await deleteResearchQuestion(id);
    set((state) => ({
      questions: state.questions.filter((question) => question.id !== id),
    }));
  },
}));
