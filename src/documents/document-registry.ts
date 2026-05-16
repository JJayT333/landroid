import type { DeskMap, OwnershipNode } from '../types/node';
import type {
  DocumentArea,
  DocumentAttachment,
  DocumentKind,
  DocumentParties,
  DocumentRecord,
} from '../types/document';
import {
  DOCUMENT_AREA_OPTIONS,
  documentNeedsOcr,
  getDocumentAreaMetadata,
  getDocumentInstrumentDate,
  getDocumentParties,
  getDocumentSourceRef,
  normalizeDocumentArea,
} from '../types/document';

export type RegistryDocument = Omit<DocumentRecord, 'blob'>;

export type DocumentRegistryViewId =
  | 'all'
  | 'inbox'
  | 'runsheet_mineral_title'
  | 'leasehold'
  | 'curative'
  | 'research'
  | 'gis_map_support'
  | 'federal_reference'
  | 'unlinked'
  | 'missing_metadata'
  | 'duplicates'
  | 'needs_ocr';

export const DOCUMENT_REGISTRY_VIEWS: Array<{
  id: DocumentRegistryViewId;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'inbox', label: 'Inbox / Needs review' },
  { id: 'runsheet_mineral_title', label: 'Runsheet / Mineral Title' },
  { id: 'leasehold', label: 'Leasehold' },
  { id: 'curative', label: 'Curative' },
  { id: 'research', label: 'Research' },
  { id: 'gis_map_support', label: 'GIS / Map Support' },
  { id: 'federal_reference', label: 'Federal Reference' },
  { id: 'unlinked', label: 'Unlinked' },
  { id: 'missing_metadata', label: 'Missing metadata' },
  { id: 'duplicates', label: 'Duplicates' },
  { id: 'needs_ocr', label: 'Needs OCR' },
];

export const DOCUMENT_AREA_LABELS: Record<DocumentArea, string> = {
  inbox: 'Inbox',
  runsheet_mineral_title: 'Runsheet / Mineral Title',
  leasehold: 'Leasehold',
  curative: 'Curative',
  research: 'Research',
  gis_map_support: 'GIS / Map Support',
  federal_reference: 'Federal Reference',
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  deed: 'Deed',
  lease: 'Lease',
  obit: 'Obituary',
  affidavit: 'Affidavit',
  probate: 'Probate',
  related: 'Related',
  other: 'Other',
};

export interface LinkedEntitySummary {
  attachmentId: string;
  entityKind: DocumentAttachment['entityKind'];
  entityId: string;
  tractIds: string[];
  label: string;
  detail: string;
  position: number;
}

export interface DocumentRegistryRow {
  document: RegistryDocument;
  displayTitle: string;
  resolvedArea: DocumentArea;
  linkedEntities: LinkedEntitySummary[];
  duplicateDocIds: string[];
  missingMetadata: string[];
  needsOcr: boolean;
  searchText: string;
}

export interface DocumentRegistryFilters {
  view: DocumentRegistryViewId;
  searchQuery?: string;
  kind?: DocumentKind | 'all';
  tractId?: string | 'all';
  linkedState?: 'all' | 'linked' | 'unlinked';
  dateFrom?: string;
  dateTo?: string;
}

export interface PacketPreview {
  rows: DocumentRegistryRow[];
  totalBytes: number;
  uniqueContentHashCount: number;
  missingMetadataCount: number;
  duplicateDocCount: number;
  unlinkedCount: number;
  needsOcrCount: number;
  readyDocCount: number;
  warningCount: number;
  areaCounts: Array<{ area: DocumentArea; label: string; count: number }>;
}

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

function defaultAreaForKind(kind: DocumentKind): DocumentArea {
  if (kind === 'lease') return 'leasehold';
  if (
    kind === 'deed'
    || kind === 'obit'
    || kind === 'affidavit'
    || kind === 'probate'
    || kind === 'related'
  ) {
    return 'runsheet_mineral_title';
  }
  return 'inbox';
}

export function getDocumentDisplayTitle(doc: RegistryDocument): string {
  return clean(doc.displayTitle) || clean(doc.fileName) || doc.docId;
}

export function getDocumentResolvedArea(doc: RegistryDocument): DocumentArea {
  const explicitArea = getDocumentAreaMetadata(doc);
  if (explicitArea) return normalizeDocumentArea(explicitArea);
  return defaultAreaForKind(doc.kind);
}

function docDateValue(doc: RegistryDocument): string {
  return clean(doc.recordingDate) || getDocumentInstrumentDate(doc) || doc.createdAt;
}

function datePasses(value: string, from: string | undefined, to: string | undefined) {
  if (!from && !to) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  if (from) {
    const fromTime = new Date(from).getTime();
    if (Number.isFinite(fromTime) && time < fromTime) return false;
  }
  if (to) {
    const toTime = new Date(to).getTime();
    if (Number.isFinite(toTime) && time > toTime) return false;
  }
  return true;
}

function describeNode(node: OwnershipNode): { label: string; detail: string } {
  const labelParts = [
    clean(node.instrument) || (node.type === 'related' ? 'Related document' : 'Title node'),
    clean(node.docNo) ? `#${clean(node.docNo)}` : '',
  ].filter(Boolean);
  const parties = [clean(node.grantor), clean(node.grantee)].filter(Boolean).join(' to ');
  const detailParts = [
    node.type,
    parties,
  ].filter(Boolean);
  return {
    label: labelParts.join(' '),
    detail: detailParts.join(' | '),
  };
}

function buildTractsByNode(deskMaps: DeskMap[]): Map<string, string[]> {
  const tractsByNode = new Map<string, string[]>();
  for (const deskMap of deskMaps) {
    for (const nodeId of deskMap.nodeIds) {
      const current = tractsByNode.get(nodeId) ?? [];
      current.push(deskMap.name);
      tractsByNode.set(nodeId, current);
    }
  }
  return tractsByNode;
}

function buildTractIdsByNode(deskMaps: DeskMap[]): Map<string, string[]> {
  const tractIdsByNode = new Map<string, string[]>();
  for (const deskMap of deskMaps) {
    for (const nodeId of deskMap.nodeIds) {
      const current = tractIdsByNode.get(nodeId) ?? [];
      current.push(deskMap.id);
      tractIdsByNode.set(nodeId, current);
    }
  }
  return tractIdsByNode;
}

function buildLinkedEntitySummaries(
  docId: string,
  attachments: DocumentAttachment[],
  nodesById: Map<string, OwnershipNode>,
  tractsByNode: Map<string, string[]>,
  tractIdsByNode: Map<string, string[]>
): LinkedEntitySummary[] {
  return attachments
    .filter((attachment) => attachment.docId === docId)
    .sort((a, b) => a.position - b.position)
    .map((attachment) => {
      if (attachment.entityKind === 'node') {
        const node = nodesById.get(attachment.entityId);
        if (node) {
          const nodeSummary = describeNode(node);
          const tractNames = tractsByNode.get(node.id) ?? [];
          return {
            attachmentId: attachment.attachmentId,
            entityKind: attachment.entityKind,
            entityId: attachment.entityId,
            tractIds: tractIdsByNode.get(node.id) ?? [],
            label: nodeSummary.label,
            detail: [nodeSummary.detail, tractNames.join(', ')].filter(Boolean).join(' | '),
            position: attachment.position,
          };
        }
      }

      return {
        attachmentId: attachment.attachmentId,
        entityKind: attachment.entityKind,
        entityId: attachment.entityId,
        tractIds: [],
        label: `${attachment.entityKind} ${attachment.entityId}`,
        detail: '',
        position: attachment.position,
      };
    });
}

function metadataMissing(doc: RegistryDocument): string[] {
  const missing: string[] = [];
  const parties = getDocumentParties(doc);
  if (!getDocumentDisplayTitle(doc)) missing.push('title');
  if (!clean(doc.instrumentType)) missing.push('instrument type');
  if (!clean(doc.county)) missing.push('county');
  if (!clean(doc.instrumentNumber) && !(clean(doc.volume) && clean(doc.page))) {
    missing.push('recording reference');
  }
  if (!getDocumentInstrumentDate(doc) && !clean(doc.recordingDate)) {
    missing.push('date');
  }
  if (!hasAnyParty(parties)) {
    missing.push('parties');
  }
  return missing;
}

function hasAnyParty(parties: DocumentParties): boolean {
  return Boolean(parties.grantor || parties.grantee || parties.lessor || parties.lessee);
}

function formatParties(parties: DocumentParties): string {
  const grantorGrantee = [parties.grantor, parties.grantee]
    .map(clean)
    .filter(Boolean)
    .join(' to ');
  if (grantorGrantee) return grantorGrantee;
  return [parties.lessor, parties.lessee]
    .map(clean)
    .filter(Boolean)
    .join(' to ');
}

function buildDuplicateMap(documents: RegistryDocument[]): Map<string, string[]> {
  const byHash = new Map<string, string[]>();
  for (const doc of documents) {
    const hash = clean(doc.contentHash);
    if (!hash) continue;
    const current = byHash.get(hash) ?? [];
    current.push(doc.docId);
    byHash.set(hash, current);
  }

  const duplicateByDocId = new Map<string, string[]>();
  for (const docIds of byHash.values()) {
    if (docIds.length < 2) continue;
    for (const docId of docIds) {
      duplicateByDocId.set(
        docId,
        docIds.filter((candidate) => candidate !== docId)
      );
    }
  }
  return duplicateByDocId;
}

export function buildDocumentRegistryRows(input: {
  documents: RegistryDocument[];
  attachments: DocumentAttachment[];
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
}): DocumentRegistryRow[] {
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  const tractsByNode = buildTractsByNode(input.deskMaps);
  const tractIdsByNode = buildTractIdsByNode(input.deskMaps);
  const duplicateByDocId = buildDuplicateMap(input.documents);

  return input.documents
    .map((document) => {
      const linkedEntities = buildLinkedEntitySummaries(
        document.docId,
        input.attachments,
        nodesById,
        tractsByNode,
        tractIdsByNode
      );
      const displayTitle = getDocumentDisplayTitle(document);
      const resolvedArea = getDocumentResolvedArea(document);
      const missingMetadata = metadataMissing(document);
      const parties = getDocumentParties(document);
      const searchText = [
        displayTitle,
        document.fileName,
        DOCUMENT_AREA_LABELS[resolvedArea],
        DOCUMENT_KIND_LABELS[document.kind],
        document.instrumentType,
        document.county,
        document.instrumentNumber,
        document.volume,
        document.page,
        getDocumentInstrumentDate(document),
        document.recordingDate,
        document.state,
        parties.grantor,
        parties.grantee,
        parties.lessor,
        parties.lessee,
        parties.notes,
        formatParties(parties),
        document.notes,
        getDocumentSourceRef(document),
        ...(document.externalRefs ?? []).flatMap((ref) => [
          ref.system,
          ref.externalId,
          ref.label,
          ref.url,
          ref.path,
        ]),
        ...linkedEntities.flatMap((entity) => [entity.label, entity.detail]),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        document,
        displayTitle,
        resolvedArea,
        linkedEntities,
        duplicateDocIds: duplicateByDocId.get(document.docId) ?? [],
        missingMetadata,
        needsOcr: documentNeedsOcr(document),
        searchText,
      };
    })
    .sort((a, b) => docDateValue(b.document).localeCompare(docDateValue(a.document)));
}

function rowMatchesView(row: DocumentRegistryRow, view: DocumentRegistryViewId) {
  if (view === 'all') return true;
  if (view === 'unlinked') return row.linkedEntities.length === 0;
  if (view === 'missing_metadata') return row.missingMetadata.length > 0;
  if (view === 'duplicates') return row.duplicateDocIds.length > 0;
  if (view === 'needs_ocr') return row.needsOcr;
  if (view === 'inbox') {
    return row.resolvedArea === 'inbox' || row.missingMetadata.length > 0;
  }
  return row.resolvedArea === view;
}

function rowMatchesTract(row: DocumentRegistryRow, tractId: string | undefined) {
  if (!tractId || tractId === 'all') return true;
  return row.linkedEntities.some((entity) => entity.tractIds.includes(tractId));
}

export function filterDocumentRegistryRows(
  rows: DocumentRegistryRow[],
  filters: DocumentRegistryFilters
): DocumentRegistryRow[] {
  const query = filters.searchQuery?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (!rowMatchesView(row, filters.view)) return false;
    if (query && !row.searchText.includes(query)) return false;
    if (filters.kind && filters.kind !== 'all' && row.document.kind !== filters.kind) {
      return false;
    }
    if (filters.linkedState === 'linked' && row.linkedEntities.length === 0) {
      return false;
    }
    if (filters.linkedState === 'unlinked' && row.linkedEntities.length > 0) {
      return false;
    }
    if (!rowMatchesTract(row, filters.tractId)) return false;
    return datePasses(docDateValue(row.document), filters.dateFrom, filters.dateTo);
  });
}

export function buildPacketPreview(rows: DocumentRegistryRow[]): PacketPreview {
  const uniqueHashes = new Set(
    rows.map((row) => clean(row.document.contentHash)).filter(Boolean)
  );
  const areaCounts = DOCUMENT_AREA_OPTIONS.map((area) => ({
    area,
    label: DOCUMENT_AREA_LABELS[area],
    count: rows.filter((row) => row.resolvedArea === area).length,
  })).filter((entry) => entry.count > 0);
  const missingMetadataCount = rows.filter((row) => row.missingMetadata.length > 0).length;
  const duplicateDocCount = rows.filter((row) => row.duplicateDocIds.length > 0).length;
  const unlinkedCount = rows.filter((row) => row.linkedEntities.length === 0).length;
  const needsOcrCount = rows.filter((row) => row.needsOcr).length;
  const warningCount =
    missingMetadataCount + duplicateDocCount + unlinkedCount + needsOcrCount;
  return {
    rows,
    totalBytes: rows.reduce((total, row) => total + row.document.byteLength, 0),
    uniqueContentHashCount: uniqueHashes.size,
    missingMetadataCount,
    duplicateDocCount,
    unlinkedCount,
    needsOcrCount,
    readyDocCount: rows.filter(
      (row) =>
        row.missingMetadata.length === 0
        && row.duplicateDocIds.length === 0
        && row.linkedEntities.length > 0
        && !row.needsOcr
    ).length,
    warningCount,
    areaCounts,
  };
}

export function buildPacketManifest(rows: DocumentRegistryRow[]) {
  return rows.map((row, index) => ({
    packetOrder: index + 1,
    docId: row.document.docId,
    fileName: row.document.fileName,
    displayTitle: row.displayTitle,
    area: row.resolvedArea,
    kind: row.document.kind,
    byteLength: row.document.byteLength,
    contentHash: row.document.contentHash,
    instrumentType: row.document.instrumentType ?? '',
    county: row.document.county ?? '',
    state: row.document.state ?? '',
    instrumentNumber: row.document.instrumentNumber ?? '',
    volume: row.document.volume ?? '',
    page: row.document.page ?? '',
    instrumentDate: getDocumentInstrumentDate(row.document),
    recordingDate: row.document.recordingDate ?? '',
    parties: {
      grantor: getDocumentParties(row.document).grantor ?? '',
      grantee: getDocumentParties(row.document).grantee ?? '',
      lessor: getDocumentParties(row.document).lessor ?? '',
      lessee: getDocumentParties(row.document).lessee ?? '',
      notes: getDocumentParties(row.document).notes ?? '',
    },
    notes: row.document.notes ?? '',
    sourceRef: getDocumentSourceRef(row.document),
    externalRefs: row.document.externalRefs ?? [],
    linkedEntities: row.linkedEntities.map((entity) => ({
      attachmentId: entity.attachmentId,
      entityKind: entity.entityKind,
      entityId: entity.entityId,
      label: entity.label,
      detail: entity.detail,
    })),
    missingMetadata: row.missingMetadata,
    duplicateDocIds: row.duplicateDocIds,
    needsOcr: row.needsOcr,
  }));
}
