import { describe, expect, it } from 'vitest';
import {
  buildTractCsv,
  buildTractExportRows,
  buildTractGeoJson,
  type TractExportInput,
} from '../tract-export';
import {
  buildLeaseholdUnitSummary,
  calculateDeskMapCoverageSummary,
  getActiveLeases,
} from '../../title-math';
import { normalizeMapTractFeature } from '../../types/map-tract-feature';
import {
  createBlankNode,
  normalizeOwnershipNode,
  type DeskMap,
  type OwnershipNode,
} from '../../types/node';
import { createBlankLease, createBlankOwner, type Lease } from '../../types/owner';

const WS = 'ws-export';

function root(): OwnershipNode {
  return normalizeOwnershipNode({
    ...createBlankNode('root'),
    grantor: 'State of Texas',
    grantee: 'Acme',
    instrument: 'Patent',
    fraction: '1.000000000',
    initialFraction: '1.000000000',
    interestClass: 'mineral',
    linkedOwnerId: 'owner-1',
  });
}

function deskMap(): DeskMap {
  return {
    id: 'dm-1',
    name: 'Tract One',
    code: 'T-1',
    tractId: 'LAND-1',
    grossAcres: '100',
    pooledAcres: '100',
    description: '',
    nodeIds: ['root'],
  } as DeskMap;
}

function lease(): Lease {
  return createBlankLease(WS, 'owner-1', {
    id: 'lease-1',
    leaseName: 'Lease',
    lessee: 'Operator',
    royaltyRate: '1/8',
    leasedInterest: '1/2',
    effectiveDate: '2026-01-01',
    jurisdiction: 'tx_fee',
  });
}

function tractFeature(
  id: string,
  tractKey: string,
  matchedDeskMapId: string | null
) {
  return normalizeMapTractFeature({
    id,
    workspaceId: WS,
    assetId: 'asset-1',
    tractKey,
    acres: 110,
    acresText: '110 ac',
    objectId: 1,
    polygons: [{ outer: [[-95, 30], [-94, 30], [-94, 31]], holes: [] }],
    bbox: [-95, 30, -94, 31],
    matchedDeskMapId,
  });
}

function makeInput(): TractExportInput {
  return {
    tractFeatures: [
      tractFeature('f-matched', 'T-1', 'dm-1'),
      tractFeature('f-unmatched', 'X', null),
    ],
    deskMaps: [deskMap()],
    nodes: [root()],
    owners: [createBlankOwner(WS, { id: 'owner-1', name: 'Acme', entityType: 'Company' })],
    leases: [lease()],
    leaseholdAssignments: [],
    leaseholdOrris: [],
  };
}

describe('buildTractExportRows', () => {
  it('emits one row per MATCHED feature, keyed LAND_TRACT_ID', () => {
    const rows = buildTractExportRows(makeInput());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      landTractId: 'LAND-1',
      tractKey: 'T-1',
      deskMapCode: 'T-1',
      gisAcres: 110,
      objectId: '1',
    });
  });

  it('embeds the engine numbers verbatim (read-only parity)', () => {
    const input = makeInput();
    const [row] = buildTractExportRows(input);

    const unit = buildLeaseholdUnitSummary({
      deskMaps: input.deskMaps as DeskMap[],
      nodes: input.nodes as OwnershipNode[],
      owners: [...input.owners],
      leases: [...input.leases],
      leaseholdAssignments: [],
      leaseholdOrris: [],
    });
    const tract = unit.tracts.find((t) => t.deskMapId === 'dm-1')!;
    expect(row.unitRoyaltyDecimal).toBe(tract.unitRoyaltyDecimal);
    expect(row.nriBeforeOrriRate).toBe(tract.nriBeforeOrriRate);
    expect(row.totalOrriBurdenRate).toBe(tract.totalOrriBurdenRate);
    expect(row.retainedWorkingInterestDecimal).toBe(tract.retainedWorkingInterestDecimal);
    expect(row.unitParticipation).toBe(tract.unitParticipation);

    const byOwner = new Map<string, Lease[]>();
    for (const active of getActiveLeases([...input.leases])) {
      byOwner.set(active.ownerId, [...(byOwner.get(active.ownerId) ?? []), active]);
    }
    const coverage = calculateDeskMapCoverageSummary(
      input.nodes as OwnershipNode[],
      byOwner,
      input.nodes as OwnershipNode[]
    );
    expect(row.coverageFound).toBe(coverage.currentOwnership);
    expect(row.coverageLeased).toBe(coverage.leasedOwnership);
  });

  it('returns nothing when no feature is matched', () => {
    const input = makeInput();
    expect(
      buildTractExportRows({
        ...input,
        tractFeatures: [tractFeature('f', 'T-1', null)],
      })
    ).toEqual([]);
  });
});

describe('buildTractCsv', () => {
  it('has the LAND_TRACT_ID header and one data row', () => {
    const csv = buildTractCsv(buildTractExportRows(makeInput()));
    const [header, ...lines] = csv.split('\r\n');
    expect(header.startsWith('LAND_TRACT_ID,Tract,')).toBe(true);
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('LAND-1,T-1,')).toBe(true);
  });
});

describe('buildTractGeoJson', () => {
  it('round-trips the source geometry with LANDroid attributes', () => {
    const parsed = JSON.parse(buildTractGeoJson(makeInput()));
    expect(parsed.type).toBe('FeatureCollection');
    expect(parsed.features).toHaveLength(1);
    const feature = parsed.features[0];
    expect(feature.geometry.type).toBe('Polygon');
    // original WGS84 coordinates preserved
    expect(feature.geometry.coordinates[0][0]).toEqual([-95, 30]);
    // clean ArcGIS join key + the LANDroid decimals attached
    expect(feature.properties.LAND_TRACT_ID).toBe('LAND-1');
    expect(feature.properties).toHaveProperty('Retained WI');
    expect(feature.properties).toHaveProperty('Coverage Found');
  });
});
