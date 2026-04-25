import { describe, expect, it } from 'vitest';
import {
  FILE_SIZE_LIMITS,
  assertFileSize,
  formatBytes,
  limitForExtension,
} from '../file-validation';

function makeFile(name: string, sizeBytes: number): File {
  // Use a zero-filled buffer; File only needs a valid size.
  const blob = new Blob([new Uint8Array(sizeBytes)]);
  return new File([blob], name);
}

describe('file-validation', () => {
  describe('formatBytes', () => {
    it('renders small values in bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(512)).toBe('512 B');
    });
    it('renders mid values in KB with one decimal', () => {
      expect(formatBytes(2048)).toBe('2.0 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });
    it('renders large values in MB with one decimal', () => {
      expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    });
  });

  describe('assertFileSize', () => {
    it('does not throw when file is under the cap', () => {
      const f = makeFile('tiny.csv', 100);
      expect(() => assertFileSize(f, 1024, 'CSV')).not.toThrow();
    });
    it('does not throw at the exact cap', () => {
      const f = makeFile('edge.csv', 1024);
      expect(() => assertFileSize(f, 1024, 'CSV')).not.toThrow();
    });
    it('throws with label and sizes when file exceeds the cap', () => {
      const f = makeFile('big.csv', 2048);
      expect(() => assertFileSize(f, 1024, 'CSV')).toThrow(/CSV is too large/);
      expect(() => assertFileSize(f, 1024, 'CSV')).toThrow(/2\.0 KB/);
      expect(() => assertFileSize(f, 1024, 'CSV')).toThrow(/1\.0 KB/);
    });
  });

  describe('limitForExtension', () => {
    it('maps .landroid to the workspace cap', () => {
      expect(limitForExtension('project.landroid')).toEqual({
        bytes: FILE_SIZE_LIMITS.LANDROID,
        label: '.landroid file',
      });
    });
    it('maps spreadsheet extensions case-insensitively', () => {
      expect(limitForExtension('DATA.CSV').bytes).toBe(FILE_SIZE_LIMITS.SPREADSHEET);
      expect(limitForExtension('Report.Xlsx').bytes).toBe(FILE_SIZE_LIMITS.SPREADSHEET);
      expect(limitForExtension('old.xls').bytes).toBe(FILE_SIZE_LIMITS.SPREADSHEET);
    });
    it('maps pdf to the pdf cap', () => {
      expect(limitForExtension('lease.pdf')).toEqual({
        bytes: FILE_SIZE_LIMITS.PDF,
        label: 'PDF',
      });
    });
    it('maps image extensions to the image cap', () => {
      for (const ext of ['png', 'jpg', 'jpeg']) {
        expect(limitForExtension(`map.${ext}`).bytes).toBe(FILE_SIZE_LIMITS.IMAGE);
      }
    });
    it('maps geojson/json to the geojson cap', () => {
      expect(limitForExtension('boundary.geojson').bytes).toBe(FILE_SIZE_LIMITS.GEOJSON);
      expect(limitForExtension('export.json').bytes).toBe(FILE_SIZE_LIMITS.GEOJSON);
    });
    it('falls back to the pdf cap for unknown extensions', () => {
      const fallback = limitForExtension('mystery.xyz');
      expect(fallback.bytes).toBe(FILE_SIZE_LIMITS.PDF);
      expect(fallback.label).toBe('file');
    });
  });
});
