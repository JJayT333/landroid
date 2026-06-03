import db from './db';
import {
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
} from './db-key-scope';
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

function stripStoredId<T extends { id: string; dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'id');
}

async function getResearchImportRow(id: string) {
  return (
    (await db.researchImports.get(activeStorageScopedId(id)))
    ?? db.researchImports.get(id)
  );
}

async function getResearchSourceRow(id: string) {
  return (
    (await db.researchSources.get(activeStorageScopedId(id)))
    ?? db.researchSources.get(id)
  );
}

async function getResearchFormulaRow(id: string) {
  return (
    (await db.researchFormulas.get(activeStorageScopedId(id)))
    ?? db.researchFormulas.get(id)
  );
}

async function getResearchProjectRecordRow(id: string) {
  return (
    (await db.researchProjectRecords.get(activeStorageScopedId(id)))
    ?? db.researchProjectRecords.get(id)
  );
}

async function getResearchQuestionRow(id: string) {
  return (
    (await db.researchQuestions.get(activeStorageScopedId(id)))
    ?? db.researchQuestions.get(id)
  );
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
    db.researchImports.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.researchSources.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.researchFormulas.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.researchProjectRecords.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
    db.researchQuestions.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).toArray(),
  ]);

  return {
    imports: imports.map((researchImport) => normalizeResearchImport(stripStoredId(researchImport))),
    sources: sources.map((source) => normalizeResearchSource(stripStoredId(source))),
    formulas: formulas.map((formula) => normalizeResearchFormula(stripStoredId(formula))),
    projectRecords: projectRecords.map((projectRecord) =>
      normalizeResearchProjectRecord(stripStoredId(projectRecord))
    ),
    questions: questions.map((question) => normalizeResearchQuestion(stripStoredId(question))),
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
        db.researchImports.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.researchSources.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.researchFormulas.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.researchProjectRecords.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
        db.researchQuestions.where('[dbKey+workspaceId]').equals(activeWorkspaceScope(workspaceId)).delete(),
      ]);

      if (normalized.imports.length > 0) {
        await db.researchImports.bulkPut(
          normalized.imports.map((row) => stampActiveDbKeyWithStorageId(row, 'id'))
        );
      }
      if (normalized.sources.length > 0) {
        await db.researchSources.bulkPut(
          normalized.sources.map((row) => stampActiveDbKeyWithStorageId(row, 'id'))
        );
      }
      if (normalized.formulas.length > 0) {
        await db.researchFormulas.bulkPut(
          normalized.formulas.map((row) => stampActiveDbKeyWithStorageId(row, 'id'))
        );
      }
      if (normalized.projectRecords.length > 0) {
        await db.researchProjectRecords.bulkPut(
          normalized.projectRecords.map((row) =>
            stampActiveDbKeyWithStorageId(row, 'id')
          )
        );
      }
      if (normalized.questions.length > 0) {
        await db.researchQuestions.bulkPut(
          normalized.questions.map((row) => stampActiveDbKeyWithStorageId(row, 'id'))
        );
      }
    }
  );
}

export function saveResearchImport(researchImport: ResearchImport) {
  return db.researchImports.put(
    stampActiveDbKeyWithStorageId(normalizeResearchImport(researchImport), 'id')
  );
}

export function deleteResearchImport(id: string) {
  return db.transaction('rw', db.researchImports, async () => {
    const row = await getResearchImportRow(id);
    if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
    await db.researchImports.delete(row.id);
  });
}

export function saveResearchSource(source: ResearchSource) {
  return db.researchSources.put(
    stampActiveDbKeyWithStorageId(normalizeResearchSource(source), 'id')
  );
}

export function deleteResearchSource(id: string) {
  return db.transaction('rw', db.researchSources, async () => {
    const row = await getResearchSourceRow(id);
    if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
    await db.researchSources.delete(row.id);
  });
}

export function saveResearchFormula(formula: ResearchFormula) {
  return db.researchFormulas.put(
    stampActiveDbKeyWithStorageId(normalizeResearchFormula(formula), 'id')
  );
}

export function deleteResearchFormula(id: string) {
  return db.transaction('rw', db.researchFormulas, async () => {
    const row = await getResearchFormulaRow(id);
    if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
    await db.researchFormulas.delete(row.id);
  });
}

export function saveResearchProjectRecord(projectRecord: ResearchProjectRecord) {
  return db.researchProjectRecords.put(
    stampActiveDbKeyWithStorageId(normalizeResearchProjectRecord(projectRecord), 'id')
  );
}

export function deleteResearchProjectRecord(id: string) {
  return db.transaction('rw', db.researchProjectRecords, async () => {
    const row = await getResearchProjectRecordRow(id);
    if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
    await db.researchProjectRecords.delete(row.id);
  });
}

export function saveResearchQuestion(question: ResearchQuestion) {
  return db.researchQuestions.put(
    stampActiveDbKeyWithStorageId(normalizeResearchQuestion(question), 'id')
  );
}

export function deleteResearchQuestion(id: string) {
  return db.transaction('rw', db.researchQuestions, async () => {
    const row = await getResearchQuestionRow(id);
    if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
    await db.researchQuestions.delete(row.id);
  });
}
