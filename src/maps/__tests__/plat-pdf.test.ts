import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildUnitPlatPdf } from '../plat-pdf';
import { normalizeMapTractFeature } from '../../types/map-tract-feature';

function feature(id: string, tractKey: string, matchedDeskMapId: string | null = null) {
  return normalizeMapTractFeature({
    id,
    workspaceId: 'ws',
    assetId: 'asset',
    tractKey,
    acres: 110,
    acresText: '110 ac',
    polygons: [{ outer: [[-95, 30], [-94, 30], [-94, 31], [-95, 31]], holes: [] }],
    bbox: [-95, 30, -94, 31],
    matchedDeskMapId,
  });
}

describe('buildUnitPlatPdf', () => {
  it('produces a valid one-page US-Letter-landscape PDF', async () => {
    const bytes = await buildUnitPlatPdf({
      projectName: 'Vulcan Mesa Unit',
      generatedAt: '2026-06-16',
      tractFeatures: [feature('f1', '1', 'dm-1'), feature('f2', '2', null)],
      legend: [{ tractKey: '1', landTractId: 'LAND-1' }],
    });

    expect(bytes.byteLength).toBeGreaterThan(800);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(792);
    expect(Math.round(height)).toBe(612);
  });

  it('renders a title-only page for an empty feature set without throwing', async () => {
    const bytes = await buildUnitPlatPdf({
      projectName: 'X',
      generatedAt: '2026-06-16',
      tractFeatures: [],
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});
