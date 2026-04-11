/** Core domain types for ownership nodes and desk maps. */

export type ConveyanceMode = 'fraction' | 'fixed' | 'all';
export type SplitBasis = 'initial' | 'remaining' | 'whole';
export type NodeType = 'conveyance' | 'related';
export type RelatedNodeKind = 'document' | 'lease';
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
  hasDoc: boolean;
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

  // UI state
  isCollapsed: boolean;
}

export interface DeskMap {
  id: string;
  name: string;
  code: string;
  tractId: string | null;
  grossAcres: string;
  pooledAcres: string;
  description: string;
  nodeIds: string[];
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

function normalizeDecimalInput(value: unknown, fallback: string): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  return fallback;
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
    Partial<Omit<DeskMap, 'grossAcres' | 'pooledAcres' | 'description' | 'nodeIds'>> & {
      grossAcres?: unknown;
      pooledAcres?: unknown;
      description?: unknown;
      nodeIds?: unknown;
    },
  fallbackName = 'Untitled Tract'
): DeskMap {
  return {
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
    hasDoc: false,
    linkedOwnerId: null,
    linkedLeaseId: null,
    relatedKind: null,
    interestClass: 'mineral',
    royaltyKind: null,
    fixedRoyaltyBasis: null,
    isCollapsed: false,
  };
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
    fraction: normalizeDecimalInput(node.fraction, '0'),
    initialFraction: normalizeDecimalInput(node.initialFraction, '0'),
    parentId: typeof node.parentId === 'string' ? node.parentId : null,
    conveyanceMode: normalizeConveyanceMode(node.conveyanceMode),
    splitBasis,
    numerator: normalizeDecimalInput(node.numerator, '0'),
    denominator: normalizeDecimalInput(node.denominator, '1'),
    manualAmount: normalizeDecimalInput(node.manualAmount, '0'),
    isDeceased: node.isDeceased === true,
    obituary: normalizeText(node.obituary),
    graveyardLink: normalizeText(node.graveyardLink),
    hasDoc: node.hasDoc === true,
    linkedOwnerId: node.linkedOwnerId ?? null,
    linkedLeaseId: node.linkedLeaseId ?? null,
    relatedKind: normalizeRelatedKind(node.relatedKind),
    interestClass,
    royaltyKind,
    fixedRoyaltyBasis,
    isCollapsed: node.isCollapsed === true,
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
