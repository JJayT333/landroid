const BUNDLED_DESKMAP_PDF = {
  fileName: 'Producers_88.pdf',
  sourceUrl: new URL('../../docs/lease-generator/Producers_88.pdf', import.meta.url)
    .href,
} as const;

export async function createBundledDeskMapPdfFile(
  _seed: string,
  fileNameHint?: string | null
): Promise<File> {
  const response = await fetch(BUNDLED_DESKMAP_PDF.sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to load bundled desk map PDF (${BUNDLED_DESKMAP_PDF.fileName}).`
    );
  }
  const blob = await response.blob();
  return new File([blob], fileNameHint || BUNDLED_DESKMAP_PDF.fileName, {
    type: blob.type || 'application/pdf',
  });
}
