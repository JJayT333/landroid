import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { calculateDeskMapCoverageSummary } from '../src/components/deskmap/deskmap-coverage';
import {
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
} from '../src/components/leasehold/leasehold-summary';
import {
  buildDocumentRegistryRows,
  buildPacketManifest,
} from '../src/documents/document-registry';
import { buildVulcanMesaWorkspaceData } from '../src/storage/seed-vulcan-mesa';
import { buildRunsheetCsv } from '../src/storage/runsheet-export';
import { exportLandroidFile } from '../src/storage/workspace-persistence';
import type { DocumentAttachment, DocumentRecord } from '../src/types/document';
import { createBlankNode, type OwnershipNode } from '../src/types/node';
import type { Lease } from '../src/types/owner';

const FIXTURE_TIMESTAMP = '2026-05-23T17:00:00.000Z';
const FIXTURE_DATE_MS = Date.parse(FIXTURE_TIMESTAMP);
const FIXTURE_WORKSPACE_UUID = '00000000-0000-4000-8000-000000000001';
const OUTPUT_DIR = join('fixtures', 'phase-0');

function installDeterministicRuntime() {
  Date.now = () => FIXTURE_DATE_MS;

  const currentCrypto = globalThis.crypto ?? {};
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      ...currentCrypto,
      randomUUID: () => FIXTURE_WORKSPACE_UUID,
    },
  });
}

function isoFromDate(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00.000Z`;
  }
  return FIXTURE_TIMESTAMP;
}

function countyFromLandDesc(value: string) {
  return value.match(/([A-Za-z .'-]+?)\s+County\b/i)?.[1]?.trim() ?? 'Walker';
}

function makeStubPdfBytes(label: string) {
  const escaped = label.replace(/[()\\]/g, '\\$&');
  return Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >> endobj',
      `4 0 obj << /Length ${escaped.length + 42} >> stream`,
      `BT /F1 10 Tf 24 96 Td (${escaped}) Tj ET`,
      'endstream endobj',
      'trailer << /Root 1 0 R >>',
      '%%EOF',
      '',
    ].join('\n'),
    'utf8'
  );
}

function makeSerializedPdf(label: string) {
  return {
    mimeType: 'application/pdf',
    base64: makeStubPdfBytes(label).toString('base64'),
  };
}

function hashBytes(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function cloneNodes(nodes: OwnershipNode[]) {
  return nodes.map((node) => ({
    ...node,
    attachments: [...node.attachments],
  }));
}

function buildDocumentData(workspaceId: string, nodes: OwnershipNode[], pdfMappings: Array<{
  nodeId: string;
  fileName: string;
  kind?: DocumentRecord['kind'];
}>) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const positionByNodeId = new Map<string, number>();
  const documents: DocumentRecord[] = [];
  const attachments: DocumentAttachment[] = [];

  pdfMappings.forEach((mapping, index) => {
    const node = nodeById.get(mapping.nodeId);
    if (!node) return;

    const docNumber = String(index + 1).padStart(3, '0');
    const docId = `demo-doc-${docNumber}`;
    const attachmentId = `demo-attachment-${docNumber}`;
    const fileName = mapping.fileName;
    const kind = mapping.kind ?? 'other';
    const bytes = makeStubPdfBytes(`${docId} ${fileName}`);
    const createdAt = isoFromDate(node.fileDate || node.date);
    const position = positionByNodeId.get(node.id) ?? 0;
    positionByNodeId.set(node.id, position + 1);

    documents.push({
      docId,
      workspaceId,
      fileName,
      mimeType: 'application/pdf',
      byteLength: bytes.byteLength,
      contentHash: hashBytes(bytes),
      blob: new Blob([bytes], { type: 'application/pdf' }),
      kind,
      displayTitle: node.instrument ? `${node.instrument} - ${node.docNo || fileName}` : fileName,
      documentArea: kind === 'lease' ? 'leasehold' : 'runsheet_mineral_title',
      instrumentType: node.instrument || undefined,
      county: countyFromLandDesc(node.landDesc),
      instrumentNumber: node.docNo || undefined,
      volume: node.vol || undefined,
      page: node.page || undefined,
      effectiveDate: node.date || undefined,
      recordingDate: node.fileDate || undefined,
      grantor: node.grantor || undefined,
      grantee: node.grantee || undefined,
      notes: 'Phase 0 fixture stub PDF; metadata is derived from the Vulcan Mesa seed.',
      sourceReference: `Vulcan Mesa fixture ${docNumber}`,
      ocrStatus: 'not_started',
      createdAt,
      updatedAt: createdAt,
      externalRefs: [],
    });

    attachments.push({
      attachmentId,
      workspaceId,
      docId,
      entityKind: 'node',
      entityId: node.id,
      position,
      createdAt,
    });

    node.attachments.push({
      docId,
      attachmentId,
      fileName,
      kind,
    });
  });

  return { documents, attachments };
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

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, stableJson(value), 'utf8');
}

async function writeMigrationStressFixture() {
  const workspaceId = 'ws-phase0-migration';
  const linkedNode = {
    ...createBlankNode('legacy-node-1', null),
    instrument: 'Warranty Deed',
    docNo: 'LEGACY-001',
    date: '1965-01-15',
    fileDate: '1965-01-20',
    grantor: 'Jupiter Flats Ranch',
    grantee: 'Vulcan Mesa Petroleum, LLC',
    landDesc: 'Legacy Survey, Walker County, Texas',
    initialFraction: '1.000000000',
    fraction: '1.000000000',
  };
  const payload = {
    version: 7,
    exportedAt: FIXTURE_TIMESTAMP,
    workspaceId,
    projectName: 'Phase 0 Migration Stress',
    nodes: [linkedNode],
    deskMaps: [],
    activeDeskMapId: null,
    activeUnitCode: null,
    instrumentTypes: ['Warranty Deed'],
    pdfData: {
      pdfs: [
        {
          nodeId: linkedNode.id,
          fileName: 'legacy-linked.pdf',
          mimeType: 'application/pdf',
          blob: makeSerializedPdf('legacy linked pdf'),
          createdAt: '2025-12-01T00:00:00.000Z',
        },
        {
          nodeId: 'legacy-orphan-node',
          fileName: 'legacy-orphan.pdf',
          mimeType: 'application/pdf',
          blob: makeSerializedPdf('legacy orphan pdf'),
          createdAt: '2025-12-02T00:00:00.000Z',
        },
      ],
    },
  };
  const text = stableJson(payload);
  await writeFile(join(OUTPUT_DIR, 'migration-v7-orphan.landroid'), text, 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  await writeFile(
    join(OUTPUT_DIR, 'migration-v7-orphan.sha256'),
    `${hash}  migration-v7-orphan.landroid\n`,
    'utf8'
  );
  await writeJson(join(OUTPUT_DIR, 'migration-v7-orphan.expected.json'), {
    sourceVersion: 7,
    workspaceId,
    expectedDocumentCount: 2,
    expectedAttachmentCount: 2,
    linkedEntityIds: [linkedNode.id, 'legacy-orphan-node'],
    orphanNodeId: 'legacy-orphan-node',
    orphanBehavior:
      'Importer preserves the orphan PDF by assigning it to the fallback workspace and retaining the original orphan node ID on the attachment.',
    fileNames: ['legacy-linked.pdf', 'legacy-orphan.pdf'],
    landroidSha256: hash,
  });
}

async function main() {
  installDeterministicRuntime();
  const workspace = buildVulcanMesaWorkspaceData();
  const nodes = cloneNodes(workspace.nodes);
  const documentData = buildDocumentData(
    workspace.workspaceId,
    nodes,
    workspace.pdfMappings
  );

  await mkdir(OUTPUT_DIR, { recursive: true });

  const landroidBlob = await exportLandroidFile({
    workspaceId: workspace.workspaceId,
    projectName: workspace.projectName,
    nodes,
    deskMaps: workspace.deskMaps,
    leaseholdUnit: workspace.leaseholdUnit,
    leaseholdAssignments: workspace.leaseholdAssignments,
    leaseholdOrris: workspace.leaseholdOrris,
    leaseholdTransferOrderEntries: workspace.leaseholdTransferOrderEntries,
    activeDeskMapId: workspace.activeDeskMapId,
    activeUnitCode: workspace.activeUnitCode,
    instrumentTypes: workspace.instrumentTypes,
    ownerData: workspace.ownerData,
    documentData,
    mapData: { mapAssets: [], mapRegions: [], mapReferences: [] },
    researchData: { imports: [], sources: [], formulas: [], projectRecords: [], questions: [] },
    curativeData: { issues: [] },
  });
  const landroidPayload = JSON.parse(await landroidBlob.text()) as Record<string, unknown>;
  landroidPayload.exportedAt = FIXTURE_TIMESTAMP;
  const landroidText = stableJson(landroidPayload);
  const landroidPath = join(OUTPUT_DIR, 'demo.landroid');
  await writeFile(landroidPath, landroidText, 'utf8');

  const landroidHash = createHash('sha256').update(landroidText).digest('hex');
  await writeFile(join(OUTPUT_DIR, 'demo.sha256'), `${landroidHash}  demo.landroid\n`, 'utf8');
  await writeFile(join(OUTPUT_DIR, 'demo.runsheet.csv'), `${buildRunsheetCsv(nodes)}\r\n`, 'utf8');

  const registryRows = buildDocumentRegistryRows({
    documents: documentData.documents.map(({ blob: _blob, ...doc }) => doc),
    attachments: documentData.attachments,
    nodes,
    deskMaps: workspace.deskMaps,
  });
  await writeJson(join(OUTPUT_DIR, 'demo.packet-manifest.json'), buildPacketManifest(registryRows));

  const unitSummary = buildLeaseholdUnitSummary({
    deskMaps: workspace.deskMaps,
    nodes,
    owners: workspace.ownerData.owners,
    leases: workspace.ownerData.leases,
    leaseholdAssignments: workspace.leaseholdAssignments,
    leaseholdOrris: workspace.leaseholdOrris,
  });
  await writeJson(join(OUTPUT_DIR, 'demo.leasehold-decimals.json'), {
    projectName: workspace.projectName,
    unitRows: buildLeaseholdDecimalRows({
      unit: workspace.leaseholdUnit,
      unitSummary,
      focusedDeskMapId: null,
    }),
    focusedRowsByTractCode: Object.fromEntries(
      workspace.deskMaps.map((deskMap) => [
        deskMap.code,
        buildLeaseholdDecimalRows({
          unit: workspace.leaseholdUnit,
          unitSummary,
          focusedDeskMapId: deskMap.id,
        }),
      ])
    ),
    transferOrderReview: buildLeaseholdTransferOrderReview({
      unit: workspace.leaseholdUnit,
      unitSummary,
      focusedDeskMapId: null,
    }),
  });

  const leasesByOwner = activeLeasesByOwnerId(workspace.ownerData.leases);
  await writeJson(join(OUTPUT_DIR, 'demo.coverage-summary.json'), {
    projectName: workspace.projectName,
    tracts: workspace.deskMaps.map((deskMap) => {
      const tractNodes = nodes.filter((node) => deskMap.nodeIds.includes(node.id));
      return {
        code: deskMap.code,
        name: deskMap.name,
        summary: calculateDeskMapCoverageSummary(tractNodes, leasesByOwner, nodes),
      };
    }),
  });

  await writeJson(join(OUTPUT_DIR, 'demo.fixture-manifest.json'), {
    generatedAt: FIXTURE_TIMESTAMP,
    generator: 'scripts/generate-phase-0-fixtures.ts',
    workspaceId: workspace.workspaceId,
    projectName: workspace.projectName,
    nodeCount: nodes.length,
    deskMapCount: workspace.deskMaps.length,
    ownerCount: workspace.ownerData.owners.length,
    leaseCount: workspace.ownerData.leases.length,
    documentCount: documentData.documents.length,
    attachmentCount: documentData.attachments.length,
    landroidSha256: landroidHash,
    note: 'Document blobs are deterministic stub PDFs. Metadata and attachment links come from the Vulcan Mesa seed.',
  });

  await writeFile(
    join(OUTPUT_DIR, 'README.md'),
    [
      '# Phase 0 Fixtures',
      '',
      'Generated reference artifacts for the Phase 0 behavior inventory.',
      '',
      '## W1 - Vulcan Mesa',
      '',
      '- `demo.landroid`: deterministic v8 workspace export for the Vulcan Mesa demo fixture.',
      '- `demo.sha256`: SHA-256 checksum for `demo.landroid`.',
      '- `demo.runsheet.csv`: runsheet CSV golden from the exported nodes.',
      '- `demo.packet-manifest.json`: document packet manifest golden from the fixture document registry rows.',
      '- `demo.leasehold-decimals.json`: leasehold decimal and transfer-order review golden.',
      '- `demo.coverage-summary.json`: Desk Map mineral coverage summary golden per tract.',
      '- `demo.fixture-manifest.json`: counts, generator name, and checksum metadata.',
      '- `migration-v7-orphan.landroid`: hand-crafted legacy v7 import fixture with one linked PDF and one orphaned PDF.',
      '- `migration-v7-orphan.expected.json`: expected migration behavior for the orphaned legacy PDF.',
      '',
      'The fixture uses deterministic stub PDF blobs so the document registry, packet manifest, and `.landroid` side-store shape are testable without committing the large TORS document corpus.',
      '',
      'Regenerate with:',
      '',
      '```bash',
      './node_modules/.bin/tsx scripts/generate-phase-0-fixtures.ts',
      '```',
      '',
    ].join('\n'),
    'utf8'
  );

  await writeMigrationStressFixture();

  console.log(`Wrote ${OUTPUT_DIR}/demo.landroid (${Buffer.byteLength(landroidText)} bytes)`);
  console.log(`SHA-256 ${landroidHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
