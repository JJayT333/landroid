import db from './db';
import {
  normalizeResearchImport,
  type ResearchImport,
} from '../types/research';

export interface ResearchWorkspaceData {
  imports: ResearchImport[];
}

export async function loadResearchWorkspaceData(
  workspaceId: string
): Promise<ResearchWorkspaceData> {
  const imports = await db.researchImports
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();

  return {
    imports: imports.map((researchImport) =>
      normalizeResearchImport(researchImport)
    ),
  };
}

export async function replaceResearchWorkspaceData(
  workspaceId: string,
  data: ResearchWorkspaceData
): Promise<void> {
  await db.transaction('rw', db.researchImports, async () => {
    await db.researchImports.where('workspaceId').equals(workspaceId).delete();

    if (data.imports.length > 0) {
      await db.researchImports.bulkPut(
        data.imports.map((researchImport) =>
          normalizeResearchImport({
            ...researchImport,
            workspaceId,
          })
        )
      );
    }
  });
}

export function saveResearchImport(researchImport: ResearchImport) {
  return db.researchImports.put(normalizeResearchImport(researchImport));
}

export function deleteResearchImport(id: string) {
  return db.researchImports.delete(id);
}
