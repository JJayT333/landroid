/**
 * Unit-plat PDF exhibit (DA2-M PR M6).
 *
 * Draws the matched/ingested tracts as a VECTOR plat (pdf-lib `drawSvgPath`, no
 * rasterization) — colored tracts + numbers, a title block, and a legend table
 * keyed `LAND_TRACT_ID` — the kind of plat a landman distributes. Pure data in,
 * PDF bytes out (testable; the UI only wires the download).
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import {
  computeTractProjection,
  featureToSvgPath,
  mergeFeatureBBoxes,
  projectLonLat,
  ringCentroid,
} from './geojson-ingest';
import { hexToRgb01, tractColorAt } from './tract-palette';
import type { MapTractFeature } from '../types/map-tract-feature';

export interface PlatPdfInput {
  projectName: string;
  /** Display date (caller passes it; this module stays time-source-free). */
  generatedAt: string;
  tractFeatures: readonly MapTractFeature[];
  /** Optional per-tract legend data (LAND_TRACT_ID, acres) keyed by tract. */
  legend?: ReadonlyArray<{ tractKey: string; landTractId?: string }>;
}

const INK = rgb(0.18, 0.13, 0.08);
const INK_SOFT = rgb(0.42, 0.36, 0.28);
const BORDER = rgb(0.29, 0.24, 0.16);

export async function buildUnitPlatPdf(input: PlatPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([792, 612]); // US Letter, landscape
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const { width: pageW, height: pageH } = page.getSize();
  const margin = 36;

  // ── Title block ──
  const title = `${(input.projectName || 'LANDroid').trim()} — Tract Plat`;
  page.drawText(title, { x: margin, y: pageH - margin - 4, size: 18, font: bold, color: INK });
  page.drawText(
    `${input.tractFeatures.length} tract${input.tractFeatures.length === 1 ? '' : 's'} · ${input.generatedAt}`,
    { x: margin, y: pageH - margin - 22, size: 9, font, color: INK_SOFT }
  );
  const ruleY = pageH - margin - 30;
  page.drawLine({
    start: { x: margin, y: ruleY },
    end: { x: pageW - margin, y: ruleY },
    thickness: 0.75,
    color: BORDER,
  });

  const features = input.tractFeatures.filter((feature) => feature.polygons.length > 0);
  const bbox = mergeFeatureBBoxes(features);
  if (!bbox) return doc.save();

  // ── Map area (left ~62%) ──
  const proj = computeTractProjection(bbox, { size: 1000, padding: 4 });
  const top = ruleY - 14; // SVG y=0 anchors here; content extends downward
  const availW = (pageW - margin * 2) * 0.62;
  const availH = top - margin;
  const scale = Math.min(availW / proj.width, availH / proj.height);
  const left = margin;

  features.forEach((feature, index) => {
    const [r, g, b] = hexToRgb01(tractColorAt(index));
    page.drawSvgPath(featureToSvgPath(feature.polygons, proj), {
      x: left,
      y: top,
      scale,
      color: rgb(r, g, b),
      opacity: feature.matchedDeskMapId ? 0.5 : 0.34,
      borderColor: BORDER,
      borderWidth: 0.8,
    });
  });

  features.forEach((feature) => {
    const [cx, cy] = projectLonLat(ringCentroid(feature.polygons[0].outer), proj);
    const x = left + cx * scale;
    const y = top - cy * scale;
    const textWidth = bold.widthOfTextAtSize(feature.tractKey, 8);
    page.drawText(feature.tractKey, { x: x - textWidth / 2, y: y - 4, size: 8, font: bold, color: INK });
  });

  // ── Legend table (right column) ──
  const legendByKey = new Map((input.legend ?? []).map((row) => [row.tractKey, row]));
  const lx = left + availW + 20;
  let ly = top;
  page.drawText('Tract', { x: lx + 14, y: ly, size: 9, font: bold, color: INK_SOFT });
  page.drawText('Acres', { x: lx + 70, y: ly, size: 9, font: bold, color: INK_SOFT });
  page.drawText('LAND_TRACT_ID', { x: lx + 116, y: ly, size: 9, font: bold, color: INK_SOFT });
  ly -= 15;
  features.forEach((feature, index) => {
    if (ly < margin) return; // ran out of page; legend overflow is acceptable
    const [r, g, b] = hexToRgb01(tractColorAt(index));
    page.drawRectangle({ x: lx, y: ly - 1, width: 9, height: 9, color: rgb(r, g, b), opacity: 0.6, borderColor: BORDER, borderWidth: 0.5 });
    page.drawText(feature.tractKey, { x: lx + 14, y: ly, size: 8, font, color: INK });
    page.drawText(feature.acres != null ? `${feature.acres}` : '—', { x: lx + 70, y: ly, size: 8, font, color: INK });
    page.drawText(legendByKey.get(feature.tractKey)?.landTractId ?? '—', { x: lx + 116, y: ly, size: 8, font, color: INK });
    ly -= 13;
  });

  return doc.save();
}

export async function downloadUnitPlatPdf(input: PlatPdfInput): Promise<void> {
  const bytes = await buildUnitPlatPdf(input);
  // Copy into a fresh ArrayBuffer-backed view so it is a clean BlobPart.
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${(input.projectName || 'workspace').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '-') || 'workspace'}-tract-plat.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
