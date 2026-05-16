/**
 * Document registry — pure helpers for the document-room view.
 *
 * Keeps every list/filter/group computation Dexie-free so the registry
 * logic can be unit-tested without IndexedDB. The view reads documents
 * via `listWorkspaceDocuments` and feeds them through these helpers.
 *
 * Title math is unaffected — these helpers operate on
 * `DocumentRecord` metadata only.
 *
 * Phase 7A scope (registry/library, saved views, duplicate grouping,
 * title-opinion packet preview). Out of scope here: OCR, AI document
 * query, Dropbox sync, ArcGIS attachment import.
 */

import {
  DOCUMENT_AREA_LABELS,
  DOCUMENT_AREA_OPTIONS,
  effectiveDocumentArea,
  type DocumentArea,
  type DocumentAttachment,
  type DocumentKind,
  type DocumentRecord,
} from '../types/document';
import type { DeskMap, OwnershipNode } from '../types/node';

/** Metadata-only document shape (blob omitted). */
export type RegistryDocument = Omit<DocumentRecord, 'blob'>;

/** Saved-view IDs surfaced by the registry left rail. */
export const SAVED_VIEW_IDS = [
  'all',
  'mineral_title',
  'project_support',
  'leasehold',
  'curative',
  'research',
  'gis_map_support',
  'federal_reference',
  'other',
  'unlinked',
  'duplicates',
  'missing_metadata',
] as const;
export type SavedViewId = (typeof SAVED_VIEW_IDS)[number];

export interface SavedView {
  id: SavedViewId;
  label: string;
  /** One-line caption shown next to the view name. */
  help: string;
}

/**
 * Ordered list of saved views. The first eight correspond directly to
 * the seven `DocumentArea` filing populations the user enumerated
 * (mineral title runsheet, project support, leasehold, curative,
 * research, GIS/map support, federal reference) plus `other`. The last
 * three are computed views over the whole registry.
 */
export const SAVED_VIEWS: SavedView[] = [
  { id: 'all', label: 'All Documents', help: 'Every document in this workspace.' },
  { id: 'mineral_title', label: DOCUMENT_AREA_LABELS.mineral_title, help: 'Deeds, obits, affidavits, probate — the runsheet population.' },
  { id: 'project_support', label: DOCUMENT_AREA_LABELS.project_support, help: 'Project memos, status decks, internal references.' },
  { id: 'leasehold', label: DOCUMENT_AREA_LABELS.leasehold, help: 'Oil-and-gas leases, ratifications, top leases.' },
  { id: 'curative', label: DOCUMENT_AREA_LABELS.curative, help: 'Curative letters, affidavits, releases.' },
  { id: 'research', label: DOCUMENT_AREA_LABELS.research, help: 'Source packets, abstracts, research notes.' },
  { id: 'gis_map_support', label: DOCUMENT_AREA_LABELS.gis_map_support, help: 'Plats, survey plats, mapped exhibits.' },
  { id: 'federal_reference', label: DOCUMENT_AREA_LABELS.federal_reference, help: 'BLM/federal lease references (no Texas math).' },
  { id: 'other', label: DOCUMENT_AREA_LABELS.other, help: 'Uncategorized — re-tag from the inspector.' },
  { id: 'unlinked', label: 'Unlinked', help: 'Documents with no entity attachment.' },
  { id: 'duplicates', label: 'Duplicates', help: 'Same content hash as another file.' },
  { id: 'missing_metadata', label: 'Missing Metadata', help: 'Key registry fields not filled in yet.' },
];

/** Look up the metadata about a saved view. */
export function getSavedView(id: SavedViewId): SavedView {
  return SAVED_VIEWS.find((v) => v.id === id) ?? SAVED_VIEWS[0];
}

/** Human label for the document kind enum. */
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  deed: 'Deed',
  lease: 'Lease',
  obit: 'Obituary',
  affidavit: 'Affidavit',
  probate: 'Probate',
  related: 'Related Doc',
  other: 'Other',
};

/**
 * Entity-link summary for the inspector. Resolved so the view does not
 * have to chase nodeId → node mapping per render.
 */
export interface EntityLinkSummary {
  attachmentId: string;
  entityKind: DocumentAttachment['entityKind'];
  entityId: string;
  /** Human label, e.g. "Deed (Smith → Jones)". */
  label: string;
  /** Optional second line, e.g. tract names this node lives in. */
  detail: string;
  /** Tract IDs (DeskMap IDs) this attachment touches; empty if none. */
  tractIds: string[];
  position: number;
}

/** A registry row joins one document with its entity links and warnings. */
export interface RegistryRow {
  document: RegistryDocument;
  /** Effective area (explicit `area` ?? derived from `kind`). */
  area: DocumentArea;
  /** Display title — explicit `displayTitle` falls back to `fileName`. */
  displayTitle: string;
  /** Entity links resolved from `document_attachments`. */
  links: EntityLinkSummary[];
  /** Other doc IDs that share this row's content hash. */
  duplicateDocIds: string[];
  /** Which registry metadata fields are missing on this row. */
  missingMetadata: MissingMetadataField[];
  /** Concatenated lowercased search blob for free-text filter. */
  searchText: string;
  /** Best-known date for chronological sort: instrument, then recording, then created. */
  sortDate: string;
}

export type MissingMetadataField =
  | 'instrument_type'
  | 'county'
  | 'recording_reference'
  | 'date'
  | 'parties';

export const MISSING_METADATA_LABELS: Record<MissingMetadataField, string> = {
  instrument_type: 'instrument type',
  county: 'county',
  recording_reference: 'recording reference',
  date: 'date',
  parties: 'parties',
};

export interface RegistryFilters {
  view: SavedViewId;
  /** Free-text query. Case-insensitive substring across title, filename, parties, recording fields, notes, source ref. */
  query?: string;
  /** Kind filter (`'all'` keeps every kind). */
  kind?: DocumentKind | 'all';
  /** DeskMap (tract) ID filter; only documents linked to a node in that tract pass. */
  tractId?: string | 'all';
  /** Linked / unlinked toggle. */
  link?: 'all' | 'linked' | 'unlinked';
  /** ISO date lower bound (inclusive) applied to `sortDate`. */
  dateFrom?: string;
  /** ISO date upper bound (inclusive) applied to `sortDate`. */
  dateTo?: string;
}

export interface RegistryRowInput {
  documents: RegistryDocument[];
  attachments: DocumentAttachment[];
  nodes: OwnershipNode[];
  deskMaps: DeskMap[];
}

function nonEmpty(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function describeNode(node: OwnershipNode): { label: string; detail: string } {
  const instrument = nonEmpty(node.instrument) || (node.type === 'related' ? 'Related Doc' : 'Title Node');
  const parties = [nonEmpty(node.grantor), nonEmpty(node.grantee)].filter(Boolean).join(' → ');
  const docRef = nonEmpty(node.docNo) ? `#${nonEmpty(node.docNo)}` : '';
  return {
    label: [instrument, docRef].filter(Boolean).join(' '),
    detail: parties,
  };
}

function buildTractIndex(deskMaps: DeskMap[]): {
  namesByNodeId: Map<string, string[]>;
  idsByNodeId: Map<string, string[]>;
} {
  const namesByNodeId = new Map<string, string[]>();
  const idsByNodeId = new Map<string, string[]>();
  for (const deskMap of deskMaps) {
    for (const nodeId of deskMap.nodeIds) {
      const names = namesByNodeId.get(nodeId) ?? [];
      names.push(deskMap.name);
      namesByNodeId.set(nodeId, names);
      const ids = idsByNodeId.get(nodeId) ?? [];
      ids.push(deskMap.id);
      idsByNodeId.set(nodeId, ids);
    }
  }
  return { namesByNodeId, idsByNodeId };
}

function resolveLinks(
  docId: string,
  attachments: DocumentAttachment[],
  nodesById: Map<string, OwnershipNode>,
  tractNamesByNodeId: Map<string, string[]>,
  tractIdsByNodeId: Map<string, string[]>
): EntityLinkSummary[] {
  return attachments
    .filter((a) => a.docId === docId)
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((a) => {
      if (a.entityKind === 'node') {
        const node = nodesById.get(a.entityId);
        if (node) {
          const summary = describeNode(node);
          const tractNames = tractNamesByNodeId.get(node.id) ?? [];
          return {
            attachmentId: a.attachmentId,
            entityKind: a.entityKind,
            entityId: a.entityId,
            label: summary.label,
            detail: [summary.detail, tractNames.join(', ')].filter(Boolean).join(' · '),
            tractIds: tractIdsByNodeId.get(node.id) ?? [],
            position: a.position,
          };
        }
      }
      return {
        attachmentId: a.attachmentId,
        entityKind: a.entityKind,
        entityId: a.entityId,
        label: `${a.entityKind} ${a.entityId.slice(0, 8)}`,
        detail: '',
        tractIds: [],
        position: a.position,
      };
    });
}

function bestSortDate(doc: RegistryDocument): string {
  return (
    nonEmpty(doc.instrumentDate)
    || nonEmpty(doc.recordingDate)
    || nonEmpty(doc.createdAt)
  );
}

function detectMissing(doc: RegistryDocument): MissingMetadataField[] {
  const missing: MissingMetadataField[] = [];
  if (!nonEmpty(doc.instrumentType)) missing.push('instrument_type');
  if (!nonEmpty(doc.county)) missing.push('county');
  if (
    !nonEmpty(doc.instrumentNumber)
    && !(nonEmpty(doc.volume) && nonEmpty(doc.page))
  ) {
    missing.push('recording_reference');
  }
  if (!nonEmpty(doc.instrumentDate) && !nonEmpty(doc.recordingDate)) {
    missing.push('date');
  }
  const parties = doc.parties ?? {};
  const hasAnyParty = (
    nonEmpty(parties.grantor)
    || nonEmpty(parties.grantee)
    || nonEmpty(parties.lessor)
    || nonEmpty(parties.lessee)
  );
  if (!hasAnyParty) missing.push('parties');
  return missing;
}

function buildSearchText(
  doc: RegistryDocument,
  area: DocumentArea,
  links: EntityLinkSummary[]
): string {
  const parties = doc.parties ?? {};
  const pieces: Array<string | undefined> = [
    doc.displayTitle,
    doc.fileName,
    DOCUMENT_AREA_LABELS[area],
    DOCUMENT_KIND_LABELS[doc.kind],
    doc.instrumentType,
    doc.county,
    doc.state,
    doc.instrumentNumber,
    doc.volume,
    doc.page,
    doc.instrumentDate,
    doc.recordingDate,
    parties.grantor,
    parties.grantee,
    parties.lessor,
    parties.lessee,
    parties.notes,
    doc.notes,
    doc.sourceRef,
    ...links.map((l) => `${l.label} ${l.detail}`),
  ];
  return pieces
    .map((p) => (p ?? '').toString())
    .join(' ')
    .toLowerCase();
}

function groupDuplicatesByHash(documents: RegistryDocument[]): Map<string, string[]> {
  const byHash = new Map<string, string[]>();
  for (const doc of documents) {
    const hash = nonEmpty(doc.contentHash);
    if (!hash) continue;
    const list = byHash.get(hash) ?? [];
    list.push(doc.docId);
    byHash.set(hash, list);
  }
  const dups = new Map<string, string[]>();
  for (const ids of byHash.values()) {
    if (ids.length < 2) continue;
    for (const docId of ids) {
      dups.set(docId, ids.filter((id) => id !== docId));
    }
  }
  return dups;
}

/**
 * Build registry rows for the registry view. Sorted descending by
 * effective date so the most recently recorded/executed instrument lands
 * on top.
 */
export function buildRegistryRows(input: RegistryRowInput): RegistryRow[] {
  const nodesById = new Map(input.nodes.map((n) => [n.id, n]));
  const tractIndex = buildTractIndex(input.deskMaps);
  const duplicateDocIds = groupDuplicatesByHash(input.documents);

  const rows: RegistryRow[] = input.documents.map((document) => {
    const area = effectiveDocumentArea(document);
    const displayTitle = nonEmpty(document.displayTitle) || nonEmpty(document.fileName) || document.docId;
    const links = resolveLinks(
      document.docId,
      input.attachments,
      nodesById,
      tractIndex.namesByNodeId,
      tractIndex.idsByNodeId
    );
    const missingMetadata = detectMissing(document);
    return {
      document,
      area,
      displayTitle,
      links,
      duplicateDocIds: duplicateDocIds.get(document.docId) ?? [],
      missingMetadata,
      searchText: buildSearchText(document, area, links),
      sortDate: bestSortDate(document),
    };
  });

  rows.sort((a, b) => {
    if (a.sortDate === b.sortDate) {
      return a.displayTitle.localeCompare(b.displayTitle);
    }
    return b.sortDate.localeCompare(a.sortDate);
  });
  return rows;
}

function dateInRange(value: string, from: string | undefined, to: string | undefined): boolean {
  if (!nonEmpty(from) && !nonEmpty(to)) return true;
  const v = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(v)) return false;
  if (nonEmpty(from)) {
    const fromTime = new Date(from!).getTime();
    if (Number.isFinite(fromTime) && v < fromTime) return false;
  }
  if (nonEmpty(to)) {
    const toTime = new Date(to!).getTime();
    if (Number.isFinite(toTime) && v > toTime) return false;
  }
  return true;
}

function rowMatchesView(row: RegistryRow, view: SavedViewId): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'unlinked':
      return row.links.length === 0;
    case 'duplicates':
      return row.duplicateDocIds.length > 0;
    case 'missing_metadata':
      return row.missingMetadata.length > 0;
    default:
      // Area saved views.
      if ((DOCUMENT_AREA_OPTIONS as readonly string[]).includes(view)) {
        return row.area === view;
      }
      return true;
  }
}

/** Apply registry filters to a set of rows. Pure; order preserved. */
export function filterRegistryRows(
  rows: RegistryRow[],
  filters: RegistryFilters
): RegistryRow[] {
  const q = nonEmpty(filters.query).toLowerCase();
  return rows.filter((row) => {
    if (!rowMatchesView(row, filters.view)) return false;
    if (q && !row.searchText.includes(q)) return false;
    if (filters.kind && filters.kind !== 'all' && row.document.kind !== filters.kind) {
      return false;
    }
    if (filters.tractId && filters.tractId !== 'all') {
      if (!row.links.some((l) => l.tractIds.includes(filters.tractId!))) return false;
    }
    if (filters.link === 'linked' && row.links.length === 0) return false;
    if (filters.link === 'unlinked' && row.links.length > 0) return false;
    return dateInRange(row.sortDate, filters.dateFrom, filters.dateTo);
  });
}

/** Tally for the title-opinion packet preview panel. */
export interface PacketPreview {
  rows: RegistryRow[];
  totalBytes: number;
  unlinkedCount: number;
  duplicateCount: number;
  missingMetadataCount: number;
  /** Distinct content hashes — packets dedupe by hash on export. */
  uniqueHashCount: number;
}

/** Build the preview tally from the input row set. */
export function buildPacketPreview(rows: RegistryRow[]): PacketPreview {
  const seenHashes = new Set<string>();
  let totalBytes = 0;
  let unlinkedCount = 0;
  let duplicateCount = 0;
  let missingMetadataCount = 0;
  for (const row of rows) {
    totalBytes += Number.isFinite(row.document.byteLength) ? row.document.byteLength : 0;
    if (row.links.length === 0) unlinkedCount += 1;
    if (row.duplicateDocIds.length > 0) duplicateCount += 1;
    if (row.missingMetadata.length > 0) missingMetadataCount += 1;
    const hash = nonEmpty(row.document.contentHash);
    if (hash) seenHashes.add(hash);
  }
  return {
    rows,
    totalBytes,
    unlinkedCount,
    duplicateCount,
    missingMetadataCount,
    uniqueHashCount: seenHashes.size,
  };
}

export interface PacketManifestEntry {
  packetOrder: number;
  docId: string;
  fileName: string;
  displayTitle: string;
  area: DocumentArea;
  kind: DocumentKind;
  byteLength: number;
  contentHash: string;
  instrumentType: string;
  county: string;
  state: string;
  instrumentDate: string;
  recordingDate: string;
  volume: string;
  page: string;
  instrumentNumber: string;
  parties: {
    grantor: string;
    grantee: string;
    lessor: string;
    lessee: string;
    notes: string;
  };
  notes: string;
  sourceRef: string;
  links: Array<{
    attachmentId: string;
    entityKind: DocumentAttachment['entityKind'];
    entityId: string;
    label: string;
    detail: string;
  }>;
  missingMetadata: MissingMetadataField[];
  duplicateDocIds: string[];
}

/** Manifest entries are dense and 1-indexed for the packet cover sheet. */
export function buildPacketManifest(rows: RegistryRow[]): PacketManifestEntry[] {
  return rows.map((row, index) => ({
    packetOrder: index + 1,
    docId: row.document.docId,
    fileName: row.document.fileName,
    displayTitle: row.displayTitle,
    area: row.area,
    kind: row.document.kind,
    byteLength: row.document.byteLength,
    contentHash: row.document.contentHash,
    instrumentType: nonEmpty(row.document.instrumentType),
    county: nonEmpty(row.document.county),
    state: nonEmpty(row.document.state),
    instrumentDate: nonEmpty(row.document.instrumentDate),
    recordingDate: nonEmpty(row.document.recordingDate),
    volume: nonEmpty(row.document.volume),
    page: nonEmpty(row.document.page),
    instrumentNumber: nonEmpty(row.document.instrumentNumber),
    parties: {
      grantor: nonEmpty(row.document.parties?.grantor),
      grantee: nonEmpty(row.document.parties?.grantee),
      lessor: nonEmpty(row.document.parties?.lessor),
      lessee: nonEmpty(row.document.parties?.lessee),
      notes: nonEmpty(row.document.parties?.notes),
    },
    notes: nonEmpty(row.document.notes),
    sourceRef: nonEmpty(row.document.sourceRef),
    links: row.links.map((l) => ({
      attachmentId: l.attachmentId,
      entityKind: l.entityKind,
      entityId: l.entityId,
      label: l.label,
      detail: l.detail,
    })),
    missingMetadata: row.missingMetadata,
    duplicateDocIds: row.duplicateDocIds,
  }));
}
