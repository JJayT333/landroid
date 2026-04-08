import { describe, expect, it } from 'vitest';
import { deriveCounty } from '../land';

describe('deriveCounty', () => {
  describe('recognized patterns', () => {
    it('extracts single-word Texas counties', () => {
      expect(deriveCounty('Section 1, Block 2, T1N R1E, Reeves County, Texas')).toBe(
        'Reeves'
      );
      expect(deriveCounty('Loving County, TX')).toBe('Loving');
      expect(deriveCounty('Ward County, Texas')).toBe('Ward');
    });

    it('extracts multi-word counties', () => {
      expect(deriveCounty('La Salle County, Texas')).toBe('La Salle');
      expect(deriveCounty('Jim Wells County')).toBe('Jim Wells');
      expect(deriveCounty('Palo Pinto County, Texas')).toBe('Palo Pinto');
    });

    it('extracts mixed-case county names', () => {
      expect(deriveCounty('DeWitt County, Texas')).toBe('DeWitt');
      expect(deriveCounty('McMullen County, Texas')).toBe('McMullen');
    });

    it('handles lowercase "county" keyword', () => {
      expect(deriveCounty('reeves county, texas')).toBe('reeves');
    });

    it('handles uppercase "COUNTY" keyword', () => {
      expect(deriveCounty('REEVES COUNTY, TEXAS')).toBe('REEVES');
    });

    it('tolerates extra whitespace around the county name', () => {
      expect(deriveCounty('Survey A-123,   Reeves   County, Texas')).toBe('Reeves');
    });

    it('only matches "County" as a whole word', () => {
      // Countywide-something should not trip the match.
      expect(deriveCounty('Upton Countywide Road, Texas')).toBe('');
    });

    it('captures preceding in-class words up to the nearest wall character', () => {
      // Behavior pin / gotcha: the character class [A-Za-z .'-] includes space,
      // so the non-greedy match walks BACKWARD through letters and spaces until
      // it hits a "wall" (any char not in the class — digit, comma, paren, etc).
      // For 'Originally in Reeves County, ...' there is no wall between
      // 'Originally' and 'Reeves', so the capture ends up as 'Originally in Reeves'
      // rather than just 'Reeves'. This is a known limitation: callers who need
      // a clean county token should pass a clause-bounded substring.
      expect(deriveCounty('Originally in Reeves County, abutting Ward County line')).toBe(
        'Originally in Reeves'
      );
      // A digit or comma right before the county name acts as the wall and
      // produces the expected single-word capture:
      expect(deriveCounty('Tract 1, Reeves County, Texas')).toBe('Reeves');
    });
  });

  describe('no match', () => {
    it('returns an empty string when no county is present', () => {
      expect(deriveCounty('Section 1, Block 2, T1N R1E, Texas')).toBe('');
      expect(deriveCounty('just some land description')).toBe('');
    });

    it('returns an empty string for empty input', () => {
      expect(deriveCounty('')).toBe('');
    });

    it('returns an empty string when "County" appears without a preceding name', () => {
      expect(deriveCounty('County line road')).toBe('');
    });
  });
});
