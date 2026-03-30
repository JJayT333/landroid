import { describe, expect, it } from 'vitest';
import {
  buildRrcDelimitedTextPreview,
  parseKnownRrcDelimitedRecords,
} from '../rrc-delimited-text';

describe('rrc-delimited-text', () => {
  it('builds a readable preview from a headered RRC text file', () => {
    const text = [
      'PROFILE_NAME}WELLBORE_PROFILE_ID}PROFILE_CODE}OPERATOR_NAME}DISTRICT',
      '"TH1"} "1888844"} "HR"}"ROCKCLIFF ENERGY OPERATING III"}"06"}',
      '"TH1"} "1888831"} "HR"}"ROCKCLIFF ENERGY OPERATING III"}"06"}',
    ].join('\n');

    const preview = buildRrcDelimitedTextPreview(text, { maxRows: 10 });

    expect(preview).not.toBeNull();
    expect(preview?.hasHeaderRow).toBe(true);
    expect(preview?.columns).toEqual([
      'PROFILE_NAME',
      'WELLBORE_PROFILE_ID',
      'PROFILE_CODE',
      'OPERATOR_NAME',
      'DISTRICT',
    ]);
    expect(preview?.rows[0]).toEqual([
      'TH1',
      '1888844',
      'HR',
      'ROCKCLIFF ENERGY OPERATING III',
      '06',
    ]);
    expect(preview?.totalRowCount).toBe(2);
  });

  it('skips matching header rows when parsing known RRC column layouts', () => {
    const text = [
      'UNIVERSAL_DOC_NO}STATUS_NUMBER}TOTAL_DEPTH',
      'DOC-100}2026-0001}11200',
    ].join('\n');

    const parsed = parseKnownRrcDelimitedRecords(
      text,
      ['UNIVERSAL_DOC_NO', 'STATUS_NUMBER', 'TOTAL_DEPTH'] as const,
      'dp_drilling_permit_pending_test.txt'
    );

    expect(parsed.hasHeaderRow).toBe(true);
    expect(parsed.rows).toEqual([
      {
        UNIVERSAL_DOC_NO: 'DOC-100',
        STATUS_NUMBER: '2026-0001',
        TOTAL_DEPTH: '11200',
      },
    ]);
    expect(parsed.warnings).toEqual([]);
  });
});
