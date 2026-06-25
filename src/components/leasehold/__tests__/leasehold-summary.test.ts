import { describe, expect, it } from 'vitest';
import { d } from '../../../engine/decimal';
import { createBlankNode, type OwnershipNode } from '../../../types/node';
import { createBlankLease, createBlankOwner } from '../../../types/owner';
import {
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderHoldReasons,
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
} from '../../../title-math';
import { getTransferOrderEntryDisplayStatus } from '../../../views/LeaseholdView';

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
          depthRange: 'all_depths',
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
          depthRange: 'all_depths',
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
          depthRange: 'all_depths',
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
          depthRange: 'all_depths',
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
          depthRange: 'all_depths',
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
          depthRange: 'all_depths',
        },
      ],
    });

    expect(summary.totalGrossAcres).toBe('300');
    expect(summary.totalPooledAcres).toBe('200');
    expect(summary.tractCount).toBe(2);
    expect(summary.fullyLeasedTractCount).toBe(2);
    expect(summary.totalRoyaltyDecimal).toBe('0.125');
    expect(summary.totalOrriDecimal).toBe('0.09875');
    expect(summary.preWorkingInterestDecimal).toBe('0.77625');
    expect(summary.totalAssignedWorkingInterestDecimal).toBe('0.5034375');
    expect(summary.retainedWorkingInterestDecimal).toBe('0.2728125');
    expect(summary.includedAssignmentCount).toBe(2);
    expect(summary.excludedAssignmentCount).toBe(0);
    expect(summary.includedOrriCount).toBe(4);
    expect(summary.excludedOrriCount).toBe(0);
    expect(summary.tracts[0]?.weightedRoyaltyRate).toBe('0.125');
    expect(summary.tracts[1]?.weightedRoyaltyRate).toBe('0.125');
    expect(summary.tracts[0]?.grossOrriBurdenRate).toBe('0.0625');
    expect(summary.tracts[1]?.grossOrriBurdenRate).toBe('0.09375');
    // WI-basis ORRI = leasedOwnership × share, independent of royalty rate
    expect(summary.tracts[0]?.workingInterestOrriBurdenRate).toBe('0.0125');
    expect(summary.tracts[1]?.workingInterestOrriBurdenRate).toBe('0.0125');
    expect(summary.tracts[0]?.netRevenueInterestOrriBurdenRate).toBe('0.0125');
    expect(summary.tracts[1]?.netRevenueInterestOrriBurdenRate).toBe('0');
    expect(summary.tracts[0]?.totalOrriBurdenRate).toBe('0.0875');
    expect(summary.tracts[1]?.totalOrriBurdenRate).toBe('0.10625');
    expect(Number(summary.tracts[0]?.unitParticipation)).toBeCloseTo(0.4, 12);
    expect(Number(summary.tracts[1]?.unitParticipation)).toBeCloseTo(0.6, 12);
    expect(Number(summary.tracts[0]?.unitRoyaltyDecimal)).toBeCloseTo(0.05, 12);
    expect(Number(summary.tracts[1]?.unitRoyaltyDecimal)).toBeCloseTo(0.075, 12);
    expect(Number(summary.tracts[0]?.unitOrriDecimal)).toBeCloseTo(0.035, 12);
    expect(Number(summary.tracts[1]?.unitOrriDecimal)).toBeCloseTo(0.06375, 12);
    expect(Number(summary.tracts[0]?.preWorkingInterestDecimal)).toBeCloseTo(0.315, 12);
    expect(Number(summary.tracts[1]?.preWorkingInterestDecimal)).toBeCloseTo(0.46125, 12);
    expect(Number(summary.tracts[0]?.assignedWorkingInterestDecimal)).toBeCloseTo(0.1575, 12);
    expect(Number(summary.tracts[0]?.retainedWorkingInterestDecimal)).toBeCloseTo(0.1575, 12);
    expect(Number(summary.tracts[1]?.assignedWorkingInterestDecimal)).toBeCloseTo(
      0.3459375,
      12
    );
    expect(Number(summary.tracts[1]?.retainedWorkingInterestDecimal)).toBeCloseTo(
      0.1153125,
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
          unitDecimal: '0.0125',
        }),
        expect.objectContaining({
          id: 'orri-tract-nri',
          includedInMath: true,
          unitDecimal: '0.005',
        }),
      ])
    );
    expect(summary.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'assignment-unit',
          includedInMath: true,
          unitDecimal: '0.388125',
        }),
        expect.objectContaining({
          id: 'assignment-tract',
          includedInMath: true,
          unitDecimal: '0.1153125',
        }),
      ])
    );

    const tractRows = buildLeaseholdDecimalRows({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
        jurisdiction: 'tx_fee',
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
        jurisdiction: 'tx_fee',
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
          decimal: '0.1153125',
        }),
        expect.objectContaining({
          category: 'assigned_wi',
          payee: 'Tract Partner',
          decimal: '0.1153125',
        }),
      ])
    );
    expect(unitRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'assigned_wi',
          payee: 'Unit Partner',
          decimal: '0.388125',
        }),
        expect.objectContaining({
          category: 'retained_wi',
          payee: 'Operator A',
          decimal: '0.2728125',
        }),
      ])
    );

    const tractReview = buildLeaseholdTransferOrderReview({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
        jurisdiction: 'tx_fee',
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
      { category: 'orri', rowCount: 3, totalDecimal: '0.06375' },
      { category: 'retained_wi', rowCount: 1, totalDecimal: '0.1153125' },
      { category: 'assigned_wi', rowCount: 2, totalDecimal: '0.3459375' },
    ]);

    // DA-H9: the Map-mode ORRI branch-card Total is this tract's own unit-level
    // ORRI burden (unitParticipation × totalOrriBurdenRate), NOT the sum of each
    // ORRI's unitDecimal. Unit-scope ORRIs are aggregated across every scoped
    // tract, so summing them under one tract double-counts the unit burden.
    const dm1BranchTotal = d(summary.tracts[0]?.unitOrriDecimal ?? '0');
    expect(dm1BranchTotal.toNumber()).toBeCloseTo(0.035, 12);
    expect(dm1BranchTotal.toNumber()).toBeCloseTo(
      d(summary.tracts[0]?.unitParticipation ?? '0')
        .times(summary.tracts[0]?.totalOrriBurdenRate ?? '0')
        .toNumber(),
      12
    );
    // The old branch card summed unit-scope ORRI unitDecimals (0.0625 + 0.0125),
    // which over-counts and must not equal the corrected per-tract total.
    const naiveUnitOrriSum = summary.orris
      .filter((o) => o.scope === 'unit' && o.includedInMath)
      .reduce((sum, o) => sum.plus(o.unitDecimal), d(0));
    expect(naiveUnitOrriSum.toNumber()).toBeCloseTo(0.075, 12);
    expect(naiveUnitOrriSum.toNumber()).not.toBeCloseTo(0.035, 12);
  });

  it('excludes ORRI and WI rows scoped to a different unit when a tract is focused', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-a',
          name: 'Unit A Tract',
          code: 'A1',
          tractId: 'A1',
          unitCode: 'UNIT-A',
          unitName: 'Unit A',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['a-owner', 'a-lease'],
        },
        {
          id: 'dm-b',
          name: 'Unit B Tract',
          code: 'B1',
          tractId: 'B1',
          unitCode: 'UNIT-B',
          unitName: 'Unit B',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['b-owner', 'b-lease'],
        },
      ],
      nodes: [
        {
          ...createBlankNode('a-owner', null),
          grantee: 'A Owner',
          linkedOwnerId: 'owner-a',
          fraction: '1',
          initialFraction: '1',
        },
        {
          ...createBlankNode('a-lease', 'a-owner'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
        {
          ...createBlankNode('b-owner', null),
          grantee: 'B Owner',
          linkedOwnerId: 'owner-b',
          fraction: '1',
          initialFraction: '1',
        },
        {
          ...createBlankNode('b-lease', 'b-owner'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-a', name: 'A Owner' }),
        createBlankOwner('ws-1', { id: 'owner-b', name: 'B Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-a', {
          id: 'lease-a',
          leaseName: 'A Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
        createBlankLease('ws-1', 'owner-b', {
          id: 'lease-b',
          leaseName: 'B Lease',
          lessee: 'Operator B',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [
        {
          id: 'assignment-b',
          assignor: 'Operator B',
          assignee: 'Wrong Unit WI',
          scope: 'unit',
          unitCode: 'UNIT-B',
          deskMapId: null,
          workingInterestFraction: '1/2',
          effectiveDate: '2024-03-01',
          sourceDocNo: 'ASG-B',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-b',
          payee: 'Wrong Unit ORRI',
          scope: 'unit',
          unitCode: 'UNIT-B',
          deskMapId: null,
          burdenFraction: '1/16',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-B',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    const rows = buildLeaseholdDecimalRows({
      unit: {
        name: 'Multi-unit review',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
        jurisdiction: 'tx_fee',
      },
      unitSummary: summary,
      focusedDeskMapId: 'dm-a',
    });

    expect(rows).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ payee: 'Wrong Unit ORRI' }),
        expect.objectContaining({ payee: 'Wrong Unit WI' }),
      ])
    );
  });

  it('excludes federal leases from Texas leasehold math', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
          linkedLeaseId: 'lease-federal',
        },
      ],
      owners: [createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' })],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-federal',
          leaseName: 'Federal Reference Lease',
          lessee: 'Federal Operator',
          royaltyRate: '1/8',
          leasedInterest: '1',
          jurisdiction: 'federal',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.fullyLeasedTractCount).toBe(0);
    expect(summary.tracts[0]?.leasedOwnership).toBe('0');
    expect(summary.tracts[0]?.unitRoyaltyDecimal).toBe('0');
    expect(summary.totalRoyaltyDecimal).toBe('0');
  });

  it('applies working-interest ORRI basis to the full leased WI, independent of royalty rate', () => {
    // Standard convention: a "1/80 of WI" ORRI is 1/80 of the 8/8 leasehold estate.
    // Result must be the same 0.0125 burden whether the lease royalty is 1/8 or 3/16.
    // Before this fix the WI-basis ORRI was multiplied against (leasedOwnership - royalty),
    // which incorrectly produced 0.0109375 at 1/8 royalty and 0.01015625 at 3/16 royalty —
    // i.e. the deed language "1/80 of 7/8" rather than "1/80 of WI".
    const buildSummary = (royaltyRate: string) =>
      buildLeaseholdUnitSummary({
        deskMaps: [
          {
            id: 'dm-1',
            name: 'Tract 1',
            code: 'T1',
            tractId: 'T1',
            grossAcres: '100',
            pooledAcres: '100',
            description: '',
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
            royaltyRate,
            leasedInterest: '1',
          }),
        ],
        leaseholdAssignments: [],
        leaseholdOrris: [
          {
            id: 'orri-wi',
            payee: 'WI Override',
            scope: 'unit',
            deskMapId: null,
            burdenFraction: '1/80',
            burdenBasis: 'working_interest',
            effectiveDate: '2024-01-01',
            sourceDocNo: 'ORRI-WI',
            notes: '',
            depthRange: 'all_depths',
          },
        ],
      });

    const eighth = buildSummary('1/8');
    expect(eighth.tracts[0]?.weightedRoyaltyRate).toBe('0.125');
    expect(eighth.tracts[0]?.workingInterestOrriBurdenRate).toBe('0.0125');
    expect(eighth.tracts[0]?.totalOrriBurdenRate).toBe('0.0125');
    expect(eighth.tracts[0]?.preWorkingInterestDecimal).toBe('0.8625');
    expect(eighth.orris[0]?.unitDecimal).toBe('0.0125');

    const threeSixteenths = buildSummary('3/16');
    expect(threeSixteenths.tracts[0]?.weightedRoyaltyRate).toBe('0.1875');
    expect(threeSixteenths.tracts[0]?.workingInterestOrriBurdenRate).toBe('0.0125');
    expect(threeSixteenths.tracts[0]?.totalOrriBurdenRate).toBe('0.0125');
    expect(threeSixteenths.tracts[0]?.preWorkingInterestDecimal).toBe('0.8');
    expect(threeSixteenths.orris[0]?.unitDecimal).toBe('0.0125');
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

  it('weights royalty per-tract when a unit contains mixed royalty rates', () => {
    // Tract 1 fully leased at 1/8, Tract 2 fully leased at 3/16, equal pooled acres.
    // Each tract must carry its own royalty rate; the unit-level total is pooled-acre weighted.
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['n1', 'l1'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: 'T2',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['n2', 'l2'],
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
          ...createBlankNode('n2', null),
          grantee: 'B Owner',
          linkedOwnerId: 'owner-2',
          fraction: '1',
          initialFraction: '1',
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
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' }),
        createBlankOwner('ws-1', { id: 'owner-2', name: 'B Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'A Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
        createBlankLease('ws-1', 'owner-2', {
          id: 'lease-2',
          leaseName: 'B Lease',
          lessee: 'Operator A',
          royaltyRate: '3/16',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.tracts[0]?.weightedRoyaltyRate).toBe('0.125');
    expect(summary.tracts[1]?.weightedRoyaltyRate).toBe('0.1875');
    expect(Number(summary.tracts[0]?.unitParticipation)).toBeCloseTo(0.5, 12);
    expect(Number(summary.tracts[1]?.unitParticipation)).toBeCloseTo(0.5, 12);
    expect(Number(summary.tracts[0]?.unitRoyaltyDecimal)).toBeCloseTo(0.0625, 12);
    expect(Number(summary.tracts[1]?.unitRoyaltyDecimal)).toBeCloseTo(0.09375, 12);
    expect(Number(summary.tracts[0]?.preWorkingInterestDecimal)).toBeCloseTo(0.4375, 12);
    expect(Number(summary.tracts[1]?.preWorkingInterestDecimal)).toBeCloseTo(0.40625, 12);
    // Unit-level royalty total is the pooled-acre-weighted average: 0.5×1/8 + 0.5×3/16 = 0.15625.
    expect(summary.totalRoyaltyDecimal).toBe('0.15625');
    expect(summary.preWorkingInterestDecimal).toBe('0.84375');
    expect(summary.retainedWorkingInterestDecimal).toBe('0.84375');
  });

  it('treats a blank lease royalty as 0% — NRI equals full leased WI', () => {
    // Behavior pin: blank optional interest inputs still parse as 0 without raising a
    // malformed-input warning. Non-blank malformed values are covered below.
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
          leaseName: 'Blank Royalty Lease',
          lessee: 'Operator A',
          royaltyRate: '',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.totalRoyaltyDecimal).toBe('0');
    expect(summary.tracts[0]?.weightedRoyaltyRate).toBe('0');
    expect(summary.tracts[0]?.nriBeforeOrriRate).toBe('1');
    expect(summary.tracts[0]?.netRevenueInterestBaseRate).toBe('1');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('1');
    expect(summary.preWorkingInterestDecimal).toBe('1');
    expect(summary.retainedWorkingInterestDecimal).toBe('1');
    expect(summary.inputWarningCount).toBe(0);
    expect(summary.tracts[0]?.inputWarnings).toEqual([]);
    expect(Number.isFinite(Number(summary.tracts[0]?.preWorkingInterestDecimal))).toBe(true);
  });

  it('adds a cost-bearing unleased mineral row so the sheet balances to full ownership', () => {
    // Owner holds 1.0 minerals but leases only 0.5 — the remaining 0.5 is an
    // unleased mineral interest that must appear on the transfer-order sheet so
    // it accounts for 100% of the tract (deep-audit §4 row 11).
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
          leaseName: 'Half Lease',
          lessee: 'Operator A',
          royaltyRate: '0.2',
          leasedInterest: '0.5',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.tracts[0]?.leasedOwnership).toBe('0.5');
    expect(summary.tracts[0]?.currentOwnership).toBe('1');

    const unit = {
      name: 'Half Unit',
      description: '',
      operator: 'Operator A',
      effectiveDate: '2024-01-01',
      jurisdiction: 'tx_fee' as const,
    };
    const review = buildLeaseholdTransferOrderReview({
      unit,
      unitSummary: summary,
      focusedDeskMapId: null,
    });

    const unleasedRows = review.rows.filter((row) => row.category === 'unleased');
    expect(unleasedRows).toHaveLength(1);
    expect(unleasedRows[0]?.payee).toBe('A Owner');
    expect(unleasedRows[0]?.decimal).toBe('0.5');
    // royalty 0.1 + retained WI 0.4 + unleased 0.5 = 1.0, balanced against 100%.
    expect(review.expectedDecimal).toBe('1');
    expect(review.totalDecimal).toBe('1');
    expect(review.varianceDecimal).toBe('0');
    // Unleased rows are derived (no source instrument) and excluded from the
    // source-completeness review counts.
    expect(unleasedRows[0]?.sourceDocNo).toBe('');
    expect(review.reviewableRowCount).toBe(
      review.rows.filter((row) => row.category !== 'retained_wi' && row.category !== 'unleased').length
    );
  });

  it('emits no unleased row when the owner is fully leased', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
          leaseName: 'Full Lease',
          lessee: 'Operator A',
          royaltyRate: '0.25',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    const review = buildLeaseholdTransferOrderReview({
      unit: {
        name: 'Full Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
        jurisdiction: 'tx_fee' as const,
      },
      unitSummary: summary,
      focusedDeskMapId: null,
    });

    expect(review.rows.some((row) => row.category === 'unleased')).toBe(false);
    expect(review.expectedDecimal).toBe('1');
    expect(review.varianceDecimal).toBe('0');
  });

  it('flags NPRIs with unconfirmed ratification and holds the transfer order (DA-M5)', () => {
    const buildWith = (ratificationStatus?: 'ratified' | 'unratified' | 'unknown') =>
      buildLeaseholdUnitSummary({
        deskMaps: [
          {
            id: 'dm-1',
            name: 'Tract 1',
            code: 'T1',
            tractId: 'T1',
            grossAcres: '100',
            pooledAcres: '100',
            description: '',
            nodeIds: ['n1', 'l1', 'npri-1'],
          },
        ],
        nodes: [
          {
            ...createBlankNode('n1', null),
            grantee: 'Mineral Owner',
            linkedOwnerId: 'owner-1',
            fraction: '1',
            initialFraction: '1',
          },
          {
            ...createBlankNode('l1', 'n1'),
            type: 'related' as const,
            relatedKind: 'lease' as const,
          },
          {
            ...createBlankNode('npri-1', 'n1'),
            grantee: 'NPRI Owner',
            linkedOwnerId: 'owner-2',
            interestClass: 'npri' as const,
            royaltyKind: 'floating' as const,
            fraction: '0.5',
            initialFraction: '0.5',
            docNo: 'NPRI-1',
            ...(ratificationStatus ? { ratificationStatus } : {}),
          },
        ],
        owners: [
          createBlankOwner('ws-1', { id: 'owner-1', name: 'Mineral Owner' }),
          createBlankOwner('ws-1', { id: 'owner-2', name: 'NPRI Owner' }),
        ],
        leases: [
          createBlankLease('ws-1', 'owner-1', {
            id: 'lease-1',
            leaseName: 'Base Lease',
            lessee: 'Operator A',
            royaltyRate: '1/8',
            leasedInterest: '1',
          }),
        ],
        leaseholdAssignments: [],
        leaseholdOrris: [],
      });

    // Absent ratification reads as 'ratified' (legacy back-compat — the old
    // engine implicitly ratified every NPRI, so existing data is not held).
    const legacy = buildWith(undefined);
    expect(legacy.npris.find((n) => n.id === 'npri-1')?.ratificationStatus).toBe('ratified');
    expect(legacy.npriRatificationHoldCount).toBe(0);
    expect(
      buildLeaseholdTransferOrderHoldReasons(legacy).some((r) => r.includes('ratification'))
    ).toBe(false);

    // Explicit 'unknown' (a newly-created NPRI's default) holds the transfer order.
    const unknown = buildWith('unknown');
    expect(unknown.npriRatificationHoldCount).toBe(1);
    expect(
      buildLeaseholdTransferOrderHoldReasons(unknown).some((r) => r.includes('ratification'))
    ).toBe(true);

    // 'unratified' likewise holds.
    expect(buildWith('unratified').npriRatificationHoldCount).toBe(1);

    // The decimals are identical regardless of ratification — the unratified
    // tract-basis payout math is deferred, so only the hold differs today.
    expect(buildWith('ratified').totalNpriDecimal).toBe(unknown.totalNpriDecimal);
  });

  it('holds the transfer order with a counsel-sign-off reason when a fixed NPRI exceeds royalty (DA-H1, F4)', () => {
    const reasons = buildLeaseholdTransferOrderHoldReasons({
      unitAssignmentWarningCount: 0,
      npriRatificationHoldCount: 0,
      fixedNpriExceedsRoyaltyTractCount: 2,
    });
    expect(reasons.some((r) => r.includes('counsel-approved'))).toBe(true);
    expect(reasons.some((r) => r.includes('2 tracts') && r.includes('fixed NPRI'))).toBe(true);

    // No flag -> no DA-H1 hold.
    expect(
      buildLeaseholdTransferOrderHoldReasons({
        unitAssignmentWarningCount: 0,
        npriRatificationHoldCount: 0,
        fixedNpriExceedsRoyaltyTractCount: 0,
      }).some((r) => r.includes('counsel-approved'))
    ).toBe(false);
  });

  it('holds the transfer order when open Critical/High curative issues are passed (DA2-C)', () => {
    const base = {
      unitAssignmentWarningCount: 0,
      npriRatificationHoldCount: 0,
      fixedNpriExceedsRoyaltyTractCount: 0,
    };

    // Plural reason for 2 issues.
    const two = buildLeaseholdTransferOrderHoldReasons(base, 2);
    expect(two.some((r) => /open Critical\/High curative issues/.test(r))).toBe(true);
    expect(two.some((r) => r.includes('2 open'))).toBe(true);

    // Singular for 1.
    const one = buildLeaseholdTransferOrderHoldReasons(base, 1);
    expect(
      one.some((r) => /1 open Critical\/High curative issue\b/.test(r) && !/issues/.test(r))
    ).toBe(true);

    // 0 / omitted -> no curative reason, and the default arg is byte-identical
    // to the no-arg call (proves every existing caller is unchanged).
    expect(
      buildLeaseholdTransferOrderHoldReasons(base, 0).some((r) => /curative/.test(r))
    ).toBe(false);
    expect(buildLeaseholdTransferOrderHoldReasons(base)).toEqual(
      buildLeaseholdTransferOrderHoldReasons(base, 0)
    );
  });

  it('surfaces malformed lease royalty, ORRI burden, and WI assignment inputs as warnings', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
          leaseName: 'Bad Royalty Lease',
          lessee: 'Operator A',
          royaltyRate: '2',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [
        {
          id: 'assignment-1',
          assignor: 'Operator A',
          assignee: 'Assignee A',
          scope: 'unit',
          deskMapId: null,
          workingInterestFraction: '5/4',
          effectiveDate: '2024-03-01',
          sourceDocNo: 'ASG-1',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-1',
          payee: 'Override A',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/0',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-02-01',
          sourceDocNo: 'ORRI-1',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    expect(summary.inputWarningCount).toBe(3);
    expect(summary.inputWarnings.map((warning) => warning.id)).toEqual([
      'lease:lease-1:royaltyRate',
      'orri:orri-1:burdenFraction',
      'assignment:assignment-1:workingInterestFraction',
    ]);
    expect(summary.inputWarnings.map((warning) => warning.value)).toEqual(['2', '1/0', '5/4']);
    expect(summary.inputWarnings.every((warning) =>
      warning.message.includes('treated as 0 in leasehold math')
    )).toBe(true);
    expect(summary.tracts[0]?.inputWarnings.map((warning) => warning.id)).toEqual(
      summary.inputWarnings.map((warning) => warning.id)
    );
    expect(summary.totalRoyaltyDecimal).toBe('0');
    expect(summary.totalOrriDecimal).toBe('0');
    expect(summary.totalAssignedWorkingInterestDecimal).toBe('0');
    expect(summary.orris[0]?.unitDecimal).toBe('0');
    expect(summary.assignments[0]?.unitDecimal).toBe('0');
    expect(summary.preWorkingInterestDecimal).toBe('1');
    expect(summary.retainedWorkingInterestDecimal).toBe('1');
  });

  it('clamps over-burdened NRI base and pre-WI at zero when ORRIs exceed the leased WI', () => {
    // Behavior pin for audit finding #9. The math still floors NRI base and pre-WI at 0 when
    // the ORRI stack exceeds what the leasehold can support, but it now ALSO flags the tract
    // as `overBurdened: true` and bumps `overBurdenedTractCount` on the unit summary so the
    // leasehold deck can surface a warning banner. The clamp itself stays in place — this is
    // warning-only, matching the existing `overAssigned` convention.
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
      leaseholdAssignments: [],
      leaseholdOrris: [
        {
          id: 'orri-gross',
          payee: 'Gross Burn',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/2',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-G',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-wi',
          payee: 'WI Burn',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/2',
          burdenBasis: 'working_interest',
          effectiveDate: '2024-01-02',
          sourceDocNo: 'ORRI-W',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-nri',
          payee: 'NRI Burn',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/4',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-03',
          sourceDocNo: 'ORRI-N',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    // WI base = 1 − 1/8 = 0.875. Gross ORRI = 0.5, WI ORRI = 0.5. Both are NOT clamped at the
    // individual level. NRI base = 0.875 − 0.5 − 0.5 = −0.125 → clamped to 0. NRI ORRI = 0.
    expect(summary.tracts[0]?.grossOrriBurdenRate).toBe('0.5');
    expect(summary.tracts[0]?.workingInterestOrriBurdenRate).toBe('0.5');
    expect(summary.tracts[0]?.netRevenueInterestBaseRate).toBe('0');
    expect(summary.tracts[0]?.netRevenueInterestOrriBurdenRate).toBe('0');
    // Total ORRI (1.0) exceeds WI base (0.875), so pre-WI clamps to 0.
    expect(summary.tracts[0]?.totalOrriBurdenRate).toBe('1');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0');
    expect(summary.preWorkingInterestDecimal).toBe('0');
    expect(summary.retainedWorkingInterestDecimal).toBe('0');
    // overAssigned is the WI-assignment flag, not an ORRI burden flag — still false here.
    expect(summary.tracts[0]?.overAssigned).toBe(false);
    // overBurdened is the new ORRI-exceeds-NRI flag from finding #9. It's true whenever
    // (nriBeforeOrriRate − totalOrriBurdenRate) would have gone negative before the clamp.
    expect(summary.tracts[0]?.overBurdened).toBe(true);
    expect(summary.overBurdenedTractCount).toBe(1);
  });

  it('stacks gross_8_8, working_interest, and net_revenue_interest ORRI bases in the documented order', () => {
    // Single tract, fully leased, 1/8 royalty. Three ORRIs, one of each basis:
    //   gross_8_8    1/16  → 1.0  × 1/16 = 0.0625
    //   working_interest 1/80  → 1.0  × 1/80 = 0.0125
    //   net_revenue_interest 1/20  → (0.875 − 0.0625 − 0.0125) × 1/20 = 0.8 × 0.05 = 0.04
    // Total ORRI = 0.115. WI base = 0.875. pre-WI = 0.875 − 0.115 = 0.76.
    // This pins the stacking order: NRI-basis ORRIs are applied AFTER gross and WI ORRIs
    // have been carved out of the after-royalty base.
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
      leaseholdAssignments: [],
      leaseholdOrris: [
        {
          id: 'orri-gross',
          payee: 'Gross Payee',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/16',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-G',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-wi',
          payee: 'WI Payee',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/80',
          burdenBasis: 'working_interest',
          effectiveDate: '2024-01-02',
          sourceDocNo: 'ORRI-W',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-nri',
          payee: 'NRI Payee',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/20',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-03',
          sourceDocNo: 'ORRI-N',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    expect(summary.tracts[0]?.nriBeforeOrriRate).toBe('0.875');
    expect(summary.tracts[0]?.grossOrriBurdenRate).toBe('0.0625');
    expect(summary.tracts[0]?.workingInterestOrriBurdenRate).toBe('0.0125');
    expect(summary.tracts[0]?.netRevenueInterestBaseRate).toBe('0.8');
    expect(summary.tracts[0]?.netRevenueInterestOrriBurdenRate).toBe('0.04');
    expect(summary.tracts[0]?.totalOrriBurdenRate).toBe('0.115');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.76');
    expect(summary.preWorkingInterestDecimal).toBe('0.76');
  });

  it('stacks multiple NRI-basis ORRIs in effective-date order', () => {
    // Two NRI-basis ORRIs on the same tract. They now carve one by one in effective-date
    // order off the NRI base that remains after gross-basis and WI-basis ORRIs.
    //   first:  0.875 × 1/20 = 0.04375
    //   second: (0.875 - 0.04375) × 1/40 = 0.02078125
    //   total:  0.06453125
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
      leaseholdAssignments: [],
      leaseholdOrris: [
        {
          id: 'orri-nri-a',
          payee: 'NRI A',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/20',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-NA',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-nri-b',
          payee: 'NRI B',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/40',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-02',
          sourceDocNo: 'ORRI-NB',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    expect(summary.tracts[0]?.netRevenueInterestBaseRate).toBe('0.875');
    expect(summary.tracts[0]?.netRevenueInterestOrriBurdenRate).toBe('0.06453125');
    expect(summary.tracts[0]?.totalOrriBurdenRate).toBe('0.06453125');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.81046875');

    // Unit participation is 1.0 (single tract), so unitDecimal == burden.
    const orriA = summary.orris.find((orri) => orri.id === 'orri-nri-a');
    const orriB = summary.orris.find((orri) => orri.id === 'orri-nri-b');
    expect(orriA?.unitDecimal).toBe('0.04375');
    expect(orriB?.unitDecimal).toBe('0.02078125');
    expect(
      d(orriA?.unitDecimal ?? '0').plus(d(orriB?.unitDecimal ?? '0')).toString()
    ).toBe('0.06453125');
  });

  it('uses the same sequential NRI-basis ORRI carve in focused decimal rows', () => {
    const unit = {
      name: 'Audit Unit',
      description: '',
      operator: 'Operator A',
      effectiveDate: '2024-01-01',
      jurisdiction: 'tx_fee' as const,
    };
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'Base Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
          effectiveDate: '2024-01-01',
          docNo: 'LEASE-1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [
        {
          id: 'orri-nri-a',
          payee: 'NRI A',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/20',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-NA',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-nri-b',
          payee: 'NRI B',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/40',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-02',
          sourceDocNo: 'ORRI-NB',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    const rows = buildLeaseholdDecimalRows({
      unit,
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'orri-dm-1-orri-nri-a',
          decimal: '0.04375',
        }),
        expect.objectContaining({
          id: 'orri-dm-1-orri-nri-b',
          decimal: '0.02078125',
        }),
      ])
    );
  });

  it('exposes the parsed WI fraction and reuses it in the focused decimal row (DA-M7)', () => {
    const unit = {
      name: 'Audit Unit',
      description: '',
      operator: 'Operator A',
      effectiveDate: '2024-01-01',
      jurisdiction: 'tx_fee' as const,
    };
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
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
          leaseName: 'Base Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [
        {
          id: 'asn-1',
          assignor: 'Operator A',
          assignee: 'WI Partner',
          scope: 'unit',
          deskMapId: null,
          workingInterestFraction: '1/4',
          effectiveDate: '2024-03-01',
          sourceDocNo: 'ASG-1',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
      leaseholdOrris: [],
    });

    // The fraction is parsed once in the builder and exposed for downstream reuse.
    const assignment = summary.assignments.find((a) => a.id === 'asn-1');
    expect(assignment?.workingInterestFractionDecimal).toBe('0.25');

    // The focused decimal row must reuse that fraction (preWI × 0.25), not re-parse.
    const rows = buildLeaseholdDecimalRows({
      unit,
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    });
    const wiRow = rows.find((row) => row.id === 'assignment-dm-1-asn-1');
    const expected = d(summary.tracts[0]?.preWorkingInterestDecimal ?? '0')
      .times('0.25')
      .toString();
    expect(wiRow?.decimal).toBe(expected);
    expect(expected).toBe('0.21875');
  });

  it('excludes non-participating unit ORRIs from the burden stack so included rates are unperturbed (DA-M7)', () => {
    // A zero-pooled-acres tract carries a tract-scoped NRI ORRI (always included)
    // and a unit-scoped NRI ORRI that earlier-dates it. The unit ORRI has no
    // participating tract, so it must be excluded from the sequential carve;
    // otherwise it would shift the tract ORRI's rate (0.04375 → 0.04265625).
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-z',
          name: 'Tract Z',
          code: 'TZ',
          tractId: 'TZ',
          grossAcres: '100',
          pooledAcres: '0',
          description: '',
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
          leaseName: 'Base Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [
        {
          id: 'orri-unit-excluded',
          payee: 'Excluded Unit ORRI',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/40',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-UX',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-tract',
          payee: 'Tract ORRI',
          scope: 'tract',
          deskMapId: 'dm-z',
          burdenFraction: '1/20',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-02',
          sourceDocNo: 'ORRI-TR',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    const excluded = summary.orris.find((orri) => orri.id === 'orri-unit-excluded');
    expect(excluded?.includedInMath).toBe(false);

    const burdenByTract = summary.orriBurdenRateByTractId.get('dm-z');
    // The excluded ORRI never entered the basis...
    expect(burdenByTract?.has('orri-unit-excluded')).toBe(false);
    // ...so the included tract ORRI keeps its unperturbed rate.
    expect(burdenByTract?.get('orri-tract')?.toString()).toBe('0.04375');
  });

  it('splits fixed and floating NPRIs into separate payout rows and keeps total coverage in balance', () => {
    const unit = {
      name: 'Audit Unit',
      description: '',
      operator: 'Operator A',
      effectiveDate: '2024-01-01',
      jurisdiction: 'tx_fee' as const,
    };
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '320',
          pooledAcres: '320',
          description: '',
          nodeIds: ['n1', 'l1', 'npri-fixed', 'npri-floating'],
        },
      ],
      nodes: [
        {
          ...createBlankNode('n1', null),
          grantee: 'Mineral Owner',
          linkedOwnerId: 'owner-1',
          fraction: '1',
          initialFraction: '1',
        },
        {
          ...createBlankNode('l1', 'n1'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
        {
          ...createBlankNode('npri-fixed', 'n1'),
          grantee: 'Fixed NPRI Owner',
          linkedOwnerId: 'owner-2',
          interestClass: 'npri' as const,
          royaltyKind: 'fixed' as const,
          fraction: '0.0625',
          initialFraction: '0.0625',
          date: '2024-01-02',
          docNo: 'NPRI-FIXED',
        },
        {
          ...createBlankNode('npri-floating', 'n1'),
          grantee: 'Floating NPRI Owner',
          linkedOwnerId: 'owner-3',
          interestClass: 'npri' as const,
          royaltyKind: 'floating' as const,
          fraction: '0.5',
          initialFraction: '0.5',
          date: '2024-01-03',
          docNo: 'NPRI-FLOAT',
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'Mineral Owner' }),
        createBlankOwner('ws-1', { id: 'owner-2', name: 'Fixed NPRI Owner' }),
        createBlankOwner('ws-1', { id: 'owner-3', name: 'Floating NPRI Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'Base Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
          effectiveDate: '2024-01-01',
          docNo: 'LEASE-1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.totalRoyaltyDecimal).toBe('0.125');
    expect(summary.totalNpriDecimal).toBe('0.125');
    expect(summary.tracts[0]?.floatingNpriBurdenRate).toBe('0.0625');
    expect(summary.tracts[0]?.fixedNpriBurdenRate).toBe('0.0625');
    expect(summary.tracts[0]?.totalNpriBurdenRate).toBe('0.125');
    // DA-H1: the 1/16 floating NPRI carves the 1/8 royalty to 1/16, then the
    // 1/16 fixed NPRI is fully satisfied out of that remaining royalty (excess
    // 0), so the lessor's net royalty drops to 0 and the WI's NRI is unburdened
    // (0.875). The fixed NPRI does NOT exceed the royalty, so no warning.
    expect(summary.tracts[0]?.npriAdjustedNriBeforeOrriRate).toBe('0.875');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.875');
    expect(summary.tracts[0]?.fixedNpriExceedsRoyalty).toBe(false);
    expect(summary.fixedNpriExceedsRoyaltyTractCount).toBe(0);
    expect(summary.tracts[0]?.owners[0]).toEqual(
      expect.objectContaining({
        ownerTractRoyalty: '0.125',
        netOwnerTractRoyalty: '0',
        unitRoyaltyDecimal: '0.125',
        netOwnerUnitRoyaltyDecimal: '0',
      })
    );
    expect(summary.npris).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'npri-fixed',
          royaltyKind: 'fixed',
          unitDecimal: '0.0625',
        }),
        expect.objectContaining({
          id: 'npri-floating',
          royaltyKind: 'floating',
          unitDecimal: '0.0625',
        }),
      ])
    );

    const rows = buildLeaseholdDecimalRows({
      unit,
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    });
    // DA-H1: the lessor royalty row is fully consumed (net 0) so it drops out;
    // the NPRIs are still paid in full and the WI keeps the unburdened 0.875.
    expect(rows.some((row) => row.category === 'royalty')).toBe(false);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'npri',
          payee: 'Fixed NPRI Owner',
          decimal: '0.0625',
        }),
        expect.objectContaining({
          category: 'npri',
          payee: 'Floating NPRI Owner',
          decimal: '0.0625',
        }),
        expect.objectContaining({
          category: 'retained_wi',
          decimal: '0.875',
        }),
      ])
    );

    const review = buildLeaseholdTransferOrderReview({
      unit,
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    });
    expect(review.totalDecimal).toBe('1');
    expect(review.expectedDecimal).toBe('1');
    expect(review.varianceDecimal).toBe('0');
    expect(review.categorySummaries).toEqual([
      { category: 'npri', rowCount: 2, totalDecimal: '0.125' },
      { category: 'retained_wi', rowCount: 1, totalDecimal: '0.875' },
    ]);
  });

  it('applies an NPRI created on a mineral ancestor across that ancestor branch and current descendants', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['root', 'child', 'lease-root', 'lease-child', 'npri-root'],
        },
      ],
      nodes: [
        {
          ...createBlankNode('root', null),
          grantee: 'Root Owner',
          linkedOwnerId: 'owner-1',
          fraction: '0.5',
          initialFraction: '1',
        },
        {
          ...createBlankNode('child', 'root'),
          grantee: 'Child Owner',
          linkedOwnerId: 'owner-2',
          fraction: '0.5',
          initialFraction: '0.5',
        },
        {
          ...createBlankNode('lease-root', 'root'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
        {
          ...createBlankNode('lease-child', 'child'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
        {
          ...createBlankNode('npri-root', 'root'),
          grantee: 'Ancestor NPRI Owner',
          linkedOwnerId: 'owner-3',
          interestClass: 'npri' as const,
          royaltyKind: 'fixed' as const,
          fraction: '0.0625',
          initialFraction: '0.0625',
          date: '2024-01-02',
          docNo: 'NPRI-ROOT',
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'Root Owner' }),
        createBlankOwner('ws-1', { id: 'owner-2', name: 'Child Owner' }),
        createBlankOwner('ws-1', { id: 'owner-3', name: 'Ancestor NPRI Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'Root Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '0.5',
        }),
        createBlankLease('ws-1', 'owner-2', {
          id: 'lease-2',
          leaseName: 'Child Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '0.5',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.totalRoyaltyDecimal).toBe('0.125');
    expect(summary.totalNpriDecimal).toBe('0.0625');
    expect(summary.tracts[0]?.fixedNpriBurdenRate).toBe('0.0625');
    // DA-H1: the branch fixed NPRI is covered out of the branch lessors' royalty
    // (excess 0), so the WI keeps the unburdened 0.875.
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.875');

    const npri = summary.npris.find((record) => record.id === 'npri-root');
    expect(npri?.unitDecimal).toBe('0.0625');

    const royaltyRows = buildLeaseholdDecimalRows({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
        jurisdiction: 'tx_fee',
      },
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    }).filter((row) => row.category === 'royalty');

    // DA-H1: the branch's 1/16 fixed NPRI is satisfied from the two branch
    // lessors' royalties (0.03125 each), reducing each net royalty from 0.0625
    // to 0.03125.
    expect(royaltyRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ payee: 'Root Owner', decimal: '0.03125' }),
        expect.objectContaining({ payee: 'Child Owner', decimal: '0.03125' }),
      ])
    );
  });

  it('subtracts fixed NPRI burdens before applying NRI-basis ORRIs', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['n1', 'l1', 'npri-fixed'],
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
        {
          ...createBlankNode('npri-fixed', 'n1'),
          grantee: 'Fixed NPRI Owner',
          linkedOwnerId: 'owner-2',
          interestClass: 'npri' as const,
          royaltyKind: 'fixed' as const,
          fraction: '0.0625',
          initialFraction: '0.0625',
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' }),
        createBlankOwner('ws-1', { id: 'owner-2', name: 'Fixed NPRI Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'Base Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [
        {
          id: 'orri-nri',
          payee: 'NRI Payee',
          scope: 'unit',
          deskMapId: null,
          burdenFraction: '1/10',
          burdenBasis: 'net_revenue_interest',
          effectiveDate: '2024-01-05',
          sourceDocNo: 'ORRI-NRI',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    // DA-H1: with no floating NPRI, the 1/16 fixed NPRI is fully covered by the
    // 1/8 royalty (excess 0), so the WI's NRI base stays 0.875 and the 1/10
    // NRI-basis ORRI now carves from 0.875 (= 0.0875), leaving pre-WI 0.7875.
    // The lessor's net royalty falls from 0.125 to 0.0625.
    expect(summary.tracts[0]?.nriBeforeOrriRate).toBe('0.875');
    expect(summary.tracts[0]?.fixedNpriBurdenRate).toBe('0.0625');
    expect(summary.tracts[0]?.npriAdjustedNriBeforeOrriRate).toBe('0.875');
    expect(summary.tracts[0]?.netRevenueInterestBaseRate).toBe('0.875');
    expect(summary.tracts[0]?.netRevenueInterestOrriBurdenRate).toBe('0.0875');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.7875');
    expect(summary.tracts[0]?.fixedNpriExceedsRoyalty).toBe(false);
    expect(summary.orris[0]?.unitDecimal).toBe('0.0875');
  });

  it('DA-H1: charges fixed-NPRI excess over the lessor royalty to the working interest and flags it', () => {
    // 100% minerals, 1/8 lease royalty, a 1/4 fixed NPRI, no floating. The fixed
    // NPRI (0.25) exhausts the lessor's 1/8 royalty (covered 0.125) and the
    // remaining 0.125 excess burdens the WI. Division-order result: lessor 0,
    // NPRI 1/4, WI 3/4, with the fixedNpriExceedsRoyalty warning set.
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['n1', 'l1', 'npri-fixed'],
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
        {
          ...createBlankNode('npri-fixed', 'n1'),
          grantee: 'Fixed NPRI Owner',
          linkedOwnerId: 'owner-2',
          interestClass: 'npri' as const,
          royaltyKind: 'fixed' as const,
          fraction: '0.25',
          initialFraction: '0.25',
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' }),
        createBlankOwner('ws-1', { id: 'owner-2', name: 'Fixed NPRI Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'Base Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    expect(summary.tracts[0]?.fixedNpriBurdenRate).toBe('0.25');
    expect(summary.tracts[0]?.npriAdjustedNriBeforeOrriRate).toBe('0.75');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.75');
    expect(summary.tracts[0]?.fixedNpriExceedsRoyalty).toBe(true);
    expect(summary.fixedNpriExceedsRoyaltyTractCount).toBe(1);
    expect(summary.tracts[0]?.owners[0]?.netOwnerTractRoyalty).toBe('0');
    const fixedNpri = summary.npris.find((record) => record.id === 'npri-fixed');
    expect(fixedNpri?.unitDecimal).toBe('0.25');

    const review = buildLeaseholdTransferOrderReview({
      unit: {
        name: 'Audit Unit',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
        jurisdiction: 'tx_fee',
      },
      unitSummary: summary,
      focusedDeskMapId: 'dm-1',
    });
    expect(review.totalDecimal).toBe('1');
    expect(review.varianceDecimal).toBe('0');
    expect(review.categorySummaries).toEqual([
      { category: 'npri', rowCount: 1, totalDecimal: '0.25' },
      { category: 'retained_wi', rowCount: 1, totalDecimal: '0.75' },
    ]);
  });

  it('distinguishes fixed NPRIs entered as burdened-branch shares versus whole-tract shares', () => {
    const baseInput = {
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['n1', 'l1', 'npri-fixed'],
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-1', name: 'Branch Owner' }),
        createBlankOwner('ws-1', { id: 'owner-2', name: 'Fixed NPRI Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-1',
          leaseName: 'Base Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '0.0625',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    };

    const branchBasisSummary = buildLeaseholdUnitSummary({
      ...baseInput,
      nodes: [
        {
          ...createBlankNode('n1', null),
          grantee: 'Branch Owner',
          linkedOwnerId: 'owner-1',
          fraction: '0.0625',
          initialFraction: '0.0625',
        },
        {
          ...createBlankNode('l1', 'n1'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
        {
          ...createBlankNode('npri-fixed', 'n1'),
          grantee: 'Fixed NPRI Owner',
          linkedOwnerId: 'owner-2',
          interestClass: 'npri' as const,
          royaltyKind: 'fixed' as const,
          fixedRoyaltyBasis: 'burdened_branch' as const,
          fraction: '0.0625',
          initialFraction: '0.0625',
        },
      ],
    });

    const wholeTractSummary = buildLeaseholdUnitSummary({
      ...baseInput,
      nodes: [
        {
          ...createBlankNode('n1', null),
          grantee: 'Branch Owner',
          linkedOwnerId: 'owner-1',
          fraction: '0.0625',
          initialFraction: '0.0625',
        },
        {
          ...createBlankNode('l1', 'n1'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
        {
          ...createBlankNode('npri-fixed', 'n1'),
          grantee: 'Fixed NPRI Owner',
          linkedOwnerId: 'owner-2',
          interestClass: 'npri' as const,
          royaltyKind: 'fixed' as const,
          fixedRoyaltyBasis: 'whole_tract' as const,
          fraction: '0.0625',
          initialFraction: '0.0625',
        },
      ],
    });

    expect(branchBasisSummary.npris[0]).toEqual(
      expect.objectContaining({
        fixedRoyaltyBasis: 'burdened_branch',
        unitDecimal: '0.00390625',
      })
    );
    expect(branchBasisSummary.tracts[0]?.fixedNpriBurdenRate).toBe('0.00390625');

    expect(wholeTractSummary.npris[0]).toEqual(
      expect.objectContaining({
        fixedRoyaltyBasis: 'whole_tract',
        unitDecimal: '0.0625',
      })
    );
    expect(wholeTractSummary.tracts[0]?.fixedNpriBurdenRate).toBe('0.0625');
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
          depthRange: 'all_depths',
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
          depthRange: 'all_depths',
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
        jurisdiction: 'tx_fee',
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
        jurisdiction: 'tx_fee',
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

  it('bubbles lease-overlap warnings from allocateLeaseCoverage up to the tract and unit summary', () => {
    // Behavior pin for audit finding #1. Two active leases on the same owner, each claiming
    // 0.5 of a 0.5 owner share, overflow the owner's interest by 0.25. The second (later-
    // effective) lease is still silently clipped at the allocation layer, but we now surface
    // an overlap warning per clipped lease so the leasehold deck can flag the tract for human
    // review. Matches the existing warning-only convention — the math is unchanged.
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['n1', 'l1'],
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
        {
          ...createBlankNode('l1', 'n1'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
        },
      ],
      owners: [createBlankOwner('ws-1', { id: 'owner-1', name: 'A Owner' })],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-early',
          leaseName: 'Early Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '0.5',
          effectiveDate: '2024-01-01',
        }),
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-late',
          leaseName: 'Top Lease',
          lessee: 'Operator B',
          royaltyRate: '1/4',
          leasedInterest: '0.5',
          effectiveDate: '2024-06-01',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    // The early lease takes the full 0.5 owner share; the top lease is fully clipped to 0.
    expect(summary.tracts[0]?.leaseOverlaps).toEqual([
      expect.objectContaining({
        leaseId: 'lease-late',
        leaseName: 'Top Lease',
        lessee: 'Operator B',
        requestedFraction: '0.5',
        allocatedFraction: '0',
        clippedFraction: '0.5',
      }),
    ]);
    expect(summary.leaseOverlapTractCount).toBe(1);
    expect(summary.leaseOverlapWarningCount).toBe(1);
    // overBurdened is the ORRI-side flag; it stays false when the problem is a lease overlap.
    expect(summary.tracts[0]?.overBurdened).toBe(false);
    expect(summary.overBurdenedTractCount).toBe(0);
  });

  it('does not apply a branch-linked lease node to the same owner in another tract', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-1',
          name: 'Tract 1',
          code: 'T1',
          tractId: 'T1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['owner-t1', 'lease-t1-node'],
        },
        {
          id: 'dm-2',
          name: 'Tract 2',
          code: 'T2',
          tractId: 'T2',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['owner-t2'],
        },
      ],
      nodes: [
        {
          ...createBlankNode('owner-t1', null),
          grantee: 'Same Owner',
          linkedOwnerId: 'owner-1',
          fraction: '0.25',
          initialFraction: '0.25',
        },
        {
          ...createBlankNode('lease-t1-node', 'owner-t1'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
          linkedLeaseId: 'lease-t1',
        },
        {
          ...createBlankNode('owner-t2', null),
          grantee: 'Same Owner',
          linkedOwnerId: 'owner-1',
          fraction: '0.25',
          initialFraction: '0.25',
        },
      ],
      owners: [createBlankOwner('ws-1', { id: 'owner-1', name: 'Same Owner' })],
      leases: [
        createBlankLease('ws-1', 'owner-1', {
          id: 'lease-t1',
          leaseName: 'T1 Only Lease',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '0.25',
          effectiveDate: '2024-01-01',
        }),
      ],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });

    const tractOneOwner = summary.tracts[0]?.owners[0];
    const tractTwoOwner = summary.tracts[1]?.owners[0];

    expect(tractOneOwner?.leasedFraction).toBe('0.25');
    expect(tractOneOwner?.activeLeaseCount).toBe(1);
    expect(tractTwoOwner?.leasedFraction).toBe('0');
    expect(tractTwoOwner?.activeLeaseCount).toBe(0);
    expect(summary.tracts[0]?.leasedOwnership).toBe('0.25');
    expect(summary.tracts[1]?.leasedOwnership).toBe('0');
  });

  it('keeps unit-wide ORRIs and assignments inside their tagged unit', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-a',
          name: 'A Tract',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['owner-a', 'lease-a-node'],
          unitName: 'Raven Forest Unit A',
          unitCode: 'A',
        },
        {
          id: 'dm-b',
          name: 'B Tract',
          code: 'B1',
          tractId: 'B1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['owner-b', 'lease-b-node'],
          unitName: 'Raven Forest Unit B',
          unitCode: 'B',
        },
      ],
      nodes: [
        {
          ...createBlankNode('owner-a', null),
          grantee: 'A Owner',
          linkedOwnerId: 'owner-a-record',
          fraction: '1',
          initialFraction: '1',
        },
        {
          ...createBlankNode('lease-a-node', 'owner-a'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
          linkedLeaseId: 'lease-a',
        },
        {
          ...createBlankNode('owner-b', null),
          grantee: 'B Owner',
          linkedOwnerId: 'owner-b-record',
          fraction: '1',
          initialFraction: '1',
        },
        {
          ...createBlankNode('lease-b-node', 'owner-b'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
          linkedLeaseId: 'lease-b',
        },
      ],
      owners: [
        createBlankOwner('ws-1', { id: 'owner-a-record', name: 'A Owner' }),
        createBlankOwner('ws-1', { id: 'owner-b-record', name: 'B Owner' }),
      ],
      leases: [
        createBlankLease('ws-1', 'owner-a-record', {
          id: 'lease-a',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
        createBlankLease('ws-1', 'owner-b-record', {
          id: 'lease-b',
          lessee: 'Operator B',
          royaltyRate: '1/8',
          leasedInterest: '1',
        }),
      ],
      leaseholdAssignments: [
        {
          id: 'assignment-a',
          assignor: 'Operator A',
          assignee: 'A WI Partner',
          scope: 'unit',
          unitCode: 'A',
          deskMapId: null,
          workingInterestFraction: '1/2',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ASG-A',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-a',
          payee: 'A Override',
          scope: 'unit',
          unitCode: 'A',
          deskMapId: null,
          burdenFraction: '1/32',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-01',
          sourceDocNo: 'ORRI-A',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    const tractA = summary.tracts.find((tract) => tract.deskMapId === 'dm-a')!;
    const tractB = summary.tracts.find((tract) => tract.deskMapId === 'dm-b')!;

    expect(tractA.trackedAssignmentCount).toBe(1);
    expect(tractA.trackedOrriCount).toBe(1);
    expect(tractB.trackedAssignmentCount).toBe(0);
    expect(tractB.trackedOrriCount).toBe(0);
    expect(summary.assignments[0]).toEqual(
      expect.objectContaining({
        id: 'assignment-a',
        unitCode: 'A',
        tractName: 'Raven Forest Unit A',
      })
    );
    expect(summary.orris[0]).toEqual(
      expect.objectContaining({
        id: 'orri-a',
        unitCode: 'A',
        tractName: 'Raven Forest Unit A',
      })
    );
  });

  it('surfaces null-unit ORRI/WI exclusions without changing payout math', () => {
    const summary = buildLeaseholdUnitSummary({
      deskMaps: [
        {
          id: 'dm-a',
          name: 'A Tract',
          code: 'A1',
          tractId: 'A1',
          grossAcres: '100',
          pooledAcres: '100',
          description: '',
          nodeIds: ['owner-a', 'lease-a-node'],
          unitName: 'Raven Forest Unit A',
          unitCode: 'A',
        },
      ],
      nodes: [
        {
          ...createBlankNode('owner-a', null),
          grantee: 'A Owner',
          linkedOwnerId: 'owner-a-record',
          fraction: '1',
          initialFraction: '1',
        },
        {
          ...createBlankNode('lease-a-node', 'owner-a'),
          type: 'related' as const,
          relatedKind: 'lease' as const,
          linkedLeaseId: 'lease-a',
        },
      ],
      owners: [createBlankOwner('ws-1', { id: 'owner-a-record', name: 'A Owner' })],
      leases: [
        createBlankLease('ws-1', 'owner-a-record', {
          id: 'lease-a',
          lessee: 'Operator A',
          royaltyRate: '1/8',
          leasedInterest: '1',
          effectiveDate: '2024-01-01',
          docNo: 'LEASE-A',
        }),
      ],
      leaseholdAssignments: [
        {
          id: 'assignment-null-unit',
          assignor: 'Operator A',
          assignee: 'Unassigned WI Partner',
          scope: 'unit',
          unitCode: null,
          deskMapId: null,
          workingInterestFraction: '1/2',
          effectiveDate: '2024-02-01',
          sourceDocNo: 'ASG-NULL',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'assignment-a',
          assignor: 'Operator A',
          assignee: 'A WI Partner',
          scope: 'unit',
          unitCode: 'A',
          deskMapId: null,
          workingInterestFraction: '1/4',
          effectiveDate: '2024-02-02',
          sourceDocNo: 'ASG-A',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-null-unit',
          payee: 'Unassigned Override',
          scope: 'unit',
          unitCode: null,
          deskMapId: null,
          burdenFraction: '1/16',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-02',
          sourceDocNo: 'ORRI-NULL',
          notes: '',
          depthRange: 'all_depths',
        },
        {
          id: 'orri-a',
          payee: 'A Override',
          scope: 'unit',
          unitCode: 'A',
          deskMapId: null,
          burdenFraction: '1/32',
          burdenBasis: 'gross_8_8',
          effectiveDate: '2024-01-03',
          sourceDocNo: 'ORRI-A',
          notes: '',
          depthRange: 'all_depths',
        },
      ],
    });

    const nullAssignment = summary.assignments.find(
      (assignment) => assignment.id === 'assignment-null-unit'
    );
    const taggedAssignment = summary.assignments.find(
      (assignment) => assignment.id === 'assignment-a'
    );
    const nullOrri = summary.orris.find((orri) => orri.id === 'orri-null-unit');
    const taggedOrri = summary.orris.find((orri) => orri.id === 'orri-a');

    expect(summary.unitAssignmentWarningCount).toBe(2);
    expect(summary.unitAssignmentWarnings.map((warning) => warning.id)).toEqual([
      'assignment:assignment-null-unit:unitCode',
      'orri:orri-null-unit:unitCode',
    ]);
    expect(summary.unitAssignmentWarnings.every((warning) =>
      warning.message.includes('excluded - needs unit assignment')
    )).toBe(true);
    expect(nullAssignment).toEqual(
      expect.objectContaining({
        includedInMath: false,
        needsUnitAssignment: true,
        unitDecimal: '0',
      })
    );
    expect(nullOrri).toEqual(
      expect.objectContaining({
        includedInMath: false,
        needsUnitAssignment: true,
        unitDecimal: '0',
      })
    );
    expect(taggedAssignment).toEqual(
      expect.objectContaining({
        includedInMath: true,
        needsUnitAssignment: false,
      })
    );
    expect(taggedOrri).toEqual(
      expect.objectContaining({
        includedInMath: true,
        needsUnitAssignment: false,
      })
    );
    expect(summary.totalOrriDecimal).toBe('0.03125');
    expect(summary.tracts[0]?.nriBeforeOrriRate).toBe('0.875');
    expect(summary.tracts[0]?.netRevenueInterestBaseRate).toBe('0.84375');
    expect(summary.preWorkingInterestDecimal).toBe('0.84375');
    expect(summary.totalAssignedWorkingInterestDecimal).toBe('0.2109375');
    expect(summary.retainedWorkingInterestDecimal).toBe('0.6328125');

    const review = buildLeaseholdTransferOrderReview({
      unit: {
        name: 'Raven Forest Unit A',
        description: '',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
        jurisdiction: 'tx_fee',
      },
      unitSummary: summary,
      focusedDeskMapId: null,
    });
    const holdReasons = buildLeaseholdTransferOrderHoldReasons(summary);

    expect(holdReasons).toEqual([
      '2 unit-scoped ORRI/WI records excluded - needs unit assignment.',
    ]);
    expect(getTransferOrderEntryDisplayStatus('ready', holdReasons.length > 0)).toBe(
      'hold'
    );
    expect(review.rows.map((row) => row.id)).toContain('orri-orri-a');
    expect(review.rows.map((row) => row.id)).toContain('assignment-assignment-a');
    expect(review.rows.map((row) => row.id)).not.toContain('orri-orri-null-unit');
    expect(review.rows.map((row) => row.id)).not.toContain(
      'assignment-assignment-null-unit'
    );
  });

  it('duplicate per-tract lease records yield the SAME math as one record on many nodes', () => {
    // The Springhill generator (and the per-tract attach modal) record one
    // instrument as N per-tract records. PR #212 collapses the DISPLAY; this
    // locks the underlying guarantee that the leasehold math reads lease-NODES
    // (not record count), so N identical records on N nodes == one record on N
    // nodes — and a future data-model fix would be byte-identical here.
    const deskMaps = [
      { id: 'dm-1', name: 'Tract 1', code: 'T1', tractId: 'T1', grossAcres: '100', pooledAcres: '100', description: '', nodeIds: ['n1', 'l1'] },
      { id: 'dm-2', name: 'Tract 2', code: 'T2', tractId: 'T2', grossAcres: '100', pooledAcres: '100', description: '', nodeIds: ['n2', 'l2'] },
    ];
    const owners = [createBlankOwner('ws-1', { id: 'owner-1', name: 'Multi-Tract Owner' })];
    const minerals = (lease1: string, lease2: string): OwnershipNode[] => [
      { ...createBlankNode('n1', null), grantee: 'Multi-Tract Owner', linkedOwnerId: 'owner-1', fraction: '1', initialFraction: '1' },
      { ...createBlankNode('n2', null), grantee: 'Multi-Tract Owner', linkedOwnerId: 'owner-1', fraction: '1', initialFraction: '1' },
      { ...createBlankNode('l1', 'n1'), type: 'related' as const, relatedKind: 'lease' as const, linkedLeaseId: lease1 },
      { ...createBlankNode('l2', 'n2'), type: 'related' as const, relatedKind: 'lease' as const, linkedLeaseId: lease2 },
    ];
    const ogml = (id: string) =>
      createBlankLease('ws-1', 'owner-1', {
        id,
        leaseName: 'OGML',
        lessee: 'Operator',
        royaltyRate: '1/8',
        leasedInterest: '1',
        effectiveDate: '2024-01-01',
        docNo: 'OGML-1',
      });
    const common = { owners, leaseholdAssignments: [], leaseholdOrris: [] };

    // N records, one lease-node each (today's duplicate model).
    const duplicated = buildLeaseholdUnitSummary({
      deskMaps,
      nodes: minerals('lease-1', 'lease-2'),
      leases: [ogml('lease-1'), ogml('lease-2')],
      ...common,
    });
    // One record, two lease-nodes (the target model).
    const consolidated = buildLeaseholdUnitSummary({
      deskMaps,
      nodes: minerals('lease-1', 'lease-1'),
      leases: [ogml('lease-1')],
      ...common,
    });

    const tractMath = (summary: typeof duplicated) =>
      summary.tracts.map((tract) => ({
        weightedRoyaltyRate: tract.weightedRoyaltyRate,
        unitRoyaltyDecimal: tract.unitRoyaltyDecimal,
        preWorkingInterestDecimal: tract.preWorkingInterestDecimal,
        retainedWorkingInterestDecimal: tract.retainedWorkingInterestDecimal,
        ownerRoyalties: tract.owners.map((owner) => owner.unitRoyaltyDecimal),
      }));

    expect(tractMath(duplicated)).toEqual(tractMath(consolidated));
    expect(duplicated.totalRoyaltyDecimal).toBe(consolidated.totalRoyaltyDecimal);
    expect(duplicated.preWorkingInterestDecimal).toBe(consolidated.preWorkingInterestDecimal);
    expect(duplicated.retainedWorkingInterestDecimal).toBe(consolidated.retainedWorkingInterestDecimal);
  });
});
