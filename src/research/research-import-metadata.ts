import type { ResearchImport } from '../types/research';

export interface ResearchImportMetadataDraft {
  title: string;
  datasetId: string | null;
  notes: string;
}

export function createResearchImportMetadataDraft(
  researchImport: Pick<ResearchImport, 'title' | 'datasetId' | 'notes'>
): ResearchImportMetadataDraft {
  return {
    title: researchImport.title,
    datasetId: researchImport.datasetId,
    notes: researchImport.notes,
  };
}

export function researchImportMetadataDraftIsDirty(
  researchImport: Pick<ResearchImport, 'title' | 'datasetId' | 'notes'> | null,
  draft: ResearchImportMetadataDraft | null
): boolean {
  if (!researchImport || !draft) return false;
  return (
    researchImport.title !== draft.title ||
    researchImport.datasetId !== draft.datasetId ||
    researchImport.notes !== draft.notes
  );
}

export function buildResearchImportFileFingerprint(
  researchImports: Array<Pick<ResearchImport, 'id' | 'fileName' | 'blob'>>
): string {
  return researchImports
    .map((researchImport) => {
      const file = researchImport.blob as File;
      const lastModified =
        typeof file.lastModified === 'number' ? file.lastModified : 0;
      return [
        researchImport.id,
        researchImport.fileName,
        researchImport.blob.type,
        researchImport.blob.size,
        lastModified,
      ].join(':');
    })
    .sort()
    .join('|');
}
