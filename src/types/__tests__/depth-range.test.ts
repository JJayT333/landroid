import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DEPTH_RANGE,
  DEPTH_RANGE_OPTIONS,
  assertAllDepthsForMath,
  isUnsupportedDepthRange,
  normalizeDepthRange,
} from '../depth-range';
import { createBlankNode, normalizeOwnershipNode } from '../node';
import { createBlankLease, normalizeLease } from '../owner';
import {
  createBlankLeaseholdAssignment,
  createBlankLeaseholdOrri,
  normalizeLeaseholdAssignment,
  normalizeLeaseholdOrri,
} from '../leasehold';

describe('depth-range discriminator (Phase 5 ride-along)', () => {
  describe('normalizeDepthRange', () => {
    it('accepts every option in DEPTH_RANGE_OPTIONS', () => {
      for (const option of DEPTH_RANGE_OPTIONS) {
        expect(normalizeDepthRange(option)).toBe(option);
      }
    });

    it('trims whitespace on a recognized value', () => {
      expect(normalizeDepthRange('  all_depths  ')).toBe('all_depths');
    });

    it('falls back to the default for unknown strings', () => {
      expect(normalizeDepthRange('shallow')).toBe(DEFAULT_DEPTH_RANGE);
      expect(normalizeDepthRange('depth_5000_10000')).toBe(DEFAULT_DEPTH_RANGE);
    });

    it('falls back to the default for nullish, empty, and non-string input', () => {
      expect(normalizeDepthRange(undefined)).toBe(DEFAULT_DEPTH_RANGE);
      expect(normalizeDepthRange(null)).toBe(DEFAULT_DEPTH_RANGE);
      expect(normalizeDepthRange('')).toBe(DEFAULT_DEPTH_RANGE);
      expect(normalizeDepthRange(42)).toBe(DEFAULT_DEPTH_RANGE);
      expect(normalizeDepthRange({})).toBe(DEFAULT_DEPTH_RANGE);
      expect(normalizeDepthRange([])).toBe(DEFAULT_DEPTH_RANGE);
    });
  });

  describe('isUnsupportedDepthRange', () => {
    it('returns false for the default value', () => {
      expect(isUnsupportedDepthRange('all_depths')).toBe(false);
    });

    it('returns false for empty, nullish, and non-string input', () => {
      expect(isUnsupportedDepthRange('')).toBe(false);
      expect(isUnsupportedDepthRange('   ')).toBe(false);
      expect(isUnsupportedDepthRange(undefined)).toBe(false);
      expect(isUnsupportedDepthRange(null)).toBe(false);
      expect(isUnsupportedDepthRange(42)).toBe(false);
      expect(isUnsupportedDepthRange({})).toBe(false);
    });

    it('returns true for a recognizable future depth-severance shape', () => {
      // Phase 8 will accept richer shapes; until then they signal "warn the user".
      expect(isUnsupportedDepthRange('depth_5000_10000')).toBe(true);
      expect(isUnsupportedDepthRange('above_5000')).toBe(true);
    });
  });

  describe('assertAllDepthsForMath', () => {
    it('passes for the only currently-modeled value', () => {
      expect(() => assertAllDepthsForMath('all_depths')).not.toThrow();
    });

    it('throws for any other value (defense-in-depth)', () => {
      // The cast is intentional — this guard exists for the case where some
      // code path forgets to normalize before reaching the math layer.
      expect(() =>
        assertAllDepthsForMath('depth_5000_10000' as 'all_depths')
      ).toThrow(/Depth severance is not modeled/);
    });
  });

  describe('OwnershipNode carries depthRange', () => {
    it('createBlankNode defaults to all_depths', () => {
      const node = createBlankNode('node-1');
      expect(node.depthRange).toBe('all_depths');
    });

    it('normalizeOwnershipNode preserves recognized values', () => {
      const node = normalizeOwnershipNode({
        id: 'node-1',
        depthRange: 'all_depths',
      });
      expect(node.depthRange).toBe('all_depths');
    });

    it('normalizeOwnershipNode coerces unknown values back to the default', () => {
      const node = normalizeOwnershipNode({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        id: 'node-1',
        depthRange: 'depth_5000_10000' as 'all_depths',
      });
      expect(node.depthRange).toBe('all_depths');
    });

    it('normalizeOwnershipNode falls back to the default when missing', () => {
      const node = normalizeOwnershipNode({ id: 'node-1' });
      expect(node.depthRange).toBe('all_depths');
    });
  });

  describe('Lease carries depthRange', () => {
    it('createBlankLease defaults to all_depths', () => {
      const lease = createBlankLease('ws-1', 'owner-1');
      expect(lease.depthRange).toBe('all_depths');
    });

    it('createBlankLease coerces a junk override', () => {
      const lease = createBlankLease('ws-1', 'owner-1', {
        depthRange: 'depth_5000_10000' as 'all_depths',
      });
      expect(lease.depthRange).toBe('all_depths');
    });

    it('normalizeLease coerces non-string and unknown-string values', () => {
      const fromUnknownString = normalizeLease({
        id: 'lease-1',
        depthRange: 'shallow' as 'all_depths',
      });
      const fromMissing = normalizeLease({ id: 'lease-2' });
      expect(fromUnknownString.depthRange).toBe('all_depths');
      expect(fromMissing.depthRange).toBe('all_depths');
    });
  });

  describe('LeaseholdOrri carries depthRange', () => {
    it('createBlankLeaseholdOrri defaults to all_depths', () => {
      const orri = createBlankLeaseholdOrri();
      expect(orri.depthRange).toBe('all_depths');
    });

    it('normalizeLeaseholdOrri coerces unknown values', () => {
      const orri = normalizeLeaseholdOrri({
        id: 'orri-1',
        depthRange: 'depth_5000_10000',
      });
      expect(orri.depthRange).toBe('all_depths');
    });
  });

  describe('LeaseholdAssignment carries depthRange', () => {
    it('createBlankLeaseholdAssignment defaults to all_depths', () => {
      const assignment = createBlankLeaseholdAssignment();
      expect(assignment.depthRange).toBe('all_depths');
    });

    it('normalizeLeaseholdAssignment coerces unknown values', () => {
      const assignment = normalizeLeaseholdAssignment({
        id: 'assignment-1',
        depthRange: 'depth_5000_10000',
      });
      expect(assignment.depthRange).toBe('all_depths');
    });
  });
});
