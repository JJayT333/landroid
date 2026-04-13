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
    // Behavior pin: parseInterestString('') returns 0, so a lease with a missing royalty
    // contributes 0 to the royalty burden and the lessee retains the full leased WI.
    // This prevents silent NaN but also means data-entry omissions are invisible —
    // the "missing royalty" warning surface is a separate piece of work (see audit finding #9).
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
    expect(Number.isFinite(Number(summary.tracts[0]?.preWorkingInterestDecimal))).toBe(true);
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
    expect(summary.tracts[0]?.npriAdjustedNriBeforeOrriRate).toBe('0.8125');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.8125');
    expect(summary.tracts[0]?.owners[0]).toEqual(
      expect.objectContaining({
        ownerTractRoyalty: '0.125',
        netOwnerTractRoyalty: '0.0625',
        unitRoyaltyDecimal: '0.125',
        netOwnerUnitRoyaltyDecimal: '0.0625',
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
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'royalty',
          payee: 'Mineral Owner',
          decimal: '0.0625',
        }),
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
          decimal: '0.8125',
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
      { category: 'royalty', rowCount: 1, totalDecimal: '0.0625' },
      { category: 'npri', rowCount: 2, totalDecimal: '0.125' },
      { category: 'retained_wi', rowCount: 1, totalDecimal: '0.8125' },
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
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.8125');

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

    expect(royaltyRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ payee: 'Root Owner', decimal: '0.0625' }),
        expect.objectContaining({ payee: 'Child Owner', decimal: '0.0625' }),
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
        },
      ],
    });

    expect(summary.tracts[0]?.nriBeforeOrriRate).toBe('0.875');
    expect(summary.tracts[0]?.fixedNpriBurdenRate).toBe('0.0625');
    expect(summary.tracts[0]?.npriAdjustedNriBeforeOrriRate).toBe('0.8125');
    expect(summary.tracts[0]?.netRevenueInterestBaseRate).toBe('0.8125');
    expect(summary.tracts[0]?.netRevenueInterestOrriBurdenRate).toBe('0.08125');
    expect(summary.tracts[0]?.preWorkingInterestDecimal).toBe('0.73125');
    expect(summary.orris[0]?.unitDecimal).toBe('0.08125');
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
});
