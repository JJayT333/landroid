import db from './db';
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

export interface ResearchWorkspaceData {
  imports: ResearchImport[];
  sources: ResearchSource[];
  formulas: ResearchFormula[];
  projectRecords: ResearchProjectRecord[];
  questions: ResearchQuestion[];
}

export function createEmptyResearchWorkspaceData(): ResearchWorkspaceData {
  return {
    imports: [],
    sources: [],
    formulas: [],
    projectRecords: [],
    questions: [],
  };
}

export function normalizeResearchWorkspaceData(
  workspaceId: string,
  data: Partial<ResearchWorkspaceData> | undefined
): ResearchWorkspaceData {
  return {
    imports: (data?.imports ?? []).map((researchImport) =>
      normalizeResearchImport({ ...researchImport, workspaceId })
    ),
    sources: (data?.sources ?? []).map((source) =>
      normalizeResearchSource({ ...source, workspaceId })
    ),
    formulas: (data?.formulas ?? []).map((formula) =>
      normalizeResearchFormula({ ...formula, workspaceId })
    ),
    projectRecords: (data?.projectRecords ?? []).map((projectRecord) =>
      normalizeResearchProjectRecord({ ...projectRecord, workspaceId })
    ),
    questions: (data?.questions ?? []).map((question) =>
      normalizeResearchQuestion({ ...question, workspaceId })
    ),
  };
}

export async function loadResearchWorkspaceData(
  workspaceId: string
): Promise<ResearchWorkspaceData> {
  const [imports, sources, formulas, projectRecords, questions] = await Promise.all([
    db.researchImports.where('workspaceId').equals(workspaceId).toArray(),
    db.researchSources.where('workspaceId').equals(workspaceId).toArray(),
    db.researchFormulas.where('workspaceId').equals(workspaceId).toArray(),
    db.researchProjectRecords.where('workspaceId').equals(workspaceId).toArray(),
    db.researchQuestions.where('workspaceId').equals(workspaceId).toArray(),
  ]);

  return {
    imports: imports.map((researchImport) => normalizeResearchImport(researchImport)),
    sources: sources.map((source) => normalizeResearchSource(source)),
    formulas: formulas.map((formula) => normalizeResearchFormula(formula)),
    projectRecords: projectRecords.map((projectRecord) =>
      normalizeResearchProjectRecord(projectRecord)
    ),
    questions: questions.map((question) => normalizeResearchQuestion(question)),
  };
}

export async function replaceResearchWorkspaceData(
  workspaceId: string,
  data: ResearchWorkspaceData
): Promise<void> {
  const normalized = normalizeResearchWorkspaceData(workspaceId, data);

  await db.transaction(
    'rw',
    [
      db.researchImports,
      db.researchSources,
      db.researchFormulas,
      db.researchProjectRecords,
      db.researchQuestions,
    ],
    async () => {
      await Promise.all([
        db.researchImports.where('workspaceId').equals(workspaceId).delete(),
        db.researchSources.where('workspaceId').equals(workspaceId).delete(),
        db.researchFormulas.where('workspaceId').equals(workspaceId).delete(),
        db.researchProjectRecords.where('workspaceId').equals(workspaceId).delete(),
        db.researchQuestions.where('workspaceId').equals(workspaceId).delete(),
      ]);

      if (normalized.imports.length > 0) {
        await db.researchImports.bulkPut(normalized.imports);
      }
      if (normalized.sources.length > 0) {
        await db.researchSources.bulkPut(normalized.sources);
      }
      if (normalized.formulas.length > 0) {
        await db.researchFormulas.bulkPut(normalized.formulas);
      }
      if (normalized.projectRecords.length > 0) {
        await db.researchProjectRecords.bulkPut(normalized.projectRecords);
      }
      if (normalized.questions.length > 0) {
        await db.researchQuestions.bulkPut(normalized.questions);
      }
    }
  );
}

export function saveResearchImport(researchImport: ResearchImport) {
  return db.researchImports.put(normalizeResearchImport(researchImport));
}

export function deleteResearchImport(id: string) {
  return db.researchImports.delete(id);
}

export function saveResearchSource(source: ResearchSource) {
  return db.researchSources.put(normalizeResearchSource(source));
}

export function deleteResearchSource(id: string) {
  return db.researchSources.delete(id);
}

export function saveResearchFormula(formula: ResearchFormula) {
  return db.researchFormulas.put(normalizeResearchFormula(formula));
}

export function deleteResearchFormula(id: string) {
  return db.researchFormulas.delete(id);
}

export function saveResearchProjectRecord(projectRecord: ResearchProjectRecord) {
  return db.researchProjectRecords.put(
    normalizeResearchProjectRecord(projectRecord)
  );
}

export function deleteResearchProjectRecord(id: string) {
  return db.researchProjectRecords.delete(id);
}

export function saveResearchQuestion(question: ResearchQuestion) {
  return db.researchQuestions.put(normalizeResearchQuestion(question));
}

export function deleteResearchQuestion(id: string) {
  return db.researchQuestions.delete(id);
}
