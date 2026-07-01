/** Core domain types for ownership nodes and desk maps. */

import {
  DEFAULT_DEPTH_RANGE,
  normalizeDepthRange,
  type DepthRange,
} from './depth-range';
import {
  isDocumentKind,
  type DocumentKind,
} from './document';
import {
  normalizeExternalRefs,
  type ExternalRef,
} from './external-ref';
import { Decimal } from '../engine/decimal';

export type ConveyanceMode = 'fraction' | 'fixed' | 'all';
export type SplitBasis = 'initial' | 'remaining' | 'whole';
export type NodeType = 'conveyance' | 'related';
export type RelatedNodeKind = 'document' | 'lease';

/**
 * Node provenance — recorded vs. an unproven "Missing Link" placeholder.
 *
 * `'recorded'` (default, ABSENT on the node) — an ordinary node backed by a
 * recorded instrument; today's behavior, participates in title math normally.
 *
 * `'placeholder'` — a **Missing Link**: a stand-in for an unproven gap in the
 * chain (e.g. "grandma → ??? → grandson", an heirship or deed we cannot yet
 * establish). A placeholder is still a `type: 'conveyance'` node so it sits
 * structurally IN the chain and can parent the next owner, but the engine treats
 * it as a COMPUTATION BARRIER: it never fabricates a fraction below itself. The
 * record still saves and renders (warn-don't-block, like an over-conveyance);
 * it just refuses to pass a computed interest through an unproven link.
 */
export type NodeProvenance = 'recorded' | 'placeholder';

/**
 * For a Missing Link placeholder only: what the interest BELOW the unproven link
 * does.
 *
 * `'indeterminate'` (default, ABSENT) — nothing is computed past the link; the
 * branch below renders as "pending" and is held from payout. Honors the
 * never-fabricate rule.
 *
 * `'assume'` — assume the grantor's whole interest carried down to the grantee
 * and keep computing, but every figure below is flagged "subject to unproven
 * link." The explicit working-estimate override.
 */
export type PlaceholderPassthrough = 'indeterminate' | 'assume';

/** For a Missing Link placeholder only: what is missing. Display/triage only. */
export type PlaceholderMissing = 'person' | 'instrument' | 'both';
export type InterestClass = 'mineral' | 'npri';
export type FixedRoyaltyBasis = 'burdened_branch' | 'whole_tract' | null;
/**
 * NPRI royalty characterization (audit finding #5).
 *
 * `'fixed'` — a fixed share of production; does not scale with the lease royalty.
 * `'floating'` — a fraction of whatever lease royalty is later negotiated.
 * `null`   — not an NPRI (mineral nodes always carry `null`).
 *
 * LANDroid stores this value on the NPRI node, propagates it through
 * conveyances and predecessor inserts, and now consumes it in leasehold payout
 * math:
 * - floating NPRIs multiply against the burdened branch's lease royalty
 * - fixed NPRIs now also carry a deed-basis discriminator so LANDroid can tell
 *   whether the entered fraction is of the burdened branch or of the whole
 *   tract share carried by that branch
 *
 * The title-tree math is still mineral-only: NPRIs remain sibling burdens and
 * do not reduce mineral coverage totals on Desk Map. See
 * `LANDMAN-MATH-REFERENCE.md` → "NPRI handling".
 */
export type RoyaltyKind = 'fixed' | 'floating' | null;

/**
 * NPRI ratification of pooling (DA-M5; deep-audit decision of record).
 *
 * Today's leasehold math silently assumes every NPRI ratified the pooling, so it
 * shares unit production weighted by tract participation. This tri-state makes
 * that assumption explicit:
 * - `'ratified'`   — owner ratified the unit; unit-weighted payout (today's math).
 * - `'unknown'`    — ratification unconfirmed; computed unit-weighted but held on
 *                    the transfer-order sheet until confirmed. The default when
 *                    absent, so the engine no longer silently assumes ratification.
 * - `'unratified'` — owner did NOT ratify; entitled to a tract-basis payout. The
 *                    tract-basis math is deferred pending counsel confirmation as
 *                    to specific instruments (deep-audit), so it is currently held
 *                    rather than silently recomputed.
 *
 * Absent on non-NPRI nodes and on legacy data (treated as `'unknown'`).
 */
export type RatificationStatus = 'ratified' | 'unratified' | 'unknown';

/** Which reading of an antique double fraction the human selected. */
export type DoubleFractionBasis = 'presumption' | 'arithmetic';

/**
 * Van Dyke v. Navigator (Tex. 2023) double-fraction capture (TXM-002).
 *
 * An antique double fraction such as "an undivided 1/2 of the 1/8 royalty" must
 * NEVER be auto-multiplied: the "1/8" is historically a synonym for "the
 * royalty," so the clause is presumptively 1/2 OF THE ESTATE (≈ 1/2), not 1/16.
 * LANDroid captures the verbatim clause, computes BOTH readings, and stores the
 * human's chosen basis — it never silently resolves the ambiguity. `calculateShare`
 * applies the chosen reading as a single resolved fraction (one ratio × one base).
 */
export interface DoubleFractionClause {
  /** Verbatim deed language, e.g. "an undivided 1/2 of the 1/8 royalty". */
  clauseText: string;
  /** Resolved fraction under the Van Dyke presumption reading (outer fraction of the estate). */
  presumptionReading: string;
  /** Resolved fraction under the literal arithmetic reading (outer × inner). */
  arithmeticReading: string;
  /** The reading the human selected; the engine applies only this one. */
  chosenBasis: DoubleFractionBasis;
}

/**
 * Denormalized cache of every document currently attached to a node
 * (Phase 5 / ADR 0004). The source of truth is the Dexie
 * `document_attachments` + `documents` pair — this array exists so Desk
 * Map cards can render chips without a per-node async read.
 *
 * Workspace-store actions keep this array in sync with Dexie writes
 * (`attachDocToNode`, `detachDocFromNode`, `renameDocOnNode`,
 * `reorderNodeAttachments`); workspace load repopulates it from Dexie.
 */
export interface NodeAttachmentSummary {
  /** Stable UUID matching the underlying `DocumentRecord.docId`. */
  docId: string;
  /** Matching `DocumentAttachment.attachmentId`. */
  attachmentId: string;
  /** Cached for badge rendering. */
  fileName: string;
  /** Cached for the chip-color / type-tag UI. */
  kind: DocumentKind;
}

export interface OwnershipNode {
  id: string;
  type: NodeType;

  // Document metadata
  instrument: string;
  vol: string;
  page: string;
  docNo: string;
  fileDate: string;
  date: string;
  grantor: string;
  grantee: string;
  landDesc: string;
  remarks: string;

  // Ownership fractions — stored as Decimal-serialized strings for precision
  fraction: string;
  initialFraction: string;
  /**
   * DA-M1: when a conveyance recites more than the grantor's remainder, the node
   * is BOOKED at the remainder (`initialFraction`) but the deed's stated amount
   * is captured here verbatim so the stated-vs-booked divergence round-trips and
   * surfaces as a title issue. Absent unless an over-conveyance was recorded.
   */
  statedFraction?: string;

  // Tree structure
  parentId: string | null;

  // Conveyance math inputs
  conveyanceMode: ConveyanceMode;
  splitBasis: SplitBasis;
  numerator: string;
  denominator: string;
  manualAmount: string;

  // Special fields
  isDeceased: boolean;
  obituary: string;
  graveyardLink: string;

  // Attachment
  /**
   * v8 multi-doc attachments cache. Source of truth lives in Dexie
   * (`documents` + `document_attachments`); this array is the
   * denormalized render cache. See {@link NodeAttachmentSummary}.
   *
   * Replaced the v7 `hasDoc: boolean` + `docFileName: string` pair in
   * Phase A4c. Rollback path is the still-present read-only v7 `pdfs`
   * Dexie table.
   */
  attachments: NodeAttachmentSummary[];
  linkedOwnerId: string | null;
  linkedLeaseId: string | null;
  relatedKind: RelatedNodeKind | null;
  interestClass: InterestClass;
  /** See `RoyaltyKind` — stored on the node and consumed by leasehold payout math. */
  royaltyKind: RoyaltyKind;
  /**
   * Fixed-NPRI deed basis:
   * - `burdened_branch` means the fixed fraction is read as a share of the
   *   burdened branch's mineral interest
   * - `whole_tract` means the fixed fraction is already a share of whole tract
   *   production carried by that burdened branch
   * - `null` means not applicable (mineral nodes and floating NPRIs)
   */
  fixedRoyaltyBasis: FixedRoyaltyBasis;
  /**
   * NPRI pooling ratification. See {@link RatificationStatus}. Optional and
   * absent by default (treated as `'unknown'`); only meaningful on NPRI nodes.
   */
  ratificationStatus?: RatificationStatus;

  /**
   * Van Dyke double-fraction capture. See {@link DoubleFractionClause}. Optional
   * and absent by default; present only on conveyances entered from an antique
   * double-fraction clause. The engine reads `chosenBasis` and never
   * auto-multiplies the two fractions.
   */
  doubleFractionClause?: DoubleFractionClause;

  /**
   * Depth-range discriminator. See {@link DepthRange}. Defaults to
   * `'all_depths'`; Phase 8 (depth severance) will extend the union.
   */
  depthRange: DepthRange;

  /**
   * Per-tract leased-interest override for a lease-node. One lease *instrument*
   * fans out to N lease-nodes (one per tract it covers); a lessor may lease a
   * different fraction of their interest on each tract, so that per-tract figure
   * lives on the node rather than forcing a duplicate Lease record per tract.
   * When non-empty the coverage math reads this in place of the linked Lease
   * record's `leasedInterest` for this tract's owner branch; absent/empty means
   * "use the record's value" (the universal case), so legacy single-tract leases
   * and all non-lease nodes round-trip unchanged. Lease-nodes only.
   */
  leaseTractLeasedInterest?: string;
  /**
   * Per-tract gross mineral acres for a lease-node. Display/abstract only — the
   * title-math never reads it (acreage is not a coverage input). Lets one
   * instrument carry each tract's acreage without a duplicate Lease record.
   * Absent by default. Lease-nodes only.
   */
  leaseTractGrossAcres?: string;

  /**
   * Missing Link placeholder marker. Absent on ordinary recorded nodes
   * (= `'recorded'`); set to `'placeholder'` to mark an UNPROVEN link between two
   * known owners. The engine then treats this node as a computation barrier and
   * never fabricates a fraction below it. See {@link isPlaceholderNode}. Optional
   * and absent by default so recorded nodes and legacy data round-trip
   * byte-identically.
   */
  provenance?: NodeProvenance;
  /**
   * Placeholder only: whether interest below the unproven link is left
   * `'indeterminate'` (default, absent) or `'assume'`d to pass through in full
   * (flagged). See {@link placeholderPassthroughOf}.
   */
  placeholderPassthrough?: PlaceholderPassthrough;
  /**
   * Placeholder only: what is missing — the person/heir, the instrument, or both.
   * Display/triage only; never read by the math.
   */
  placeholderMissing?: PlaceholderMissing;

  // UI state
  isCollapsed: boolean;
}

/**
 * Pooled-unit grouping fields (`unitName`, `unitCode`) are optional. Real-world
 * workspaces may not carry them, so the DeskMap normalizer passes them through
 * when present and drops them otherwise. `unitCode` is a short stable grouping
 * key, not a math enum; Raven Forest uses `A` and `B`, and future projects can
 * add additional unit codes without a type/schema change.
 */
export type DeskMapUnitCode = string;

export interface DeskMap {
  id: string;
  name: string;
  code: string;
  tractId: string | null;
  grossAcres: string;
  pooledAcres: string;
  description: string;
  nodeIds: string[];
  unitName?: string;
  unitCode?: DeskMapUnitCode;
  /**
   * External-system references — ArcGIS feature IDs for the tract
   * polygon, file/URL deep-links, etc. Schema hook only; no current
   * consumer. See `src/types/external-ref.ts`.
   */
  externalRefs?: ExternalRef[];
}

function normalizeText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toString();
  }
  return '';
}

function normalizeDecimalInput(
  value: unknown,
  fallback: string,
  fieldName: string
): string {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid ${fieldName}: ${String(value)}`);
    }
    return value.toString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return fallback;
    }
    try {
      const parsed = new Decimal(trimmed);
      if (!parsed.isFinite() || parsed.isNegative()) {
        throw new Error();
      }
      return trimmed;
    } catch {
      throw new Error(`Invalid ${fieldName}: ${trimmed}`);
    }
  }

  throw new Error(`Invalid ${fieldName}: ${String(value)}`);
}

function normalizeNodeType(value: unknown): NodeType {
  return value === 'related' ? 'related' : 'conveyance';
}

function normalizeConveyanceMode(value: unknown): ConveyanceMode {
  if (value === 'fixed' || value === 'all') {
    return value;
  }
  return 'fraction';
}

function normalizeSplitBasis(value: unknown): SplitBasis {
  if (value === 'remaining' || value === 'whole') {
    return value;
  }
  return 'initial';
}

function normalizeRelatedKind(value: unknown): RelatedNodeKind | null {
  if (value === 'document' || value === 'lease') {
    return value;
  }
  return null;
}

function normalizeInterestClass(value: unknown): InterestClass {
  return value === 'npri' ? 'npri' : 'mineral';
}

function normalizeRoyaltyKind(value: unknown): RoyaltyKind {
  if (value === 'fixed' || value === 'floating') {
    return value;
  }
  return null;
}

function normalizeFixedRoyaltyBasis(value: unknown): FixedRoyaltyBasis {
  if (value === 'whole_tract' || value === 'burdened_branch') {
    return value;
  }
  return null;
}

/**
 * Normalize the optional NPRI ratification flag. Returns the explicit status, or
 * `undefined` for any other value so the field stays absent (= `'unknown'`) on
 * non-NPRI nodes and legacy data, keeping it round-trip-safe.
 */
function normalizeRatificationStatus(value: unknown): RatificationStatus | undefined {
  if (value === 'ratified' || value === 'unratified' || value === 'unknown') {
    return value;
  }
  return undefined;
}

/**
 * Normalize the optional Van Dyke double-fraction clause. Returns a fully-formed
 * clause or `undefined` if the shape is incomplete, so the field stays absent on
 * ordinary conveyances and round-trips verbatim when present.
 */
/**
 * Non-throwing check that a string parses as a finite, non-negative Decimal.
 * Used to gate the OPTIONAL fraction-bearing fields (statedFraction, double-
 * fraction readings) so malformed imported data is DROPPED rather than preserved
 * verbatim and silently coerced to 0 by a downstream `d()` (the required fields
 * fraction/initialFraction throw instead; these are optional so we drop).
 */
function isFiniteNonNegativeDecimalString(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  try {
    const parsed = new Decimal(trimmed);
    return parsed.isFinite() && !parsed.isNegative();
  } catch {
    return false;
  }
}

function normalizeDoubleFractionClause(value: unknown): DoubleFractionClause | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = value as Partial<DoubleFractionClause>;
  const chosenBasis =
    candidate.chosenBasis === 'arithmetic' || candidate.chosenBasis === 'presumption'
      ? candidate.chosenBasis
      : undefined;
  if (
    typeof candidate.presumptionReading !== 'string'
    || typeof candidate.arithmeticReading !== 'string'
    || !chosenBasis
    // Drop the whole clause if either reading is not a valid fraction: a garbage
    // reading would otherwise resolve to 0 in calculateShare with no warning,
    // masking corrupt data on the exact feature meant to prevent silent errors.
    || !isFiniteNonNegativeDecimalString(candidate.presumptionReading)
    || !isFiniteNonNegativeDecimalString(candidate.arithmeticReading)
  ) {
    return undefined;
  }
  return {
    clauseText: normalizeText(candidate.clauseText),
    presumptionReading: candidate.presumptionReading,
    arithmeticReading: candidate.arithmeticReading,
    chosenBasis,
  };
}

function normalizeAttachmentSummary(value: unknown): NodeAttachmentSummary | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as {
    docId?: unknown;
    attachmentId?: unknown;
    fileName?: unknown;
    kind?: unknown;
  };
  if (typeof raw.docId !== 'string' || raw.docId === '') return null;
  if (typeof raw.attachmentId !== 'string' || raw.attachmentId === '') return null;
  return {
    docId: raw.docId,
    attachmentId: raw.attachmentId,
    fileName: typeof raw.fileName === 'string' ? raw.fileName : '',
    kind: isDocumentKind(raw.kind) ? raw.kind : 'other',
  };
}

function normalizeAttachmentSummaries(value: unknown): NodeAttachmentSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const normalized = normalizeAttachmentSummary(entry);
    return normalized ? [normalized] : [];
  });
}

function normalizeUnitCode(value: unknown): DeskMapUnitCode | undefined {
  const normalized = normalizeText(value).replace(/\s+/g, ' ').slice(0, 64);
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeUnitName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeAcreage(value: unknown): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value.toString() : '';
  }

  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toString() : '';
}

export function normalizeDeskMap(
  deskMap: Pick<DeskMap, 'id'> &
    Partial<
      Omit<
        DeskMap,
        | 'grossAcres'
        | 'pooledAcres'
        | 'description'
        | 'nodeIds'
        | 'unitName'
        | 'unitCode'
        | 'externalRefs'
      >
    > & {
      grossAcres?: unknown;
      pooledAcres?: unknown;
      description?: unknown;
      nodeIds?: unknown;
      unitName?: unknown;
      unitCode?: unknown;
      externalRefs?: unknown;
    },
  fallbackName = 'Untitled Tract'
): DeskMap {
  const unitName = normalizeUnitName(deskMap.unitName);
  const unitCode = normalizeUnitCode(deskMap.unitCode);
  const externalRefs = normalizeExternalRefs(deskMap.externalRefs);

  const base: DeskMap = {
    id: deskMap.id,
    name:
      typeof deskMap.name === 'string' && deskMap.name.trim().length > 0
        ? deskMap.name
        : fallbackName,
    code: typeof deskMap.code === 'string' ? deskMap.code : '',
    tractId: typeof deskMap.tractId === 'string' ? deskMap.tractId : null,
    grossAcres: normalizeAcreage(deskMap.grossAcres),
    pooledAcres: normalizeAcreage(deskMap.pooledAcres),
    description:
      typeof deskMap.description === 'string' ? deskMap.description.trim() : '',
    nodeIds: Array.isArray(deskMap.nodeIds)
      ? deskMap.nodeIds.filter((nodeId): nodeId is string => typeof nodeId === 'string')
      : [],
  };

  // Only attach the optional unit fields when present so that serialized
  // output for pre-overhaul workspaces stays byte-identical (the keys never
  // appear), which matters for workspace-persistence round-trip tests and for
  // diff-friendly JSON exports.
  if (unitName !== undefined) {
    base.unitName = unitName;
  }
  if (unitCode !== undefined) {
    base.unitCode = unitCode;
  }
  if (externalRefs !== undefined) {
    base.externalRefs = externalRefs;
  }

  return base;
}

/** Factory for a blank node with defaults. */
export function createBlankNode(id: string, parentId: string | null = null): OwnershipNode {
  return {
    id,
    type: 'conveyance',
    instrument: '',
    vol: '',
    page: '',
    docNo: '',
    fileDate: '',
    date: '',
    grantor: '',
    grantee: '',
    landDesc: '',
    remarks: '',
    fraction: '0',
    initialFraction: '0',
    parentId,
    conveyanceMode: 'fraction',
    splitBasis: 'initial',
    numerator: '0',
    denominator: '1',
    manualAmount: '0',
    isDeceased: false,
    obituary: '',
    graveyardLink: '',
    attachments: [],
    linkedOwnerId: null,
    linkedLeaseId: null,
    relatedKind: null,
    interestClass: 'mineral',
    royaltyKind: null,
    fixedRoyaltyBasis: null,
    depthRange: DEFAULT_DEPTH_RANGE,
    isCollapsed: false,
  };
}

const NODE_PROVENANCE_VALUES: readonly NodeProvenance[] = ['recorded', 'placeholder'];
const PLACEHOLDER_PASSTHROUGH_VALUES: readonly PlaceholderPassthrough[] = [
  'indeterminate',
  'assume',
];
const PLACEHOLDER_MISSING_VALUES: readonly PlaceholderMissing[] = [
  'person',
  'instrument',
  'both',
];

function normalizeProvenance(value: unknown): NodeProvenance | null {
  return typeof value === 'string'
    && (NODE_PROVENANCE_VALUES as readonly string[]).includes(value)
    ? (value as NodeProvenance)
    : null;
}

function normalizePlaceholderPassthrough(value: unknown): PlaceholderPassthrough | null {
  return typeof value === 'string'
    && (PLACEHOLDER_PASSTHROUGH_VALUES as readonly string[]).includes(value)
    ? (value as PlaceholderPassthrough)
    : null;
}

function normalizePlaceholderMissing(value: unknown): PlaceholderMissing | null {
  return typeof value === 'string'
    && (PLACEHOLDER_MISSING_VALUES as readonly string[]).includes(value)
    ? (value as PlaceholderMissing)
    : null;
}

/**
 * A Missing Link placeholder — a node marking an unproven gap in the chain. The
 * single predicate the engine, store, and UI all read.
 */
export function isPlaceholderNode(node: Pick<OwnershipNode, 'provenance'>): boolean {
  return node.provenance === 'placeholder';
}

/**
 * The passthrough mode of a placeholder: `'indeterminate'` by default (the key is
 * absent unless explicitly `'assume'`). Returns `null` for non-placeholder nodes.
 */
export function placeholderPassthroughOf(
  node: Pick<OwnershipNode, 'provenance' | 'placeholderPassthrough'>
): PlaceholderPassthrough | null {
  if (node.provenance !== 'placeholder') {
    return null;
  }
  return node.placeholderPassthrough ?? 'indeterminate';
}

export function normalizeOwnershipNode(
  node: Pick<OwnershipNode, 'id'> & Partial<OwnershipNode>
): OwnershipNode {
  const interestClass = normalizeInterestClass(node.interestClass);
  const royaltyKind = normalizeRoyaltyKind(node.royaltyKind);
  const splitBasis = normalizeSplitBasis(node.splitBasis);
  const explicitFixedRoyaltyBasis = normalizeFixedRoyaltyBasis(node.fixedRoyaltyBasis);
  const fixedRoyaltyBasis =
    interestClass === 'npri' && royaltyKind === 'fixed'
      ? explicitFixedRoyaltyBasis ?? (splitBasis === 'whole' ? 'whole_tract' : 'burdened_branch')
      : null;
  const provenance = normalizeProvenance(node.provenance);
  const placeholderMissing =
    provenance === 'placeholder' ? normalizePlaceholderMissing(node.placeholderMissing) : null;

  return {
    ...createBlankNode(node.id, node.parentId ?? null),
    id: node.id,
    type: normalizeNodeType(node.type),
    instrument: normalizeText(node.instrument),
    vol: normalizeText(node.vol),
    page: normalizeText(node.page),
    docNo: normalizeText(node.docNo),
    fileDate: normalizeText(node.fileDate),
    date: normalizeText(node.date),
    grantor: normalizeText(node.grantor),
    grantee: normalizeText(node.grantee),
    landDesc: normalizeText(node.landDesc),
    remarks: normalizeText(node.remarks),
    fraction: normalizeDecimalInput(node.fraction, '0', `fraction for node ${node.id}`),
    initialFraction: normalizeDecimalInput(
      node.initialFraction,
      '0',
      `initialFraction for node ${node.id}`
    ),
    parentId: typeof node.parentId === 'string' ? node.parentId : null,
    conveyanceMode: normalizeConveyanceMode(node.conveyanceMode),
    splitBasis,
    numerator: normalizeDecimalInput(node.numerator, '0', `numerator for node ${node.id}`),
    denominator: normalizeDecimalInput(
      node.denominator,
      '1',
      `denominator for node ${node.id}`
    ),
    manualAmount: normalizeDecimalInput(
      node.manualAmount,
      '0',
      `manualAmount for node ${node.id}`
    ),
    isDeceased: node.isDeceased === true,
    obituary: normalizeText(node.obituary),
    graveyardLink: normalizeText(node.graveyardLink),
    attachments: normalizeAttachmentSummaries(node.attachments),
    linkedOwnerId: node.linkedOwnerId ?? null,
    linkedLeaseId: node.linkedLeaseId ?? null,
    relatedKind: normalizeRelatedKind(node.relatedKind),
    interestClass,
    royaltyKind,
    fixedRoyaltyBasis,
    depthRange: normalizeDepthRange(node.depthRange),
    isCollapsed: node.isCollapsed === true,
    // DA-M1: an over-conveyance records the deed's STATED fraction verbatim
    // alongside the booked fraction. Optional and absent by default; preserved
    // only when it is a valid fraction so a malformed import is dropped rather
    // than round-tripped as garbage (it is display/title-issue only, but the
    // doc contract calls it a fraction).
    ...(typeof node.statedFraction === 'string'
      && isFiniteNonNegativeDecimalString(node.statedFraction)
      ? { statedFraction: node.statedFraction }
      : {}),
    // DA-M5: NPRI ratification flag, only on NPRI nodes. Absent (= 'unknown') by
    // default so legacy data and non-NPRI nodes round-trip unchanged.
    ...(interestClass === 'npri' && normalizeRatificationStatus(node.ratificationStatus)
      ? { ratificationStatus: normalizeRatificationStatus(node.ratificationStatus) }
      : {}),
    // Van Dyke: preserve a captured double-fraction clause verbatim. Absent on
    // ordinary conveyances, so existing data round-trips unchanged.
    ...(normalizeDoubleFractionClause(node.doubleFractionClause)
      ? { doubleFractionClause: normalizeDoubleFractionClause(node.doubleFractionClause) }
      : {}),
    // Lease-instrument model: per-tract leased-interest / gross-acres carried on
    // a lease-node so one instrument can fan to N tracts without duplicate Lease
    // records. Only on lease-nodes (the SAME shape `isLeaseNode` requires — both
    // type 'related' AND relatedKind 'lease' — so the two predicates can't drift),
    // only when non-empty, so every other node and all legacy data round-trip
    // unchanged (the byte-identity oracle stays clean).
    ...(normalizeNodeType(node.type) === 'related'
      && normalizeRelatedKind(node.relatedKind) === 'lease'
      && typeof node.leaseTractLeasedInterest === 'string'
      && node.leaseTractLeasedInterest.trim().length > 0
      ? { leaseTractLeasedInterest: node.leaseTractLeasedInterest.trim() }
      : {}),
    ...(normalizeNodeType(node.type) === 'related'
      && normalizeRelatedKind(node.relatedKind) === 'lease'
      && typeof node.leaseTractGrossAcres === 'string'
      && node.leaseTractGrossAcres.trim().length > 0
      ? { leaseTractGrossAcres: node.leaseTractGrossAcres.trim() }
      : {}),
    // Missing Link placeholder (unproven gap in the chain). All three keys are
    // ABSENT by default — only a placeholder carries `provenance`, only an
    // explicit working-estimate override carries `placeholderPassthrough: 'assume'`
    // (default 'indeterminate' stays absent), and `placeholderMissing` is present
    // only when set on a placeholder — so recorded nodes and legacy data
    // round-trip byte-identically (the byte-identity oracle stays clean).
    ...(provenance === 'placeholder' ? { provenance } : {}),
    ...(provenance === 'placeholder'
      && normalizePlaceholderPassthrough(node.placeholderPassthrough) === 'assume'
      ? { placeholderPassthrough: 'assume' as PlaceholderPassthrough }
      : {}),
    ...(placeholderMissing ? { placeholderMissing } : {}),
  };
}

export function getInterestClass(
  node: Partial<Pick<OwnershipNode, 'interestClass'>>
): InterestClass {
  return node.interestClass ?? 'mineral';
}

export function isNpriNode(
  node: Partial<Pick<OwnershipNode, 'type' | 'interestClass'>>
): boolean {
  return node.type !== 'related' && getInterestClass(node) === 'npri';
}
