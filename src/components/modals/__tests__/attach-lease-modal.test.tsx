import { describe, expect, it } from 'vitest';
import { createBlankLease, type LeaseJurisdiction } from '../../../types/owner';
import { getAttachLeaseModalTexasMathError } from '../AttachLeaseModal';

describe('AttachLeaseModal Texas math guard', () => {
  it('blocks federal, private, and tribal leases from Desk Map math', () => {
    const blockedJurisdictions = ['federal', 'private', 'tribal'] satisfies LeaseJurisdiction[];
    for (const jurisdiction of blockedJurisdictions) {
      const lease = createBlankLease('ws-1', 'owner-1', { jurisdiction });

      expect(getAttachLeaseModalTexasMathError(lease)).toMatch(
        /Only Texas fee\/state leases/
      );
    }
  });

  it('allows Texas fee and Texas state leases', () => {
    const texasJurisdictions = ['tx_fee', 'tx_state'] satisfies LeaseJurisdiction[];
    for (const jurisdiction of texasJurisdictions) {
      const lease = createBlankLease('ws-1', 'owner-1', { jurisdiction });

      expect(getAttachLeaseModalTexasMathError(lease)).toBeNull();
    }
  });
});
