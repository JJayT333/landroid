import { describe, expect, it } from 'vitest';
import { d } from '../../../engine/decimal';
import { createBlankNode, type OwnershipNode } from '../../../types/node';
import { createBlankLease, createBlankOwner } from '../../../types/owner';
import {
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
} from '../leasehold-summary';

describe('leasehold-summary', () => {
  it('derives tract participation, owner acres, and weighted unit royalty', () => {
    const deskMaps = [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: 'T1',
        grossAcres: '100',
        pooledAcres: '80',
        description: 'North tract',
        nodeIds: ['n1', 'n2', 'l1', 'l2'],
      },
      {
        id: 'dm-2',
        name: 'Tract 2',
        code: 'T2',
        tractId: 'T2',
        grossAcres: '200',
        pooledAcres: '120',
        description: 'South tract',
        nodeIds: ['n3', 'n4', 'l3', 'l4'],
      },
    ];
    const owners = [
      createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' }),
      createBlankOwner('ws-1', { id: 'owner-2', name: 'B Owner' }),
      createBlankOwner('ws-1', { id: 'owner-3', name: 'C Owner' }),
      createBlankOwner('ws-1', { id: 'owner-4', name: 'D Owner' }),
    ];
    const nodes: OwnershipNode[] = [
      {
        ...createBlankNode('n1', null),
        grantee: 'A Owner',
        linkedOwnerId: 'owner-1',
        fraction: '0.5',
        initialFraction: '0.5',
      },
      {
        ...createBlankNode('n2', null),
        grantee: 'B Owner',
        linkedOwnerId: 'owner-2',
        fraction: '0.5',
        initialFraction: '0.5',
      },
      {
        ...createBlankNode('n3', null),
        grantee: 'C Owner',
        linkedOwnerId: 'owner-3',
        fraction: '0.25',
        initialFraction: '0.25',
      },
      {
        ...createBlankNode('n4', null),
        grantee: 'D Owner',
        linkedOwnerId: 'owner-4',
        fraction: '0.75',
        initialFraction: '0.75',
      },
      {
        ...createBlankNode('l1', 'n1'),
        type: 'related' as const,
        relatedKind: 'lease' as const,
      },
      {
        ...createBlankNode('l2', 'n2'),
        type: 'related' as const,
        relatedKind: 'lease' as const,
      },
      {
        ...createBlankNode('l3', 'n3'),
        type: 'related' as const,
        relatedKind: 'lease' as const,
      },
      {
        ...createBlankNode('l4', 'n4'),
        type: 'related' as const,
        relatedKind: 'lease' as const,
      },
    ];
    const leases = [
      createBlankLease('ws-1', 'owner-1', {
        id: 'lease-1',
        leaseName: 'A Lease',
        lessee: 'Operator A',
        royaltyRate: '1/8',
        leasedInterest: '0.5',
        effectiveDate: '2024-01-10',
        docNo: 'LEASE-1',
      }),
      createBlankLease('ws-1', 'owner-2', {
        id: 'lease-2',
        leaseName: 'B Lease',
        lessee: 'Operator A',
        royaltyRate: '1/8',
        leasedInterest: '0.5',
        effectiveDate: '2024-01-11',
        docNo: 'LEASE-2',
      }),
      createBlankLease('ws-1', 'owner-3', {
        id: 'lease-3',
        leaseName: 'C Lease',
        lessee: 'Operator A',
        royaltyRate: '1/8',
        leasedInterest: '0.25',
        effectiveDate: '2024-01-12',
        docNo: 'LEASE-3',
      }),
      createBlankLease('ws-1', 'owner-4', {
        id: 'lease-4',
        leaseName: 'D Lease',
        lessee: 'Operator A',
        royaltyRate: '1/8',
        leasedInterest: '0.75',
        effectiveDate: '2024-01-13',
        docNo: 'LEASE-4',
      }),
    ];

    const summary = buildLeaseholdUnitSummary({
      deskMaps,
      nodes,
      owners,
      leases,
      leaseholdAssignments: [
        {
          id: 'assignment-unit',
          assignor: 'Operator A',
          assignee: 'Unit Partner',
          scope: 'unit',
          deskMapId: null,
          workingInterestFraction: '1/2',
          effectiveDate: '2024-03-01',
          sourceDocNo: 'ASG-1',
          notes: '',
        },
        {
          id: 'assignment-tract',
          assignor: 'Operator A',
          assignee: 'Tract Partner',
          scope: 'tract',
          deskMapId: 'dm-2',
          workingInterestFraction: '1/4',
          effectiveDate: '2024-03-15',
          sourceDocNo: 'ASG-2',
          notes: '',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-unit',
          payee: 'Unit Override',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/16',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-1',
          notes: '',
        },
        {
          id: 'orri-tract',
          payee: 'Tract Override',
          scope: 'tract',
          deskMapId: 'dm-2',
          burdenFraction: '1/32',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-02',
          sourceDocNo: 'ORRI-2',
          notes: '',
        },
        {
          id: 'orri-unit-wi',
          payee: 'Unit WI Override',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/80',
          burdenBasis: 'working_interest',
          effectiveDate: '2024-01-03',
          sourceDocNo: 'ORRI-3',
          notes: '',
        },
        {
          id: 'orri-tract-nri',
          payee: 'Tracked NRI Override',
          scope: 'tract',
          deskMapId: 'dm-1',
          burdenFraction: '1/64',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-04',
          sourceDocNo: 'ORRI-4',
          notes: '',
        },
      ],
    });

    expect(summary.totalGrossAcres).toBe('300');
    expect(summary.totalPooledAcres).toBe('200');
    expect(summary.tractCount).toBe(2);
    expect(summary.fullyLeasedTractCount).toBe(2);
    expect(summary.totalRoyaltyDecimal).toBe('0.125');
    expect(summary.totalOrriDecimal).toBe('0.097197265625');
    expect(summary.preWorkingInterestDecimal).toBe('0.777802734375');
    expect(summary.totalAssignedWorkingInterestDecimal).toBe('0.5044482421875');
    expect(summary.retainedWorkingInterestDecimal).toBe('0.2733544921875');
    expect(summary.includedAssignmentCount).toBe(2);
    expect(summary.excludedAssignmentCount).toBe(0);
    expect(summary.includedOrriCount).toBe(4);
    expect(summary.excludedOrriCount).toBe(0);
    expect(summary.tracts[0]?.weightedRoyaltyRate).toBe('0.125');
    expect(summary.tracts[1]?.weightedRoyaltyRate).toBe('0.125');
    expect(summary.tracts[0]?.grossOrriBurdenRate).toBe('0.0625');
    expect(summary.tracts[1]?.grossOrriBurdenRate).toBe('0.09375');
    expect(summary.tracts[0]?.workingInterestOrriBurdenRate).toBe('0.0109375');
    expect(summary.tracts[1]?.workingInterestOrriBurdenRate).toBe('0.0109375');
    expect(summary.tracts[0]?.netRevenueInterestOrriBurdenRate).toBe('0.0125244140625');
    expect(summary.tracts[1]?.netRevenueInterestOrriBurdenRate).toBe('0');
    expect(summary.tracts[0]?.totalOrriBurdenRate).toBe('0.0859619140625');
    expect(summary.tracts[1]?.totalOrriBurdenRate).toBe('0.1046875');
    expect(Number(summary.tracts[0]?.unitParticipation)).toBeCloseTo(0.4, 12);
    expect(Number(summary.tracts[1]?.unitParticipation)).toBeCloseTo(0.6, 12);
    expect(Number(summary.tracts[0]?.unitRoyaltyDecimal)).toBeCloseTo(0.05, 12);
    expect(Number(summary.tracts[1]?.unitRoyaltyDecimal)).toBeCloseTo(0.075, 12);
    expect(Number(summary.tracts[0]?.unitOrriDecimal)).toBeCloseTo(0.034384765625, 12);
    expect(Number(summary.tracts[1]?.unitOrriDecimal)).toBeCloseTo(0.0628125, 12);
    expect(Number(summary.tracts[0]?.preWorkingInterestDecimal)).toBeCloseTo(0.315615234375, 12);
    expect(Number(summary.tracts[1]?.preWorkingInterestDecimal)).toBeCloseTo(0.4621875, 12);
    expect(Number(summary.tracts[0]?.assignedWorkingInterestDecimal)).toBeCloseTo(0.1578076171875, 12);
    expect(Number(summary.tracts[0]?.retainedWorkingInterestDecimal)).toBeCloseTo(0.1578076171875, 12);
    expect(Number(summary.tracts[1]?.assignedWorkingInterestDecimal)).toBeCloseTo(
      0.346640625,
      12
    );
    expect(Number(summary.tracts[1]?.retainedWorkingInterestDecimal)).toBeCloseTo(
      0.115546875,
      12
    );
    expect(summary.tracts[0]?.owners[0]).toEqual(
      expect.objectContaining({
        ownerName: 'A Owner',
        netMineralAcres: '50',
        netPooledAcres: '40',
        ownerTractRoyalty: '0.0625',
      })
    );
    expect(d(summary.tracts[0]?.owners[0]?.unitRoyaltyDecimal ?? '0').toNumber()).toBeCloseTo(0.025, 12);
    expect(summary.orris).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'orri-unit',
          includedInMath: true,
          unitDecimal: '0.0625',
        }),
        expect.objectContaining({
          id: 'orri-unit-wi',
          includedInMath: true,
          unitDecimal: '0.0109375',
        }),
        expect.objectContaining({
          id: 'orri-tract-nri',
          includedInMath: true,
          unitDecimal: '0.005009765625',
        }),
      ])
    );
    expect(summary.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'assignment-unit',
          includedInMath: true,
          unitDecimal: '0.3889013671875',
        }),
        expect.objectContaining({
          id: 'assignment-tract',
          includedInMath: true,
          unitDecimal: '0.115546875',
        }),
      ])
    );

    const tractRows = buildLeaseholdDecimalRows({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
      },
      unitSummary: summary,
      focusedDeskMapId: 'dm-2',
    });
    const unitRows = buildLeaseholdDecimalRows({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
      },
      unitSummary: summary,
      focusedDeskMapId: null,
    });

    expect(
      tractRows.reduce((sum, row) => sum.plus(d(row.decimal)), d(0)).toNumber()
    ).toBeCloseTo(0.6, 12);
    expect(
      unitRows.reduce((sum, row) => sum.plus(d(row.decimal)), d(0)).toNumber()
    ).toBeCloseTo(1, 12);
    expect(tractRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'royalty',
          payee: 'C Owner',
          effectiveDate: '2024-01-12',
          sourceDocNo: 'LEASE-3',
        }),
        expect.objectContaining({
          category: 'royalty',
          payee: 'D Owner',
        }),
        expect.objectContaining({
          category: 'orri',
          payee: 'Unit Override',
        }),
        expect.objectContaining({
          category: 'orri',
          payee: 'Unit WI Override',
        }),
        expect.objectContaining({
          category: 'retained_wi',
          payee: 'Operator A',
          decimal: '0.115546875',
        }),
        expect.objectContaining({
          category: 'assigned_wi',
          payee: 'Tract Partner',
          decimal: '0.115546875',
        }),
      ])
    );
    expect(unitRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'assigned_wi',
          payee: 'Unit Partner',
          decimal: '0.3889013671875',
        }),
        expect.objectContaining({
          category: 'retained_wi',
          payee: 'Operator A',
          decimal: '0.2733544921875',
        }),
      ])
    );

    const tractReview = buildLeaseholdTransferOrderReview({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
      },
      unitSummary: summary,
      focusedDeskMapId: 'dm-2',
    });

    expect(tractReview.totalDecimal).toBe('0.6');
    expect(tractReview.expectedDecimal).toBe('0.6');
    expect(tractReview.varianceDecimal).toBe('0');
    expect(tractReview.reviewableRowCount).toBe(7);
    expect(tractReview.rowsWithCompleteSource).toBe(7);
    expect(tractReview.rowsWithSourceGap).toBe(0);
    expect(tractReview.rowsMissingEffectiveDate).toBe(0);
    expect(tractReview.rowsMissingSourceDocNo).toBe(0);
    expect(tractReview.categorySummaries).toEqual([
      { category: 'royalty', rowCount: 2, totalDecimal: '0.075' },
      { category: 'orri', rowCount: 3, totalDecimal: '0.0628125' },
      { category: 'retained_wi', rowCount: 1, totalDecimal: '0.115546875' },
      { category: 'assigned_wi', rowCount: 2, totalDecimal: '0.346640625' },
    ]);
  });

  it('aggregates multiple active leases for a single owner into tract and unit royalty totals', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '80',
          description: 'Single tract',
          nodeIds: ['n1'],
        },
      ],
      nodes: [
        {
          ...createBlankNode('n1', null),
          grantee: 'A Owner',
          linkedOwnerId: 'owner-1',
          fraction: '0.5',
          initialFraction: '0.5',
        },
      ],
      owners: [createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' })],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'First Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '0.25',
          effectiveDate: '2024-01-01',
          docNo: 'LEASE-1',
        }),
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-2',
          leaseName: 'Second Lease',
          lessee: 'Operator B',
          royaltyRate: '1/4',
          leasedInterest: '0.25',
          effectiveDate: '2024-02-01',
          docNo: 'LEASE-2',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.totalRoyaltyDecimal).toBe('0.09375');
    expect(summary.fullyLeasedTractCount).toBe(1);
    expect(summary.tracts[0]?.owners[0]).toEqual(
      expect.objectContaining({
        netMineralAcres: '50',
        netPooledAcres: '40',
        activeLeaseCount: 2,
        ownerTractRoyalty: '0.09375',
        unitRoyaltyDecimal: '0.09375',
        lesseeNames: ['Operator A', 'Operator B'],
      })
    );
    expect(summary.tracts[0]?.owners[0]?.leaseSlices).toEqual([
      expect.objectContaining({
        leaseId: 'lease-1',
        leasedFraction: '0.25',
        ownerTractRoyalty: '0.03125',
      }),
      expect.objectContaining({
        leaseId: 'lease-2',
        leasedFraction: '0.25',
        ownerTractRoyalty: '0.0625',
      }),
    ]);
  });

  it('clamps retained WI at zero when assignments exceed 100% of a tract', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: 'Single tract',
          nodeIds: ['n1', 'l1'],
        },
      ],
      nodes: [
        {
          ...createBlankNode('n1', null),
          grantee: 'A Owner',
          linkedOwnerId: 'owner-1',
          fraction: '1',
          initialFraction: '1',
        },
        {
          ...createBlankNode('l1', 'n1'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
      ],
      owners: [createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' })],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'A Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [
        {
          id: 'assignment-unit',
          assignor: 'Operator A',
          assignee: 'Unit Partner',
          scope: 'unit',
          deskMapId: null,
          workingInterestFraction: '3/4',
          effectiveDate: '2024-03-01',
          sourceDocNo: 'ASG-1',
          notes: '',
        },
        {
          id: 'assignment-tract',
          assignor: 'Operator A',
          assignee: 'Tract Partner',
          scope: 'tract',
          deskMapId: 'dm-1',
          workingInterestFraction: '1/2',
          effectiveDate: '2024-03-15',
          sourceDocNo: 'ASG-2',
          notes: '',
        },
      ],
      leaseholdOrris: [],
    });

    expect(Number(summary.preWorkingInterestDecimal)).toBeCloseTo(0.875, 12);
    expect(Number(summary.totalAssignedWorkingInterestDecimal)).toBeCloseTo(1.09375, 12);
    expect(summary.retainedWorkingInterestDecimal).toBe('0');
    expect(summary.tracts[0]?.overAssigned).toBe(true);
    expect(summary.tracts[0]?.retainedWorkingInterestDecimal).toBe('0');

    const rows = buildLeaseholdDecimalRows({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
      },
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'retained_wi',
          payee: 'Operator A',
          decimal: '0',
        }),
      ])
    );

    const review = buildLeaseholdTransferOrderReview({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
      },
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    });

    expect(review.totalDecimal).toBe('1.21875');
    expect(review.expectedDecimal).toBe('1');
    expect(review.varianceDecimal).toBe('0.21875');
    expect(review.reviewableRowCount).toBe(3);
    expect(review.rowsWithCompleteSource).toBe(2);
    expect(review.rowsWithSourceGap).toBe(1);
    expect(review.rowsMissingEffectiveDate).toBe(1);
    expect(review.rowsMissingSourceDocNo).toBe(1);
  });
});
