import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  formatBatesLabel,
  normalizeBatesPrefix,
  stampBatesPdf,
} from '../bates-stamp';

async function makePdf(pageCount: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    pdf.addPage([612, 792]);
  }
  return pdf.save();
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  );
}

describe('formatBatesLabel', () => {
  it('zero-pads to the requested width', () => {
    expect(formatBatesLabel('LANDROID', 1, 6)).toBe('LANDROID000001');
    expect(formatBatesLabel('LANDROID', 1234, 6)).toBe('LANDROID001234');
  });

  it('does not truncate numbers wider than the pad', () => {
    expect(formatBatesLabel('X', 1234567, 6)).toBe('X1234567');
  });
});

describe('normalizeBatesPrefix', () => {
  it('keeps safe characters, uppercases, and drops the rest', () => {
    expect(normalizeBatesPrefix('Vulcan Mesa #1')).toBe('VULCANMESA1');
    expect(normalizeBatesPrefix('a_b-c.d')).toBe('A_B-C.D');
  });

  it('falls back when nothing usable remains', () => {
    expect(normalizeBatesPrefix('   ')).toBe('BATES');
    expect(normalizeBatesPrefix('@@@', 'PROD')).toBe('PROD');
  });
});

describe('stampBatesPdf', () => {
  it('stamps one sequential label per page and reports the range', async () => {
    const source = await makePdf(3);
    const result = await stampBatesPdf(source, {
      prefix: 'LANDROID',
      startNumber: 1,
      padWidth: 6,
    });

    expect(result.pageCount).toBe(3);
    expect(result.firstLabel).toBe('LANDROID000001');
    expect(result.lastLabel).toBe('LANDROID000003');
    // nextNumber chains the sequence into the following document.
    expect(result.nextNumber).toBe(4);
    expect(hasPdfMagic(result.bytes)).toBe(true);
  });

  it('continues a running sequence from a non-1 start', async () => {
    const source = await makePdf(2);
    const result = await stampBatesPdf(source, {
      prefix: 'LANDROID',
      startNumber: 4,
      padWidth: 6,
    });
    expect(result.firstLabel).toBe('LANDROID000004');
    expect(result.lastLabel).toBe('LANDROID000005');
    expect(result.nextNumber).toBe(6);
  });

  it('does not mutate the source bytes (production-copy model)', async () => {
    const source = await makePdf(1);
    const before = source.slice();
    await stampBatesPdf(source, { prefix: 'P', startNumber: 1, padWidth: 4 });
    expect(source).toEqual(before);
  });
});
