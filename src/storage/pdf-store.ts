/**
 * PDF attachment CRUD — thin wrappers around Dexie table operations.
 */
import db, { type PdfAttachment } from './db';

export async function savePdf(nodeId: string, file: File): Promise<void> {
  const attachment: PdfAttachment = {
    nodeId,
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
    blob: file,
    createdAt: new Date().toISOString(),
  };
  await db.pdfs.put(attachment);
}

export async function getPdf(nodeId: string): Promise<PdfAttachment | undefined> {
  return db.pdfs.get(nodeId);
}

export async function deletePdf(nodeId: string): Promise<void> {
  await db.pdfs.delete(nodeId);
}

export async function hasPdf(nodeId: string): Promise<boolean> {
  const count = await db.pdfs.where('nodeId').equals(nodeId).count();
  return count > 0;
}
