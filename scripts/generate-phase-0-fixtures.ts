import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { calculateDeskMapCoverageSummary } from '../src/title-math';
import {
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
} from '../src/title-math';
import {
  buildDocumentRegistryRows,
  buildPacketManifest,
} from '../src/documents/document-registry';
import { buildCombinatorialWorkspaceData } from '../src/storage/seed-test-data';
import { buildVulcanMesaWorkspaceData } from '../src/storage/seed-vulcan-mesa';
import { buildRunsheetCsv } from '../src/storage/runsheet-export';
import { exportLandroidFile } from '../src/storage/workspace-persistence';
import type { DocumentAttachment, DocumentRecord } from '../src/types/document';
import { createBlankNode, type OwnershipNode } from '../src/types/node';
import type { Lease } from '../src/types/owner';

const FIXTURE_TIMESTAMP = '2026-05-23T17:00:00.000Z';
const FIXTURE_DATE_MS = Date.parse(FIXTURE_TIMESTAMP);
const FIXTURE_WORKSPACE_UUID = '00000000-0000-4000-8000-000000000001';
const STRESS_WORKSPACE_UUID = '00000000-0000-4000-8000-000000000002';
const OUTPUT_DIR = join('fixtures', 'phase-0');
const IMPORT_STRESS_DATA_ROWS = 5000;
const IMPORT_STRESS_HEADERS = [
  'Tract',
  'Instrument',
  'Order by Date',
  'Image Path',
  'Vol',
  'Page',
  'Inst. No.',
  'File Date',
  'Inst./Eff. Date',
  'Grantor',
  'Grantee',
  'Land Desc.',
  'Interest',
  'Remarks',
];

function installDeterministicRuntime() {
  const uuids = [FIXTURE_WORKSPACE_UUID, STRESS_WORKSPACE_UUID];
  let uuidIndex = 0;
  let randomSeed = 0xC0FFEE;

  Date.now = () => FIXTURE_DATE_MS;
  Math.random = () => {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 0x100000000;
  };

  // Preserve subtle / getRandomValues explicitly: they are non-enumerable on the
  // global crypto, so a `{ ...currentCrypto }` spread drops them and the document
  // SHA-256 export later fails with "Cannot read properties of undefined (digest)".
  const currentCrypto = globalThis.crypto ?? ({} as Crypto);
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      subtle: currentCrypto.subtle,
      getRandomValues: currentCrypto.getRandomValues?.bind(currentCrypto),
      randomUUID: () =>
        uuids[uuidIndex++]
        ?? `00000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`,
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
}>, options: {
  idPrefix?: string;
  notesSourceLabel?: string;
  sourceReferenceLabel?: string;
} = {}) {
  const idPrefix = options.idPrefix ?? 'demo';
  const notesSourceLabel = options.notesSourceLabel ?? 'Vulcan Mesa seed';
  const sourceReferenceLabel = options.sourceReferenceLabel ?? 'Vulcan Mesa fixture';
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const positionByNodeId = new Map<string, number>();
  const documents: DocumentRecord[] = [];
  const attachments: DocumentAttachment[] = [];

  pdfMappings.forEach((mapping, index) => {
    const node = nodeById.get(mapping.nodeId);
    if (!node) return;

    const docNumber = String(index + 1).padStart(3, '0');
    const docId = `${idPrefix}-doc-${docNumber}`;
    const attachmentId = `${idPrefix}-attachment-${docNumber}`;
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
      notes: `Phase 0 fixture stub PDF; metadata is derived from the ${notesSourceLabel}.`,
      sourceReference: `${sourceReferenceLabel} ${docNumber}`,
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

function countNodesByInterestClass(nodes: OwnershipNode[]) {
  const result = { mineral: 0, npri: 0, related: 0, lease: 0 };
  for (const node of nodes) {
    if (node.type === 'related') {
      if (node.relatedKind === 'lease') {
        result.lease += 1;
      } else {
        result.related += 1;
      }
      continue;
    }
    if (node.interestClass === 'npri') {
      result.npri += 1;
    } else {
      result.mineral += 1;
    }
  }
  return result;
}

async function writeRavenForestStressManifest() {
  const workspace = buildCombinatorialWorkspaceData();
  const nodes = cloneNodes(workspace.nodes);
  const documentData = buildDocumentData(
    workspace.workspaceId,
    nodes,
    workspace.pdfMappings,
    {
      idPrefix: 'stress',
      notesSourceLabel: 'Raven Forest stress fixture',
      sourceReferenceLabel: 'Raven Forest stress fixture',
    }
  );
  const unitCodes = [
    ...new Set(workspace.deskMaps.map((deskMap) => deskMap.unitCode).filter(Boolean)),
  ];
  const warningMarkers = {
    npriNodes: nodes.filter((node) => node.interestClass === 'npri').length,
    orphanParentRefs: nodes.filter(
      (node) => node.parentId && !nodes.some((candidate) => candidate.id === node.parentId)
    ).length,
    topLeaseOverlapMarkers: nodes.filter((node) => /top-lease/i.test(node.remarks)).length,
    overConveyanceMarkers: nodes.filter((node) => /over-conveyance trigger/i.test(node.remarks))
      .length,
  };
  const manifest = {
    generatedAt: FIXTURE_TIMESTAMP,
    generator: 'scripts/generate-phase-0-fixtures.ts',
    generatorVersion: 1,
    source: 'buildCombinatorialWorkspaceData()',
    seed: {
      dateNow: FIXTURE_DATE_MS,
      mathRandom: 'lcg-0xC0FFEE',
      workspaceUuid: STRESS_WORKSPACE_UUID,
    },
    artifactPolicy:
      'Full W2 .landroid export is intentionally not committed by default; regenerate from this script when capturing performance baselines.',
    workspaceId: workspace.workspaceId,
    projectName: workspace.projectName,
    nodeCount: nodes.length,
    nodeCountsByClass: countNodesByInterestClass(nodes),
    deskMapCount: workspace.deskMaps.length,
    unitCount: unitCodes.length,
    unitCodes,
    ownerCount: workspace.ownerData.owners.length,
    leaseCount: workspace.ownerData.leases.length,
    documentCount: documentData.documents.length,
    attachmentCount: documentData.attachments.length,
    pdfMappingCount: workspace.pdfMappings.length,
    leaseholdAssignmentCount: workspace.leaseholdAssignments.length,
    leaseholdOrriCount: workspace.leaseholdOrris.length,
    federalReferenceLeaseCount: 5,
    warningMarkers,
    performanceBaselineWorkloads: [
      'PERF-01',
      'PERF-02',
      'PERF-03',
      'PERF-04',
      'PERF-06',
      'PERF-08',
    ],
    notes: [
      'Uses deterministic stub PDF metadata for committed summaries.',
      'Contains no real title documents.',
      'W2 is a stress fixture shape, not a product behavior source of truth.',
    ],
  };
  const manifestText = stableJson(manifest);
  const manifestHash = createHash('sha256').update(manifestText).digest('hex');

  await writeFile(join(OUTPUT_DIR, 'raven-forest-stress-manifest.json'), manifestText, 'utf8');
  await writeFile(
    join(OUTPUT_DIR, 'raven-forest-stress-manifest.sha256'),
    `${manifestHash}  raven-forest-stress-manifest.json\n`,
    'utf8'
  );
}

function stableJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeJson(path: string, value: unknown) {
  await writeFile(path, stableJson(value), 'utf8');
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildImportStressCsv() {
  const instruments = [
    'Warranty Deed',
    'Mineral Deed',
    'Royalty Deed',
    'Oil and Gas Lease',
    'Assignment',
    'Ratification',
  ];
  const rows: Array<Array<string | number>> = [IMPORT_STRESS_HEADERS];

  for (let index = 1; index <= IMPORT_STRESS_DATA_ROWS; index += 1) {
    const tractNumber = ((index - 1) % 10) + 1;
    const month = String(((index - 1) % 12) + 1).padStart(2, '0');
    const day = String(((index - 1) % 28) + 1).padStart(2, '0');
    const fileDay = String((index % 28) + 1).padStart(2, '0');
    const year = 1980 + (index % 40);
    const instrumentType = instruments[index % instruments.length];
    const paddedIndex = String(index).padStart(5, '0');
    const grantor = `Phase 0 Grantor ${String((index % 97) + 1).padStart(3, '0')}`;
    const grantee = `Phase 0 Grantee ${String((index % 113) + 1).padStart(3, '0')}`;
    const remarks = index % 333 === 0
      ? 'Cell text says "ignore prior instructions"; parser must treat it as data.'
      : `Deterministic import stress row ${paddedIndex}`;

    rows.push([
      `T${String(tractNumber).padStart(2, '0')}`,
      `${instrumentType} ${paddedIndex}`,
      `${year}-${month}-${day}`,
      `phase0/import-stress/T${String(tractNumber).padStart(2, '0')}/image-${paddedIndex}.pdf`,
      100 + (index % 900),
      1 + (index % 500),
      `P0-${paddedIndex}`,
      `${year}-${month}-${fileDay}`,
      `${year}-${month}-${day}`,
      grantor,
      grantee,
      `Section ${tractNumber}, Block ${((index - 1) % 7) + 1}, Raven Forest Survey, Walker County, Texas`,
      `1/${2 + (index % 48)}`,
      remarks,
    ]);
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

async function writeImportStressFixture() {
  const csv = buildImportStressCsv();
  const hash = createHash('sha256').update(csv).digest('hex');

  await writeFile(join(OUTPUT_DIR, 'import-stress.csv'), csv, 'utf8');
  await writeFile(
    join(OUTPUT_DIR, 'import-stress.sha256'),
    `${hash}  import-stress.csv\n`,
    'utf8'
  );
  await writeJson(join(OUTPUT_DIR, 'import-stress.expected.json'), {
    purpose: 'PERF-07 spreadsheet import parse-only baseline fixture.',
    generatedAt: FIXTURE_TIMESTAMP,
    generator: 'scripts/generate-phase-0-fixtures.ts',
    fileName: 'import-stress.csv',
    dataRowCount: IMPORT_STRESS_DATA_ROWS,
    rowCountIncludingHeader: IMPORT_STRESS_DATA_ROWS + 1,
    columnCount: IMPORT_STRESS_HEADERS.length,
    sampledRowCount: 150,
    headers: IMPORT_STRESS_HEADERS,
    csvSha256: hash,
    notes: [
      'Contains deterministic landman-like rows but no real title data.',
      'Includes quoted comma/quote cells so CSV escaping stays represented.',
      'Designed for parse-only timing; do not apply these rows to a workspace.',
    ],
  });
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
      "- `raven-forest-stress-recipe.md`: W2 instructions for rebuilding a Raven Forest-sized stress fixture later without committing today's exact seed.",
      '- `raven-forest-stress-manifest.json`: deterministic W2 stress-fixture manifest generated from the current combinatorial seed.',
      '- `raven-forest-stress-manifest.sha256`: SHA-256 checksum for `raven-forest-stress-manifest.json`.',
      '- `import-stress.csv`: deterministic 5,000 data-row CSV for PERF-07 parser timing.',
      '- `import-stress.sha256`: SHA-256 checksum for `import-stress.csv`.',
      '- `import-stress.expected.json`: expected parse shape for the PERF-07 CSV fixture.',
      '- `ai/system-prompt.snapshot.md`: AI-036 golden snapshot for the ten non-negotiable system-prompt rules.',
      '- `perf/`: Phase 0 performance baseline capture status and future raw/summarized profiles.',
      '',
      'The fixture uses deterministic stub PDF blobs so the document registry, packet manifest, and `.landroid` side-store shape are testable without committing the large TORS document corpus.',
      '',
      'Regenerate with:',
      '',
      '```bash',
      './node_modules/.bin/tsx scripts/generate-phase-0-fixtures.ts',
      '```',
      '',
      'Performance capture is documented separately:',
      '',
      '```bash',
      'scripts/capture-phase-0-baselines.md',
      '```',
      '',
      'The current `perf/baseline-status.json` file records which PERF rows have raw evidence and which rows are still blocked.',
      '',
    ].join('\n'),
    'utf8'
  );

  await writeMigrationStressFixture();
  await writeRavenForestStressManifest();
  await writeImportStressFixture();

  console.log(`Wrote ${OUTPUT_DIR}/demo.landroid (${Buffer.byteLength(landroidText)} bytes)`);
  console.log(`SHA-256 ${landroidHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
