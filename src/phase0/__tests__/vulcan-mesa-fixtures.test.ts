import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { calculateDeskMapCoverageSummary } from '../../components/deskmap/deskmap-coverage';
import {
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
} from '../../components/leasehold/leasehold-summary';
import {
  buildDocumentRegistryRows,
  buildPacketManifest,
} from '../../documents/document-registry';
import { parseWorkbookSync } from '../../ai/wizard/parse-workbook-impl';
import { buildRunsheetCsv } from '../../storage/runsheet-export';
import { importLandroidFile } from '../../storage/workspace-persistence';
import type { DocumentAttachment, DocumentRecord } from '../../types/document';
import type { DeskMap, OwnershipNode } from '../../types/node';
import type { Lease, Owner } from '../../types/owner';
import type {
  LeaseholdAssignment,
  LeaseholdOrri,
  LeaseholdUnit,
} from '../../types/leasehold';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'phase-0');

interface SerializedLandroidFixture {
  version: number;
  projectName: string;
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
  leaseholdUnit: LeaseholdUnit;
  leaseholdAssignments: LeaseholdAssignment[];
  leaseholdOrris: LeaseholdOrri[];
  documentData: {
    documents: Array<Omit<DocumentRecord, 'blob'> & { blob: unknown }>;
    attachments: DocumentAttachment[];
  };
  ownerData: {
    owners: Owner[];
    leases: Lease[];
  };
}

function readText(fileName: string) {
  return readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
}

function readBuffer(fileName: string) {
  return readFileSync(join(FIXTURE_DIR, fileName));
}

function readJson<T>(fileName: string): T {
  return JSON.parse(readText(fileName)) as T;
}

function activeLeasesByOwnerId(leases: Lease[]) {
  const result = new Map<string, Lease[]>();
  for (const lease of leases) {
    const current = result.get(lease.ownerId) ?? [];
    current.push(lease);
    result.set(lease.ownerId, current);
  }
  return result;
}

function registryDocuments(fixture: SerializedLandroidFixture) {
  return fixture.documentData.documents.map(({ blob: _blob, ...document }) => document);
}

describe('Phase 0 Vulcan Mesa fixture goldens', () => {
  it('keeps the demo .landroid checksum stable', () => {
    const payload = readText('demo.landroid');
    const checksum = createHash('sha256').update(payload).digest('hex');

    expect(readText('demo.sha256')).toBe(`${checksum}  demo.landroid\n`);
    expect(checksum).toBe(readJson<{ landroidSha256: string }>('demo.fixture-manifest.json').landroidSha256);
  });

  it('freezes the expected exported workspace shape', () => {
    const fixture = readJson<SerializedLandroidFixture>('demo.landroid');
    const manifest = readJson<{
      projectName: string;
      nodeCount: number;
      deskMapCount: number;
      ownerCount: number;
      leaseCount: number;
      documentCount: number;
      attachmentCount: number;
    }>('demo.fixture-manifest.json');

    expect(fixture.version).toBe(8);
    expect(fixture.projectName).toBe(manifest.projectName);
    expect(fixture.nodes).toHaveLength(manifest.nodeCount);
    expect(fixture.deskMaps).toHaveLength(manifest.deskMapCount);
    expect(fixture.ownerData.owners).toHaveLength(manifest.ownerCount);
    expect(fixture.ownerData.leases).toHaveLength(manifest.leaseCount);
    expect(fixture.documentData.documents).toHaveLength(manifest.documentCount);
    expect(fixture.documentData.attachments).toHaveLength(manifest.attachmentCount);
  });

  it('freezes the runsheet CSV output', () => {
    const fixture = readJson<SerializedLandroidFixture>('demo.landroid');

    expect(readText('demo.runsheet.csv')).toBe(`${buildRunsheetCsv(fixture.nodes)}\r\n`);
  });

  it('freezes the document packet manifest', () => {
    const fixture = readJson<SerializedLandroidFixture>('demo.landroid');
    const rows = buildDocumentRegistryRows({
      documents: registryDocuments(fixture),
      attachments: fixture.documentData.attachments,
      nodes: fixture.nodes,
      deskMaps: fixture.deskMaps,
    });

    expect(readJson('demo.packet-manifest.json')).toEqual(buildPacketManifest(rows));
  });

  it('freezes leasehold decimal and transfer-order review output', () => {
    const fixture = readJson<SerializedLandroidFixture>('demo.landroid');
    const unitSummary = buildLeaseholdUnitSummary({
      deskMaps: fixture.deskMaps,
      nodes: fixture.nodes,
      owners: fixture.ownerData.owners,
      leases: fixture.ownerData.leases,
      leaseholdAssignments: fixture.leaseholdAssignments,
      leaseholdOrris: fixture.leaseholdOrris,
    });

    expect(readJson('demo.leasehold-decimals.json')).toEqual({
      projectName: fixture.projectName,
      unitRows: buildLeaseholdDecimalRows({
        unit: fixture.leaseholdUnit,
        unitSummary,
        focusedDeskMapId: null,
      }),
      focusedRowsByTractCode: Object.fromEntries(
        fixture.deskMaps.map((deskMap) => [
          deskMap.code,
          buildLeaseholdDecimalRows({
            unit: fixture.leaseholdUnit,
            unitSummary,
            focusedDeskMapId: deskMap.id,
          }),
        ])
      ),
      transferOrderReview: buildLeaseholdTransferOrderReview({
        unit: fixture.leaseholdUnit,
        unitSummary,
        focusedDeskMapId: null,
      }),
    });
  });

  it('freezes Desk Map coverage summaries per tract', () => {
    const fixture = readJson<SerializedLandroidFixture>('demo.landroid');
    const leasesByOwner = activeLeasesByOwnerId(fixture.ownerData.leases);

    expect(readJson('demo.coverage-summary.json')).toEqual({
      projectName: fixture.projectName,
      tracts: fixture.deskMaps.map((deskMap) => {
        const tractNodes = fixture.nodes.filter((node) => deskMap.nodeIds.includes(node.id));
        return {
          code: deskMap.code,
          name: deskMap.name,
          summary: calculateDeskMapCoverageSummary(tractNodes, leasesByOwner, fixture.nodes),
        };
      }),
    });
  });

  it('freezes the v7 orphaned-PDF migration fixture behavior', async () => {
    const expected = readJson<{
      workspaceId: string;
      expectedDocumentCount: number;
      expectedAttachmentCount: number;
      linkedEntityIds: string[];
      orphanNodeId: string;
    }>('migration-v7-orphan.expected.json');
    const originalCrypto = globalThis.crypto;
    let idCounter = 0;

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        subtle: originalCrypto.subtle,
        randomUUID: () => `phase0-migration-id-${++idCounter}`,
      },
    });

    try {
      const file = new File(
        [readText('migration-v7-orphan.landroid')],
        'migration-v7-orphan.landroid',
        { type: 'application/json' }
      );
      const imported = await importLandroidFile(file);

      expect(imported.workspaceId).toBe(expected.workspaceId);
      expect(imported.documentData?.documents).toHaveLength(expected.expectedDocumentCount);
      expect(imported.documentData?.attachments).toHaveLength(expected.expectedAttachmentCount);
      expect(imported.documentData?.attachments.map((row) => row.entityId).sort()).toEqual(
        [...expected.linkedEntityIds].sort()
      );
      expect(
        imported.documentData?.attachments.find(
          (row) => row.entityId === expected.orphanNodeId
        )?.workspaceId
      ).toBe(expected.workspaceId);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it('freezes the W2 Raven Forest stress manifest shape', () => {
    const manifestText = readText('raven-forest-stress-manifest.json');
    const checksum = createHash('sha256').update(manifestText).digest('hex');
    const manifest = JSON.parse(manifestText) as {
      workspaceId: string;
      nodeCount: number;
      nodeCountsByClass: {
        mineral: number;
        npri: number;
        related: number;
        lease: number;
      };
      deskMapCount: number;
      unitCount: number;
      ownerCount: number;
      leaseCount: number;
      documentCount: number;
      attachmentCount: number;
      federalReferenceLeaseCount: number;
      warningMarkers: {
        orphanParentRefs: number;
        topLeaseOverlapMarkers: number;
        overConveyanceMarkers: number;
      };
      performanceBaselineWorkloads: string[];
    };

    expect(readText('raven-forest-stress-manifest.sha256')).toBe(
      `${checksum}  raven-forest-stress-manifest.json\n`
    );
    expect(manifest.workspaceId).toBe('ws-00000000-0000-4000-8000-000000000002');
    expect(manifest.nodeCount).toBe(1476);
    expect(manifest.nodeCountsByClass).toEqual({
      mineral: 642,
      npri: 246,
      related: 174,
      lease: 414,
    });
    expect(manifest.deskMapCount).toBe(10);
    expect(manifest.unitCount).toBe(2);
    expect(manifest.ownerCount).toBe(658);
    expect(manifest.leaseCount).toBe(414);
    expect(manifest.documentCount).toBe(145);
    expect(manifest.attachmentCount).toBe(145);
    expect(manifest.federalReferenceLeaseCount).toBe(5);
    expect(manifest.warningMarkers).toMatchObject({
      orphanParentRefs: 1,
      topLeaseOverlapMarkers: 241,
      overConveyanceMarkers: 2,
    });
    expect(manifest.performanceBaselineWorkloads).toEqual([
      'PERF-01',
      'PERF-02',
      'PERF-03',
      'PERF-04',
      'PERF-06',
      'PERF-08',
    ]);
  });

  it('freezes the PERF-07 import stress CSV parse shape', () => {
    const csv = readText('import-stress.csv');
    const checksum = createHash('sha256').update(csv).digest('hex');
    const expected = readJson<{
      fileName: string;
      rowCountIncludingHeader: number;
      dataRowCount: number;
      columnCount: number;
      sampledRowCount: number;
      headers: string[];
      csvSha256: string;
    }>('import-stress.expected.json');
    const buffer = readBuffer('import-stress.csv');
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    const parsed = parseWorkbookSync(expected.fileName, arrayBuffer);
    const sheet = parsed.sheets[0];

    expect(readText('import-stress.sha256')).toBe(`${checksum}  import-stress.csv\n`);
    expect(expected.csvSha256).toBe(checksum);
    expect(sheet.rawRowCount).toBe(expected.rowCountIncludingHeader);
    expect(sheet.allRows).toHaveLength(expected.rowCountIncludingHeader);
    expect(sheet.rawColCount).toBe(expected.columnCount);
    expect(sheet.rows).toHaveLength(expected.sampledRowCount);
    expect(sheet.allRows[0]).toEqual(expected.headers);
    expect(sheet.allRows[1][0]).toBe('T01');
    expect(sheet.allRows[expected.dataRowCount][6]).toBe('P0-05000');
  });
});
