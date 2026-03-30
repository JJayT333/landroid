/** Core domain types for ownership nodes and desk maps. */

export type ConveyanceMode = 'fraction' | 'fixed' | 'all';
export type SplitBasis = 'initial' | 'remaining' | 'whole';
export type NodeType = 'conveyance' | 'related';
export type RelatedNodeKind = 'document' | 'lease';
export type InterestClass = 'mineral' | 'npri';
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
  royaltyKind: RoyaltyKind;

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
    isCollapsed: false,
  };
}

export function normalizeOwnershipNode(
  node: Pick<OwnershipNode, 'id'> & Partial<OwnershipNode>
): OwnershipNode {
  return {
    ...createBlankNode(node.id, node.parentId ?? null),
    ...node,
    linkedOwnerId: node.linkedOwnerId ?? null,
    linkedLeaseId: node.linkedLeaseId ?? null,
    relatedKind: node.relatedKind ?? null,
    interestClass: node.interestClass ?? 'mineral',
    royaltyKind: node.royaltyKind ?? null,
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
