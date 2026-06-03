import db from './db';
import {
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
} from './db-key-scope';
import {
  assertWorkspaceWriteFence,
  ensureWorkspaceWriteFence,
} from './workspace-write-lease';
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

  await ensureWorkspaceWriteFence(workspaceId);
  await db.transaction(
    'rw',
    [
      db.workspaceWriteLeases,
      db.researchImports,
      db.researchSources,
      db.researchFormulas,
      db.researchProjectRecords,
      db.researchQuestions,
    ],
    async () => {
      await assertWorkspaceWriteFence(workspaceId);
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

export async function saveResearchImport(researchImport: ResearchImport) {
  const normalized = normalizeResearchImport(researchImport);
  await ensureWorkspaceWriteFence(normalized.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchImports, async () => {
    await assertWorkspaceWriteFence(normalized.workspaceId);
    return db.researchImports.put(
      stampActiveDbKeyWithStorageId(normalized, 'id')
    );
  });
}

export async function deleteResearchImport(id: string) {
  const row = await getResearchImportRow(id);
  if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(row.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchImports, async () => {
    await assertWorkspaceWriteFence(row.workspaceId);
    await db.researchImports.delete(row.id);
  });
}

export async function saveResearchSource(source: ResearchSource) {
  const normalized = normalizeResearchSource(source);
  await ensureWorkspaceWriteFence(normalized.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchSources, async () => {
    await assertWorkspaceWriteFence(normalized.workspaceId);
    return db.researchSources.put(
      stampActiveDbKeyWithStorageId(normalized, 'id')
    );
  });
}

export async function deleteResearchSource(id: string) {
  const row = await getResearchSourceRow(id);
  if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(row.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchSources, async () => {
    await assertWorkspaceWriteFence(row.workspaceId);
    await db.researchSources.delete(row.id);
  });
}

export async function saveResearchFormula(formula: ResearchFormula) {
  const normalized = normalizeResearchFormula(formula);
  await ensureWorkspaceWriteFence(normalized.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchFormulas, async () => {
    await assertWorkspaceWriteFence(normalized.workspaceId);
    return db.researchFormulas.put(
      stampActiveDbKeyWithStorageId(normalized, 'id')
    );
  });
}

export async function deleteResearchFormula(id: string) {
  const row = await getResearchFormulaRow(id);
  if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(row.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchFormulas, async () => {
    await assertWorkspaceWriteFence(row.workspaceId);
    await db.researchFormulas.delete(row.id);
  });
}

export async function saveResearchProjectRecord(projectRecord: ResearchProjectRecord) {
  const normalized = normalizeResearchProjectRecord(projectRecord);
  await ensureWorkspaceWriteFence(normalized.workspaceId);
  return db.transaction(
    'rw',
    db.workspaceWriteLeases,
    db.researchProjectRecords,
    async () => {
      await assertWorkspaceWriteFence(normalized.workspaceId);
      return db.researchProjectRecords.put(
        stampActiveDbKeyWithStorageId(normalized, 'id')
      );
    }
  );
}

export async function deleteResearchProjectRecord(id: string) {
  const row = await getResearchProjectRecordRow(id);
  if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(row.workspaceId);
  return db.transaction(
    'rw',
    db.workspaceWriteLeases,
    db.researchProjectRecords,
    async () => {
      await assertWorkspaceWriteFence(row.workspaceId);
      await db.researchProjectRecords.delete(row.id);
    }
  );
}

export async function saveResearchQuestion(question: ResearchQuestion) {
  const normalized = normalizeResearchQuestion(question);
  await ensureWorkspaceWriteFence(normalized.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchQuestions, async () => {
    await assertWorkspaceWriteFence(normalized.workspaceId);
    return db.researchQuestions.put(
      stampActiveDbKeyWithStorageId(normalized, 'id')
    );
  });
}

export async function deleteResearchQuestion(id: string) {
  const row = await getResearchQuestionRow(id);
  if (!row || row.dbKey !== activeWorkspaceScope(row.workspaceId)[0]) return;
  await ensureWorkspaceWriteFence(row.workspaceId);
  return db.transaction('rw', db.workspaceWriteLeases, db.researchQuestions, async () => {
    await assertWorkspaceWriteFence(row.workspaceId);
    await db.researchQuestions.delete(row.id);
  });
}
