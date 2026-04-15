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

function withoutId(ids: string[], id: string): string[] {
  return ids.filter((candidate) => candidate !== id);
}

function idsChanged(left: string[], right: string[]): boolean {
  return left.length !== right.length || left.some((value, index) => value !== right[index]);
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
    let next: ResearchImport | null = null;
    set((state) => ({
      imports: state.imports.map((researchImport) => {
        if (researchImport.id !== id) {
          return researchImport;
        }
        next = normalizeResearchImport(
          touch({ ...researchImport, ...fields, workspaceId: researchImport.workspaceId })
        );
        return next;
      }),
    }));
    if (next) {
      await saveResearchImport(next);
    }
  },

  removeImport: async (id) => {
    const state = get();
    const sources = state.sources.map((source) => {
      if (source.links.importId !== id) {
        return source;
      }
      return touch({
        ...source,
        links: { ...source.links, importId: null },
      });
    });
    const projectRecords = state.projectRecords.map((projectRecord) => {
      if (projectRecord.importId !== id) {
        return projectRecord;
      }
      return touch({
        ...projectRecord,
        importId: null,
      });
    });
    const changedSources = sources.filter(
      (source, index) => source !== state.sources[index]
    );
    const changedProjectRecords = projectRecords.filter(
      (projectRecord, index) => projectRecord !== state.projectRecords[index]
    );

    await deleteResearchImport(id);
    await Promise.all([
      ...changedSources.map((source) => saveResearchSource(source)),
      ...changedProjectRecords.map((projectRecord) =>
        saveResearchProjectRecord(projectRecord)
      ),
    ]);
    set((state) => ({
      imports: state.imports.filter((researchImport) => researchImport.id !== id),
      sources,
      projectRecords,
    }));
  },

  addSource: async (source) => {
    const workspaceId = get().workspaceId ?? source.workspaceId;
    const next = normalizeResearchSource({ ...source, workspaceId });
    await saveResearchSource(next);
    set((state) => ({ sources: [next, ...state.sources] }));
  },

  updateSource: async (id, fields) => {
    let next: ResearchSource | null = null;
    set((state) => ({
      sources: state.sources.map((source) => {
        if (source.id !== id) {
          return source;
        }
        next = normalizeResearchSource(
          touch({ ...source, ...fields, workspaceId: source.workspaceId })
        );
        return next;
      }),
    }));
    if (next) {
      await saveResearchSource(next);
    }
  },

  removeSource: async (id) => {
    const state = get();
    const formulas = state.formulas.map((formula) => {
      const sourceIds = withoutId(formula.sourceIds, id);
      return idsChanged(formula.sourceIds, sourceIds)
        ? touch({ ...formula, sourceIds })
        : formula;
    });
    const projectRecords = state.projectRecords.map((projectRecord) => {
      const sourceIds = withoutId(projectRecord.sourceIds, id);
      return idsChanged(projectRecord.sourceIds, sourceIds)
        ? touch({ ...projectRecord, sourceIds })
        : projectRecord;
    });
    const questions = state.questions.map((question) => {
      const sourceIds = withoutId(question.sourceIds, id);
      return idsChanged(question.sourceIds, sourceIds)
        ? touch({ ...question, sourceIds })
        : question;
    });
    const changedFormulas = formulas.filter(
      (formula, index) => formula !== state.formulas[index]
    );
    const changedProjectRecords = projectRecords.filter(
      (projectRecord, index) => projectRecord !== state.projectRecords[index]
    );
    const changedQuestions = questions.filter(
      (question, index) => question !== state.questions[index]
    );

    await deleteResearchSource(id);
    await Promise.all([
      ...changedFormulas.map((formula) => saveResearchFormula(formula)),
      ...changedProjectRecords.map((projectRecord) =>
        saveResearchProjectRecord(projectRecord)
      ),
      ...changedQuestions.map((question) => saveResearchQuestion(question)),
    ]);
    set((state) => ({
      sources: state.sources.filter((source) => source.id !== id),
      formulas,
      projectRecords,
      questions,
    }));
  },

  addFormula: async (formula) => {
    const workspaceId = get().workspaceId ?? formula.workspaceId;
    const next = normalizeResearchFormula({ ...formula, workspaceId });
    await saveResearchFormula(next);
    set((state) => ({ formulas: [next, ...state.formulas] }));
  },

  updateFormula: async (id, fields) => {
    let next: ResearchFormula | null = null;
    set((state) => ({
      formulas: state.formulas.map((formula) => {
        if (formula.id !== id) {
          return formula;
        }
        next = normalizeResearchFormula(
          touch({ ...formula, ...fields, workspaceId: formula.workspaceId })
        );
        return next;
      }),
    }));
    if (next) {
      await saveResearchFormula(next);
    }
  },

  removeFormula: async (id) => {
    const state = get();
    const questions = state.questions.map((question) => {
      const formulaIds = withoutId(question.formulaIds, id);
      return idsChanged(question.formulaIds, formulaIds)
        ? touch({ ...question, formulaIds })
        : question;
    });
    const changedQuestions = questions.filter(
      (question, index) => question !== state.questions[index]
    );

    await deleteResearchFormula(id);
    await Promise.all(changedQuestions.map((question) => saveResearchQuestion(question)));
    set((state) => ({
      formulas: state.formulas.filter((formula) => formula.id !== id),
      questions,
    }));
  },

  addProjectRecord: async (projectRecord) => {
    const workspaceId = get().workspaceId ?? projectRecord.workspaceId;
    const next = normalizeResearchProjectRecord({ ...projectRecord, workspaceId });
    await saveResearchProjectRecord(next);
    set((state) => ({ projectRecords: [next, ...state.projectRecords] }));
  },

  updateProjectRecord: async (id, fields) => {
    let next: ResearchProjectRecord | null = null;
    set((state) => ({
      projectRecords: state.projectRecords.map((projectRecord) => {
        if (projectRecord.id !== id) {
          return projectRecord;
        }
        next = normalizeResearchProjectRecord(
          touch({
            ...projectRecord,
            ...fields,
            workspaceId: projectRecord.workspaceId,
          })
        );
        return next;
      }),
    }));
    if (next) {
      await saveResearchProjectRecord(next);
    }
  },

  removeProjectRecord: async (id) => {
    const state = get();
    const questions = state.questions.map((question) => {
      const projectRecordIds = withoutId(question.projectRecordIds, id);
      return idsChanged(question.projectRecordIds, projectRecordIds)
        ? touch({ ...question, projectRecordIds })
        : question;
    });
    const changedQuestions = questions.filter(
      (question, index) => question !== state.questions[index]
    );

    await deleteResearchProjectRecord(id);
    await Promise.all(changedQuestions.map((question) => saveResearchQuestion(question)));
    set((state) => ({
      projectRecords: state.projectRecords.filter(
        (projectRecord) => projectRecord.id !== id
      ),
      questions,
    }));
  },

  addQuestion: async (question) => {
    const workspaceId = get().workspaceId ?? question.workspaceId;
    const next = normalizeResearchQuestion({ ...question, workspaceId });
    await saveResearchQuestion(next);
    set((state) => ({ questions: [next, ...state.questions] }));
  },

  updateQuestion: async (id, fields) => {
    let next: ResearchQuestion | null = null;
    set((state) => ({
      questions: state.questions.map((question) => {
        if (question.id !== id) {
          return question;
        }
        next = normalizeResearchQuestion(
          touch({ ...question, ...fields, workspaceId: question.workspaceId })
        );
        return next;
      }),
    }));
    if (next) {
      await saveResearchQuestion(next);
    }
  },

  removeQuestion: async (id) => {
    await deleteResearchQuestion(id);
    set((state) => ({
      questions: state.questions.filter((question) => question.id !== id),
    }));
  },
}));
