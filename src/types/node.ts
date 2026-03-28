/** Core domain types for ownership nodes and desk maps. */

export type ConveyanceMode = 'fraction' | 'fixed' | 'all';
export type SplitBasis = 'initial' | 'remaining' | 'whole';
export type NodeType = 'conveyance' | 'related';

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

  // UI state
  isCollapsed: boolean;
}

export interface DeskMap {
  id: string;
  name: string;
  code: string;
  tractId: string | null;
  nodeIds: string[];
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
    isCollapsed: false,
  };
}
