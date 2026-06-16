/**
 * Per-tract export, keyed `LAND_TRACT_ID` (DA2-M PR M3).
 *
 * For each matched tract feature, join its DeskMap's LANDroid leasehold/coverage
 * numbers (read-only — straight from the unified engine) onto the GIS attributes
 * and emit a CSV row and/or an enriched GeoJSON feature. The GeoJSON carries the
 * original WGS84 geometry so it round-trips back into ArcGIS with the LANDroid
 * decimals attached.
 */
import type { MapTractFeature, TractPolygon } from '../types/map-tract-feature';
import type { DeskMap, OwnershipNode } from '../types/node';
import type { Lease, Owner } from '../types/owner';
import type { LeaseholdAssignment, LeaseholdOrri } from '../types/leasehold';
import {
  buildLeaseholdUnitSummary,
  calculateDeskMapCoverageSummary,
  getActiveLeases,
} from '../title-math';

export interface TractExportInput {
  tractFeatures: readonly MapTractFeature[];
  deskMaps: readonly DeskMap[];
  nodes: readonly OwnershipNode[];
  owners: readonly Owner[];
  leases: readonly Lease[];
  leaseholdAssignments: readonly LeaseholdAssignment[];
  leaseholdOrris: readonly LeaseholdOrri[];
}

export interface TractExportRow {
  /** internal pairing key (not emitted to CSV) */
  featureId: string;
  landTractId: string;
  tractKey: string;
  deskMapCode: string;
  deskMapName: string;
  gisAcres: number | null;
  grossAcres: string;
  pooledAcres: string;
  unitRoyaltyDecimal: string;
  nriBeforeOrriRate: string;
  totalOrriBurdenRate: string;
  retainedWorkingInterestDecimal: string;
  unitParticipation: string;
  coverageFound: string;
  coverageLeased: string;
  objectId: string;
  globalId: string;
}

function nodesForDeskMap(
  deskMap: DeskMap,
  nodeById: Map<string, OwnershipNode>
): OwnershipNode[] {
  return deskMap.nodeIds
    .map((id) => nodeById.get(id))
    .filter((node): node is OwnershipNode => Boolean(node));
}

function leaseScopeNodesForDeskMap(
  deskMap: DeskMap,
  deskMaps: readonly DeskMap[],
  nodeById: Map<string, OwnershipNode>
): OwnershipNode[] {
  const unitCode = (deskMap.unitCode ?? '').trim();
  if (!unitCode) return nodesForDeskMap(deskMap, nodeById);
  return deskMaps
    .filter((candidate) => (candidate.unitCode ?? '').trim() === unitCode)
    .flatMap((candidate) => nodesForDeskMap(candidate, nodeById));
}

function groupActiveLeasesByOwnerId(leases: readonly Lease[]): Map<string, Lease[]> {
  const byOwner = new Map<string, Lease[]>();
  for (const lease of getActiveLeases([...leases])) {
    const list = byOwner.get(lease.ownerId) ?? [];
    list.push(lease);
    byOwner.set(lease.ownerId, list);
  }
  return byOwner;
}

/** One export row per MATCHED tract feature (sorted by LAND_TRACT_ID). */
export function buildTractExportRows(input: TractExportInput): TractExportRow[] {
  const matched = input.tractFeatures.filter((feature) => feature.matchedDeskMapId);
  if (matched.length === 0) return [];

  const deskMapById = new Map(input.deskMaps.map((dm) => [dm.id, dm]));
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const unitSummary = buildLeaseholdUnitSummary({
    deskMaps: [...input.deskMaps],
    nodes: [...input.nodes],
    owners: [...input.owners],
    leases: [...input.leases],
    leaseholdAssignments: [...input.leaseholdAssignments],
    leaseholdOrris: [...input.leaseholdOrris],
  });
  const tractByDeskMapId = new Map(unitSummary.tracts.map((tract) => [tract.deskMapId, tract]));
  const activeLeasesByOwnerId = groupActiveLeasesByOwnerId(input.leases);

  const rows: TractExportRow[] = [];
  for (const feature of matched) {
    const deskMap = feature.matchedDeskMapId
      ? deskMapById.get(feature.matchedDeskMapId)
      : undefined;
    if (!deskMap) continue;
    const tract = tractByDeskMapId.get(deskMap.id);
    const coverage = calculateDeskMapCoverageSummary(
      nodesForDeskMap(deskMap, nodeById),
      activeLeasesByOwnerId,
      leaseScopeNodesForDeskMap(deskMap, input.deskMaps, nodeById)
    );
    rows.push({
      featureId: feature.id,
      landTractId: (deskMap.tractId || deskMap.code || feature.tractKey).trim(),
      tractKey: feature.tractKey,
      deskMapCode: deskMap.code,
      deskMapName: deskMap.name,
      gisAcres: feature.acres,
      grossAcres: deskMap.grossAcres,
      pooledAcres: deskMap.pooledAcres,
      unitRoyaltyDecimal: tract?.unitRoyaltyDecimal ?? '',
      nriBeforeOrriRate: tract?.nriBeforeOrriRate ?? '',
      totalOrriBurdenRate: tract?.totalOrriBurdenRate ?? '',
      retainedWorkingInterestDecimal: tract?.retainedWorkingInterestDecimal ?? '',
      unitParticipation: tract?.unitParticipation ?? '',
      coverageFound: coverage.currentOwnership,
      coverageLeased: coverage.leasedOwnership,
      objectId: feature.objectId !== undefined ? String(feature.objectId) : '',
      globalId: feature.globalId ?? '',
    });
  }
  return rows.sort((a, b) => a.landTractId.localeCompare(b.landTractId));
}

// ── CSV ──────────────────────────────────────────────────────────────────────

const CSV_COLUMNS: Array<[keyof TractExportRow, string]> = [
  ['landTractId', 'LAND_TRACT_ID'],
  ['tractKey', 'Tract'],
  ['deskMapCode', 'DeskMap Code'],
  ['deskMapName', 'DeskMap Name'],
  ['gisAcres', 'GIS Acres'],
  ['grossAcres', 'Gross Acres'],
  ['pooledAcres', 'Pooled Acres'],
  ['unitRoyaltyDecimal', 'Unit Royalty'],
  ['nriBeforeOrriRate', 'NRI Before ORRI'],
  ['totalOrriBurdenRate', 'ORRI Burden'],
  ['retainedWorkingInterestDecimal', 'Retained WI'],
  ['unitParticipation', 'Unit Participation'],
  ['coverageFound', 'Coverage Found'],
  ['coverageLeased', 'Coverage Leased'],
  ['objectId', 'ArcGIS ObjectID'],
  ['globalId', 'ArcGIS GlobalID'],
];

function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildTractCsv(rows: readonly TractExportRow[]): string {
  const lines = [
    CSV_COLUMNS.map(([, header]) => header),
    ...rows.map((row) => CSV_COLUMNS.map(([key]) => row[key])),
  ];
  return lines.map((line) => line.map(escapeCsvCell).join(',')).join('\r\n');
}

// ── GeoJSON (round-trips the source geometry + LANDroid attributes) ───────────

function ringToCoordinates(ring: TractPolygon['outer']): number[][] {
  return ring.map(([lon, lat]) => [lon, lat]);
}

function polygonsToGeometry(polygons: TractPolygon[]): Record<string, unknown> {
  const asRings = (polygon: TractPolygon): number[][][] => [
    ringToCoordinates(polygon.outer),
    ...polygon.holes.map(ringToCoordinates),
  ];
  if (polygons.length === 1) {
    return { type: 'Polygon', coordinates: asRings(polygons[0]) };
  }
  return { type: 'MultiPolygon', coordinates: polygons.map(asRings) };
}

/** Properties keyed by the ArcGIS-friendly column names (clean `LAND_TRACT_ID`). */
function geoJsonProperties(row: TractExportRow): Record<string, unknown> {
  return Object.fromEntries(CSV_COLUMNS.map(([key, header]) => [header, row[key]]));
}

export function buildTractGeoJson(input: TractExportInput): string {
  const rows = buildTractExportRows(input);
  const rowByFeatureId = new Map(rows.map((row) => [row.featureId, row]));
  const features = input.tractFeatures
    .filter((feature) => rowByFeatureId.has(feature.id))
    .map((feature) => ({
      type: 'Feature' as const,
      geometry: polygonsToGeometry(feature.polygons),
      properties: geoJsonProperties(rowByFeatureId.get(feature.id)!),
    }));
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

// ── Browser download helpers ─────────────────────────────────────────────────

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '-') || 'workspace';
}

export function downloadTractCsv(input: TractExportInput, projectName: string): void {
  const csv = buildTractCsv(buildTractExportRows(input));
  downloadBlob(
    new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }),
    `${sanitizeFileNamePart(projectName)}-tracts.csv`
  );
}

export function downloadTractGeoJson(input: TractExportInput, projectName: string): void {
  downloadBlob(
    new Blob([buildTractGeoJson(input)], { type: 'application/geo+json' }),
    `${sanitizeFileNamePart(projectName)}-tracts.geojson`
  );
}
