import { describe, expect, it } from 'vitest';
import { createBlankLease, createBlankOwner } from '../../types/owner';
import {
  buildOwnerListRows,
  sortAndFilterOwnerListRows,
} from '../OwnerDatabaseView';
import { getTransferOrderEntryDisplayStatus } from '../LeaseholdView';

describe('view helpers', () => {
  it('forces ready transfer-order rows into hold while payout hold is active', () => {
    expect(getTransferOrderEntryDisplayStatus('ready', true)).toBe('hold');
    expect(getTransferOrderEntryDisplayStatus('hold', true)).toBe('hold');
    expect(getTransferOrderEntryDisplayStatus('draft', true)).toBe('draft');
    expect(getTransferOrderEntryDisplayStatus(undefined, true)).toBe('hold');
    expect(getTransferOrderEntryDisplayStatus(undefined, false)).toBe('draft');
  });

  it('sorts owners by active lease count and lets search match lease text', () => {
    const owners = [
      createBlankOwner('ws-1', {
        id: 'owner-a',
        name: 'Alpha Minerals',
        county: 'Reeves',
        prospect: 'Wolfcamp',
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
      createBlankOwner('ws-1', {
        id: 'owner-b',
        name: 'Bravo Holdings',
        county: 'Loving',
        prospect: 'Bone Spring',
        updatedAt: '2024-03-01T00:00:00.000Z',
      }),
      createBlankOwner('ws-1', {
        id: 'owner-c',
        name: 'Charlie Ranch',
        updatedAt: '2024-02-01T00:00:00.000Z',
      }),
    ];
    const leases = [
      createBlankLease('ws-1', 'owner-a', {
        id: 'lease-a',
        leaseName: 'Alpha Lease',
        lessee: 'Operator A',
        status: 'Active',
      }),
      createBlankLease('ws-1', 'owner-b', {
        id: 'lease-b1',
        leaseName: 'Bravo Lease 1',
        lessee: 'Operator B',
        status: 'Active',
      }),
      createBlankLease('ws-1', 'owner-b', {
        id: 'lease-b2',
        leaseName: 'Bravo Lease 2',
        lessee: 'Operator B',
        status: 'Active',
      }),
      createBlankLease('ws-1', 'owner-c', {
        id: 'lease-c',
        leaseName: 'Charlie Lease',
        lessee: 'Operator C',
        status: 'Released',
      }),
    ];

    const rows = buildOwnerListRows(owners, leases);
    const sorted = sortAndFilterOwnerListRows(rows, '', 'active_leases');
    const filtered = sortAndFilterOwnerListRows(rows, 'operator b', 'name_asc');

    expect(sorted.map((row) => row.owner.id)).toEqual(['owner-b', 'owner-a', 'owner-c']);
    expect(filtered.map((row) => row.owner.id)).toEqual(['owner-b']);
  });
});
