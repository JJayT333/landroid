import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../types/node';
import { createBlankLease, createBlankOwner } from '../../types/owner';
import { createBlankTitleIssue } from '../../types/title-issue';
import { buildLeaseholdUnitSummary } from '../../components/leasehold/leasehold-summary';
import {
  buildOwnerListRows,
  sortAndFilterOwnerListRows,
} from '../OwnerDatabaseView';
import {
  getTransferOrderEntryDisplayStatus,
  buildLeaseholdGraphTractDetail,
} from '../LeaseholdView';
import { buildDeskMapOwnerSearchMatches } from '../DeskMapView';
import { filterTitleIssues } from '../CurativeView';

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

  it('builds tract graph detail with branch-bound NPRIs and tract-relevant burdens', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '320',
          pooledAcres: '320',
          description: 'Leasehold graph tract',
          nodeIds: ['owner-1-node', 'owner-2-node', 'lease-1-node', 'npri-1', 'npri-2'],
        },
      ],
      nodes: [
        {
          ...createBlankNode('owner-1-node', null),
          grantee: 'Alpha Minerals',
          linkedOwnerId: 'owner-1',
          fraction: '0.5',
          initialFraction: '0.5',
        },
        {
          ...createBlankNode('owner-2-node', null),
          grantee: 'Bravo Minerals',
          linkedOwnerId: 'owner-2',
          fraction: '0.5',
          initialFraction: '0.5',
        },
        {
          ...createBlankNode('lease-1-node', 'owner-1-node'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
        {
          ...createBlankNode('npri-1', 'owner-1-node'),
          grantee: 'Fixed NPRI Owner',
          fraction: '0.0625',
          interestClass: 'npri' as const,
          royaltyKind: 'fixed' as const,
        },
        {
          ...createBlankNode('npri-2', 'owner-2-node'),
          grantee: 'Floating NPRI Owner',
          fraction: '0.5',
          interestClass: 'npri' as const,
          royaltyKind: 'floating' as const,
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'Alpha Minerals' }),
        createBlankOwner('ws-1', { id: 'owner-2', name: 'Bravo Minerals' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'Alpha Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '0.5',
          effectiveDate: '2024-01-01',
          docNo: 'L-1',
        }),
      ],
      leaseholdAssignments: [
        {
          id: 'assignment-1',
          assignor: 'Operator A',
          assignee: 'Working Interest Partner',
          scope: 'unit',
          deskMapId: null,
          workingInterestFraction: '1/2',
          effectiveDate: '2024-03-01',
          sourceDocNo: 'ASG-1',
          notes: '',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-1',
          payee: 'Override Owner',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/80',
          burdenBasis: 'working_interest',
          effectiveDate: '2024-02-01',
          sourceDocNo: 'ORRI-1',
          notes: '',
        },
      ],
    });

    const detail = buildLeaseholdGraphTractDetail({
      tract: summary.tracts[0]!,
      unitSummary: summary,
    });

    expect(detail.ownerBranches).toHaveLength(2);
    expect(detail.ownerBranches[0]?.owner.ownerName).toBe('Alpha Minerals');
    expect(detail.ownerBranches[0]?.leaseSlices).toHaveLength(1);
    expect(detail.ownerBranches[0]?.npris.map((npri) => npri.id)).toEqual(['npri-1']);
    expect(detail.ownerBranches[0]?.npris[0]?.includedInMath).toBe(true);
    expect(detail.ownerBranches[1]?.owner.ownerName).toBe('Bravo Minerals');
    expect(detail.ownerBranches[1]?.leaseSlices).toHaveLength(0);
    expect(detail.ownerBranches[1]?.npris.map((npri) => npri.id)).toEqual(['npri-2']);
    expect(detail.ownerBranches[1]?.npris[0]?.includedInMath).toBe(false);
    expect(detail.orris.map((orri) => orri.id)).toEqual(['orri-1']);
    expect(detail.assignments.map((assignment) => assignment.id)).toEqual(['assignment-1']);
  });

  it('finds mineral owners across desk maps and skips NPRI or lease cards', () => {
    const mineralA = {
      ...createBlankNode('mineral-a', null),
      grantee: 'Alice Whitaker',
      interestClass: 'mineral' as const,
      fraction: '0.5',
      initialFraction: '0.5',
    };
    const npri = {
      ...createBlankNode('npri-a', 'mineral-a'),
      grantee: 'Alice Royalty',
      interestClass: 'npri' as const,
      royaltyKind: 'fixed' as const,
      fraction: '0.0625',
      initialFraction: '0.0625',
    };
    const lease = {
      ...createBlankNode('lease-a', 'mineral-a'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      grantee: 'Alice Lease',
    };
    const mineralB = {
      ...createBlankNode('mineral-b', null),
      grantee: 'Alice Sutton',
      interestClass: 'mineral' as const,
      fraction: '0.5',
      initialFraction: '0.5',
    };

    const matches = buildDeskMapOwnerSearchMatches({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '160',
          pooledAcres: '160',
          description: '',
          nodeIds: ['mineral-a', 'npri-a', 'lease-a'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: 'T2',
          grossAcres: '320',
          pooledAcres: '320',
          description: '',
          nodeIds: ['mineral-b'],
        },
      ],
      nodes: [mineralA, npri, lease, mineralB],
      query: 'alice',
    });

    expect(matches).toEqual([
      {
        deskMapId: 'dm-1',
        deskMapName: 'Tract 1',
        nodeId: 'mineral-a',
        ownerName: 'Alice Whitaker',
      },
      {
        deskMapId: 'dm-2',
        deskMapName: 'Tract 2',
        nodeId: 'mineral-b',
        ownerName: 'Alice Sutton',
      },
    ]);
  });

  it('filters curative issues by linked owner, tract, and status text', () => {
    const owner = createBlankOwner('ws-1', {
      id: 'owner-1',
      name: 'Ada Blackbird',
    });
    const lease = createBlankLease('ws-1', owner.id, {
      id: 'lease-1',
      leaseName: 'Ada Lease',
      docNo: 'L-1',
    });
    const branch = {
      ...createBlankNode('node-1'),
      grantee: 'Ada Blackbird',
      fraction: '1',
      initialFraction: '1',
    };
    const issues = [
      createBlankTitleIssue('ws-1', {
        id: 'issue-1',
        title: 'Missing heirship affidavit',
        issueType: 'Probate / heirship',
        status: 'Open',
        priority: 'High',
        affectedDeskMapId: 'dm-1',
        affectedNodeId: branch.id,
        affectedOwnerId: owner.id,
        affectedLeaseId: lease.id,
      }),
      createBlankTitleIssue('ws-1', {
        id: 'issue-2',
        title: 'Old lien release found',
        status: 'Resolved',
        priority: 'Low',
      }),
    ];

    const filtered = filterTitleIssues(issues, {
      searchQuery: 'ada lease',
      statusFilter: 'active',
      priorityFilter: 'all',
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '160',
          pooledAcres: '160',
          description: '',
          nodeIds: [branch.id],
        },
      ],
      nodes: [branch],
      owners: [owner],
      leases: [lease],
    });

    expect(filtered.map((issue) => issue.id)).toEqual(['issue-1']);
  });
});
