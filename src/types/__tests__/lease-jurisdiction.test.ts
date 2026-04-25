import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEASE_STATUS,
  DEFAULT_LEASE_JURISDICTION,
  LEASE_JURISDICTION_OPTIONS,
  LEASE_STATUS_OPTIONS,
  createBlankLease,
  isInactiveLeaseStatus,
  isTexasMathLease,
  isTexasMathLeaseJurisdiction,
  normalizeLease,
  normalizeLeaseJurisdiction,
  normalizeLeaseStatus,
} from '../owner';
import {
  createBlankLeaseholdUnit,
  normalizeLeaseholdUnit,
} from '../leasehold';

describe('lease jurisdiction discriminator', () => {
  describe('lease status normalization', () => {
    it('accepts every option in LEASE_STATUS_OPTIONS', () => {
      for (const option of LEASE_STATUS_OPTIONS) {
        expect(normalizeLeaseStatus(option)).toBe(option);
      }
    });

    it('canonicalizes known statuses regardless of whitespace or case', () => {
      expect(normalizeLeaseStatus('  expired  ')).toBe('Expired');
      expect(normalizeLeaseStatus('released')).toBe('Released');
      expect(normalizeLeaseStatus('TERMINATED')).toBe('Terminated');
    });

    it('preserves non-empty legacy status text instead of discarding it', () => {
      expect(normalizeLeaseStatus(' Held by Production ')).toBe('Held by Production');
    });

    it('falls back to Active for nullish, empty, and non-string input', () => {
      expect(normalizeLeaseStatus(undefined)).toBe('Active');
      expect(normalizeLeaseStatus(null)).toBe('Active');
      expect(normalizeLeaseStatus('')).toBe('Active');
      expect(normalizeLeaseStatus(42)).toBe('Active');
      expect(normalizeLeaseStatus({})).toBe('Active');
      expect(normalizeLeaseStatus([])).toBe('Active');
    });

    it('classifies inactive lease statuses centrally for coverage math', () => {
      expect(isInactiveLeaseStatus('Expired')).toBe(true);
      expect(isInactiveLeaseStatus(' released ')).toBe(true);
      expect(isInactiveLeaseStatus('cancelled')).toBe(true);
      expect(isInactiveLeaseStatus('Held by Production')).toBe(false);
      expect(isInactiveLeaseStatus(undefined)).toBe(false);
    });

    it('exposes Active as the documented default constant', () => {
      expect(DEFAULT_LEASE_STATUS).toBe('Active');
    });
  });

  describe('normalizeLeaseJurisdiction', () => {
    it('accepts every option in LEASE_JURISDICTION_OPTIONS', () => {
      for (const option of LEASE_JURISDICTION_OPTIONS) {
        expect(normalizeLeaseJurisdiction(option)).toBe(option);
      }
    });

    it('trims surrounding whitespace before matching', () => {
      expect(normalizeLeaseJurisdiction('  tx_state  ')).toBe('tx_state');
    });

    it('falls back to tx_fee for unknown strings', () => {
      expect(normalizeLeaseJurisdiction('fee')).toBe('tx_fee');
      expect(normalizeLeaseJurisdiction('TX_FEE')).toBe('tx_fee');
      expect(normalizeLeaseJurisdiction('blm')).toBe('tx_fee');
    });

    it('falls back to tx_fee for nullish, empty, and non-string input', () => {
      expect(normalizeLeaseJurisdiction(undefined)).toBe('tx_fee');
      expect(normalizeLeaseJurisdiction(null)).toBe('tx_fee');
      expect(normalizeLeaseJurisdiction('')).toBe('tx_fee');
      expect(normalizeLeaseJurisdiction(42)).toBe('tx_fee');
      expect(normalizeLeaseJurisdiction({})).toBe('tx_fee');
      expect(normalizeLeaseJurisdiction([])).toBe('tx_fee');
    });

    it('exposes tx_fee as the documented default constant', () => {
      expect(DEFAULT_LEASE_JURISDICTION).toBe('tx_fee');
    });

    it('identifies only Texas fee/state leases as active math jurisdictions', () => {
      expect(isTexasMathLeaseJurisdiction('tx_fee')).toBe(true);
      expect(isTexasMathLeaseJurisdiction('tx_state')).toBe(true);
      expect(isTexasMathLeaseJurisdiction('federal')).toBe(false);
      expect(isTexasMathLeaseJurisdiction('private')).toBe(false);
      expect(isTexasMathLeaseJurisdiction('tribal')).toBe(false);

      expect(
        isTexasMathLease(createBlankLease('ws-1', 'owner-1', { jurisdiction: 'tx_state' }))
      ).toBe(true);
      expect(
        isTexasMathLease(createBlankLease('ws-1', 'owner-1', { jurisdiction: 'federal' }))
      ).toBe(false);
    });
  });

  describe('createBlankLease', () => {
    it('defaults a brand-new lease to tx_fee', () => {
      const lease = createBlankLease('ws-1', 'owner-1');
      expect(lease.jurisdiction).toBe('tx_fee');
      expect(lease.status).toBe('Active');
    });

    it('preserves a valid jurisdiction override', () => {
      const lease = createBlankLease('ws-1', 'owner-1', {
        jurisdiction: 'tx_state',
      });
      expect(lease.jurisdiction).toBe('tx_state');
    });

    it('coerces a junk jurisdiction override back to tx_fee', () => {
      // The override path is the most likely place for a stale import shape
      // (for instance, a future migration that hands us {jurisdiction: 'fee'}).
      const lease = createBlankLease('ws-1', 'owner-1', {
        // @ts-expect-error — exercise the runtime guard against bad data
        jurisdiction: 'fee',
      });
      expect(lease.jurisdiction).toBe('tx_fee');
    });

    it('preserves trimmed legacy status text when supplied by existing data', () => {
      const lease = createBlankLease('ws-1', 'owner-1', {
        status: ' Held by Production ',
      });
      expect(lease.status).toBe('Held by Production');
    });
  });

  describe('normalizeLease', () => {
    it('migrates a legacy lease record that omits jurisdiction', () => {
      const legacy = {
        id: 'lease-1',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        leaseName: 'Legacy Lease',
        lessee: 'Acme',
        royaltyRate: '1/8',
        leasedInterest: '0.5',
        effectiveDate: '',
        expirationDate: '',
        status: 'Active',
        docNo: '',
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const normalized = normalizeLease(legacy);
      expect(normalized.jurisdiction).toBe('tx_fee');
      expect(normalized.status).toBe('Active');
    });

    it('preserves a valid jurisdiction value during normalization', () => {
      const normalized = normalizeLease({
        id: 'lease-2',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        jurisdiction: 'private',
      });
      expect(normalized.jurisdiction).toBe('private');
    });

    it('coerces an invalid jurisdiction string back to tx_fee', () => {
      const normalized = normalizeLease({
        id: 'lease-3',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        // @ts-expect-error — exercise the runtime guard against bad data
        jurisdiction: 'BLM',
      });
      expect(normalized.jurisdiction).toBe('tx_fee');
    });

    it('canonicalizes known status text during normalization', () => {
      const normalized = normalizeLease({
        id: 'lease-4',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        status: ' expired ',
      });
      expect(normalized.status).toBe('Expired');
    });

    it('preserves non-canonical legacy status text during normalization', () => {
      const normalized = normalizeLease({
        id: 'lease-5',
        workspaceId: 'ws-1',
        ownerId: 'owner-1',
        status: ' Held by Production ',
      });
      expect(normalized.status).toBe('Held by Production');
    });
  });

  describe('createBlankLeaseholdUnit', () => {
    it('defaults a brand-new unit to tx_fee', () => {
      const unit = createBlankLeaseholdUnit();
      expect(unit.jurisdiction).toBe('tx_fee');
    });

    it('preserves a valid jurisdiction override', () => {
      const unit = createBlankLeaseholdUnit({ jurisdiction: 'federal' });
      expect(unit.jurisdiction).toBe('federal');
    });

    it('coerces a junk jurisdiction override back to tx_fee', () => {
      const unit = createBlankLeaseholdUnit({
        // @ts-expect-error — exercise the runtime guard against bad data
        jurisdiction: 'state',
      });
      expect(unit.jurisdiction).toBe('tx_fee');
    });
  });

  describe('normalizeLeaseholdUnit', () => {
    it('migrates a legacy unit payload that omits jurisdiction', () => {
      const normalized = normalizeLeaseholdUnit({
        name: 'Raven Bend Unit',
        description: 'desc',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
      });
      expect(normalized.jurisdiction).toBe('tx_fee');
    });

    it('preserves a valid jurisdiction value during normalization', () => {
      const normalized = normalizeLeaseholdUnit({
        name: 'Raven Bend Unit',
        description: '',
        operator: '',
        effectiveDate: '',
        jurisdiction: 'tx_state',
      });
      expect(normalized.jurisdiction).toBe('tx_state');
    });

    it('coerces an invalid jurisdiction value back to tx_fee', () => {
      const normalized = normalizeLeaseholdUnit({
        name: 'Raven Bend Unit',
        description: '',
        operator: '',
        effectiveDate: '',
        jurisdiction: 'glo',
      });
      expect(normalized.jurisdiction).toBe('tx_fee');
    });

    it('returns a tx_fee blank unit for non-object input', () => {
      expect(normalizeLeaseholdUnit(null).jurisdiction).toBe('tx_fee');
      expect(normalizeLeaseholdUnit(undefined).jurisdiction).toBe('tx_fee');
      expect(normalizeLeaseholdUnit('garbage').jurisdiction).toBe('tx_fee');
      expect(normalizeLeaseholdUnit([]).jurisdiction).toBe('tx_fee');
    });
  });
});
