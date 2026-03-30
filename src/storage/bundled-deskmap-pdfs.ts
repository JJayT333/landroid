const BUNDLED_DESKMAP_PDFS = [
  {
    fileName: '20171744.pdf',
    sourceUrl: new URL('../../TORS_Documents/20171744.pdf', import.meta.url).href,
  },
  {
    fileName: '20171745.pdf',
    sourceUrl: new URL('../../TORS_Documents/20171745.pdf', import.meta.url).href,
  },
  {
    fileName: '20171749.pdf',
    sourceUrl: new URL('../../TORS_Documents/20171749.pdf', import.meta.url).href,
  },
  {
    fileName: '20242574.pdf',
    sourceUrl: new URL('../../TORS_Documents/20242574.pdf', import.meta.url).href,
  },
  {
    fileName: '20255881.pdf',
    sourceUrl: new URL('../../TORS_Documents/20255881.pdf', import.meta.url).href,
  },
  {
    fileName: '20216955.pdf',
    sourceUrl: new URL('../../TORS_Documents/20216955.pdf', import.meta.url).href,
  },
] as const;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickBundledDeskMapPdf(seed: string) {
  const safeSeed = seed || BUNDLED_DESKMAP_PDFS[0].fileName;
  const index = hashString(safeSeed) % BUNDLED_DESKMAP_PDFS.length;
  return BUNDLED_DESKMAP_PDFS[index];
}

export async function createBundledDeskMapPdfFile(
  seed: string,
  fileNameHint?: string | null
): Promise<File> {
  const selected = pickBundledDeskMapPdf(seed);
  const response = await fetch(selected.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to load bundled desk map PDF (${selected.fileName}).`);
  }
  const blob = await response.blob();
  return new File([blob], fileNameHint || selected.fileName, {
    type: blob.type || 'application/pdf',
  });
}
