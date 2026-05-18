export const PDF_MIME_TYPE = 'application/pdf';

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // %PDF-

export function isPdfFileName(fileName: string): boolean {
  return fileName.trim().toLowerCase().endsWith('.pdf');
}

export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < PDF_MAGIC_BYTES.length) return false;
  return PDF_MAGIC_BYTES.every((byte, index) => bytes[index] === byte);
}

export function assertPdfBytes(bytes: Uint8Array, label = 'PDF'): void {
  if (!hasPdfMagicBytes(bytes)) {
    throw new Error(`${label} must be a valid PDF file.`);
  }
}

export function normalizePdfBytes(bytes: Uint8Array, label = 'PDF'): Blob {
  assertPdfBytes(bytes, label);
  const safeCopy = new Uint8Array(bytes);
  return new Blob([safeCopy.buffer as ArrayBuffer], { type: PDF_MIME_TYPE });
}

export async function normalizePdfBlob(
  blob: Blob,
  label = 'PDF'
): Promise<Blob> {
  return normalizePdfBytes(new Uint8Array(await blob.arrayBuffer()), label);
}
