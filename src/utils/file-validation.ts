export const FILE_SIZE_LIMITS = {
  LANDROID: 50 * 1024 * 1024,
  SPREADSHEET: 15 * 1024 * 1024,
  PDF: 25 * 1024 * 1024,
  IMAGE: 10 * 1024 * 1024,
  GEOJSON: 20 * 1024 * 1024,
} as const;

export const OWNER_DOCUMENT_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.json',
  '.geojson',
  '.csv',
  '.txt',
] as const;

export const RESEARCH_IMPORT_UPLOAD_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.tif',
  '.tiff',
  '.geojson',
  '.json',
  '.csv',
  '.txt',
  '.dat',
  '.asc',
  '.dbf',
  '.zip',
] as const;

export const OWNER_DOCUMENT_ACCEPT = OWNER_DOCUMENT_UPLOAD_EXTENSIONS.join(',');
export const RESEARCH_IMPORT_ACCEPT = RESEARCH_IMPORT_UPLOAD_EXTENSIONS.join(',');

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function assertFileSize(file: File, maxBytes: number, label: string): void {
  if (file.size > maxBytes) {
    throw new Error(
      `${label} is too large (${formatBytes(file.size)}). Maximum allowed: ${formatBytes(maxBytes)}.`
    );
  }
}

function extensionForFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

export function assertAllowedFileExtension(
  fileName: string,
  allowedExtensions: readonly string[],
  label: string
): void {
  const extension = extensionForFileName(fileName);
  if (!allowedExtensions.includes(extension)) {
    throw new Error(
      `${label} type is not supported. Allowed extensions: ${allowedExtensions.join(', ')}.`
    );
  }
}

export function limitForExtension(fileName: string): { bytes: number; label: string } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.landroid')) return { bytes: FILE_SIZE_LIMITS.LANDROID, label: '.landroid file' };
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv'))
    return { bytes: FILE_SIZE_LIMITS.SPREADSHEET, label: 'spreadsheet' };
  if (lower.endsWith('.pdf')) return { bytes: FILE_SIZE_LIMITS.PDF, label: 'PDF' };
  if (
    lower.endsWith('.png')
    || lower.endsWith('.jpg')
    || lower.endsWith('.jpeg')
    || lower.endsWith('.tif')
    || lower.endsWith('.tiff')
  )
    return { bytes: FILE_SIZE_LIMITS.IMAGE, label: 'image' };
  if (lower.endsWith('.geojson') || lower.endsWith('.json'))
    return { bytes: FILE_SIZE_LIMITS.GEOJSON, label: 'GeoJSON' };
  return { bytes: FILE_SIZE_LIMITS.PDF, label: 'file' };
}
