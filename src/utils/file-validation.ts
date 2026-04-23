export const FILE_SIZE_LIMITS = {
  LANDROID: 50 * 1024 * 1024,
  SPREADSHEET: 15 * 1024 * 1024,
  PDF: 25 * 1024 * 1024,
  IMAGE: 10 * 1024 * 1024,
  GEOJSON: 20 * 1024 * 1024,
} as const;

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

export function limitForExtension(fileName: string): { bytes: number; label: string } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.landroid')) return { bytes: FILE_SIZE_LIMITS.LANDROID, label: '.landroid file' };
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv'))
    return { bytes: FILE_SIZE_LIMITS.SPREADSHEET, label: 'spreadsheet' };
  if (lower.endsWith('.pdf')) return { bytes: FILE_SIZE_LIMITS.PDF, label: 'PDF' };
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg'))
    return { bytes: FILE_SIZE_LIMITS.IMAGE, label: 'image' };
  if (lower.endsWith('.geojson') || lower.endsWith('.json'))
    return { bytes: FILE_SIZE_LIMITS.GEOJSON, label: 'GeoJSON' };
  return { bytes: FILE_SIZE_LIMITS.PDF, label: 'file' };
}
