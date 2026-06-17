/**
 * Bates stamping — sequential page numbering for a production set.
 *
 * "Bates numbering" stamps a unique, sequential identifier on every page of a
 * document set (e.g. SMITH000001, SMITH000002, …) so any page can be cited
 * unambiguously in a title opinion, a production, or litigation. The number
 * runs continuously across the whole set, not per-document.
 *
 * This module is the file-altering core, so it follows the production-copy
 * model: the originals are NEVER modified. `stampBatesPdf` loads the source
 * bytes and returns a brand-new stamped PDF; the caller keeps the original
 * (hash-verified) and ships the stamp as a derived artifact alongside it.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface BatesOptions {
  /** Leading label, e.g. "LANDROID" → LANDROID000001. */
  prefix: string;
  /** First number in the sequence (1-based by convention). */
  startNumber: number;
  /** Zero-pad width, e.g. 6 → 000001. */
  padWidth: number;
}

export interface BatesStampResult {
  /** The stamped PDF bytes (a new document; the source is untouched). */
  bytes: Uint8Array;
  pageCount: number;
  /** Label on the first page (empty when the PDF has no pages). */
  firstLabel: string;
  /** Label on the last page. */
  lastLabel: string;
  /** startNumber + pageCount — feed as the next doc's startNumber to continue. */
  nextNumber: number;
}

// Stamp glyph metrics + placement (bottom-right, clear of typical page content).
const STAMP_SIZE = 9;
const MARGIN_X = 24;
const MARGIN_Y = 18;
const STAMP_COLOR = rgb(0.55, 0.1, 0.1); // seal red, reads as an applied stamp

const UNSAFE_PREFIX = /[^A-Za-z0-9._-]+/g;

/** Format one Bates label, e.g. ("LANDROID", 1, 6) → "LANDROID000001". */
export function formatBatesLabel(
  prefix: string,
  n: number,
  padWidth: number
): string {
  return `${prefix}${String(n).padStart(padWidth, '0')}`;
}

/**
 * Turn free-text into a safe Bates prefix: keep alphanumerics / `. _ -`, drop
 * the rest, upper-case. Falls back when nothing usable remains.
 */
export function normalizeBatesPrefix(raw: string, fallback = 'BATES'): string {
  const cleaned = raw.trim().replace(UNSAFE_PREFIX, '').toUpperCase();
  return cleaned || fallback;
}

/**
 * Stamp sequential Bates numbers onto each page of a PDF (bottom-right).
 * Non-mutating — the source bytes are loaded into a fresh document and a new
 * stamped copy is returned. The sequence starts at `startNumber` and advances
 * one per page; `nextNumber` lets a caller chain into the following document.
 */
export async function stampBatesPdf(
  source: Uint8Array | ArrayBuffer,
  options: BatesOptions
): Promise<BatesStampResult> {
  const pdf = await PDFDocument.load(source);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  let n = options.startNumber;
  let firstLabel = '';
  let lastLabel = '';

  for (const page of pages) {
    const label = formatBatesLabel(options.prefix, n, options.padWidth);
    if (firstLabel === '') firstLabel = label;
    lastLabel = label;
    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, STAMP_SIZE);
    page.drawText(label, {
      x: width - textWidth - MARGIN_X,
      y: MARGIN_Y,
      size: STAMP_SIZE,
      font,
      color: STAMP_COLOR,
    });
    n += 1;
  }

  return {
    bytes: await pdf.save(),
    pageCount: pages.length,
    firstLabel,
    lastLabel,
    nextNumber: n,
  };
}
