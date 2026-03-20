/**
 * Tree layout algorithm for the flowchart canvas.
 *
 * Produces a compact, single-canvas hierarchical layout.
 * No pages, no sheets — one tree, infinite zoom.
 *
 * Algorithm: Tidier Drawings of Trees (Reingold-Tilford style)
 *   1. Compute subtree widths bottom-up (leaf = NODE_WIDTH)
 *   2. Position children centered under parent
 *   3. Related documents (affidavits, etc.) offset to the right of their parent
 *
 * Performance: O(n) for n nodes — handles 1000+ nodes.
 */
import type { OwnershipNode } from '../types/node';
import type { OwnershipNodeData } from '../types/flowchart';
import { d, serialize } from './decimal';

// ── Layout constants ────────────────────────────────────────

const NODE_WIDTH = 288;   // px — matches the w-72 in OwnershipNode
const NODE_HEIGHT = 160;  // px — approximate rendered height
const H_GAP = 32;         // horizontal gap between sibling subtrees
const V_GAP = 48;         // vertical gap between parent and children
const RELATED_OFFSET_X = NODE_WIDTH + 16; // related docs sit beside their parent

// ── Types ───────────────────────────────────────────────────

export interface LayoutNode {
  id: string;
  type: 'ownership';
  position: { x: number; y: number };
  data: OwnershipNodeData & Record<string, unknown>;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type: 'smoothstep';
  animated: boolean;
  style: { stroke: string; strokeWidth: number };
}

export interface LayoutResult {
  flowNodes: LayoutNode[];
  flowEdges: LayoutEdge[];
}

// ── Internal tree node for layout computation ───────────────

interface TreeNode {
  id: string;
  ownershipNode: OwnershipNode;
  children: TreeNode[];     // conveyance children (sorted)
  relatedDocs: TreeNode[];  // related documents (affidavits, etc.)
  subtreeWidth: number;     // computed bottom-up
}

// ── Build internal tree from flat node array ────────────────

function buildTree(nodes: OwnershipNode[]): TreeNode[] {
  const byId = new Map<string, OwnershipNode>();
  const childrenOf = new Map<string, OwnershipNode[]>();
  const relatedOf = new Map<string, OwnershipNode[]>();

  for (const n of nodes) {
    byId.set(n.id, n);
  }

  for (const n of nodes) {
    if (!n.parentId || n.parentId === 'unlinked') continue;
    if (n.type === 'related') {
      if (!relatedOf.has(n.parentId)) relatedOf.set(n.parentId, []);
      relatedOf.get(n.parentId)!.push(n);
    } else {
      if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
      childrenOf.get(n.parentId)!.push(n);
    }
  }

  function buildSubtree(node: OwnershipNode): TreeNode {
    const children = (childrenOf.get(node.id) ?? []).map(buildSubtree);
    const related = (relatedOf.get(node.id) ?? []).map(r => ({
      id: r.id,
      ownershipNode: r,
      children: [],
      relatedDocs: [],
      subtreeWidth: 0, // related docs don't affect tree width
    }));
    return { id: node.id, ownershipNode: node, children, relatedDocs: related, subtreeWidth: 0 };
  }

  // Find roots — no parentId or parentId is null
  const roots = nodes.filter(n => n.parentId == null && n.type !== 'related');

  // Also find "unlinked" nodes — they're separate roots
  const unlinked = nodes.filter(n => n.parentId === 'unlinked');

  const trees = [...roots, ...unlinked].map(buildSubtree);
  return trees;
}

// ── Compute subtree widths bottom-up ────────────────────────

function computeWidths(tree: TreeNode): void {
  if (tree.children.length === 0) {
    // Leaf node: width = node + any related docs beside it
    tree.subtreeWidth = NODE_WIDTH + (tree.relatedDocs.length > 0 ? RELATED_OFFSET_X : 0);
    return;
  }

  for (const child of tree.children) {
    computeWidths(child);
  }

  // Width = sum of children widths + gaps
  const childrenTotalWidth = tree.children.reduce(
    (sum, child) => sum + child.subtreeWidth, 0
  ) + H_GAP * (tree.children.length - 1);

  // Parent node needs at least NODE_WIDTH (+ related offset)
  const selfWidth = NODE_WIDTH + (tree.relatedDocs.length > 0 ? RELATED_OFFSET_X : 0);

  tree.subtreeWidth = Math.max(childrenTotalWidth, selfWidth);
}

// ── Position nodes ──────────────────────────────────────────

function computeRelativeShare(node: OwnershipNode, parentInitialFraction: string | null): string {
  if (!parentInitialFraction) return node.initialFraction; // root: relative = absolute
  const parentDec = d(parentInitialFraction);
  if (parentDec.isZero()) return serialize(d(0));
  const nodeDec = d(node.initialFraction);
  return serialize(nodeDec.div(parentDec));
}

function positionNodes(
  tree: TreeNode,
  centerX: number,
  y: number,
  result: LayoutResult,
  parentId: string | null,
  parentInitialFraction: string | null,
): void {
  const x = centerX - NODE_WIDTH / 2;

  // Create flow node
  const node = tree.ownershipNode;
  const relativeShare = computeRelativeShare(node, parentInitialFraction);
  const data = {
    label: node.grantee || node.instrument || 'Document',
    grantee: node.grantee,
    grantor: node.grantor,
    instrument: node.instrument,
    date: node.date || node.fileDate,
    grantFraction: node.initialFraction,
    remainingFraction: node.fraction,
    relativeShare,
    nodeId: node.id,
  } satisfies OwnershipNodeData;

  result.flowNodes.push({
    id: node.id,
    type: 'ownership',
    position: { x, y },
    data: data as OwnershipNodeData & Record<string, unknown>,
  });

  // Edge from parent
  if (parentId) {
    result.flowEdges.push({
      id: `e-${parentId}-${node.id}`,
      source: parentId,
      target: node.id,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#8b4513', strokeWidth: 2 },
    });
  }

  // Position related documents beside this node
  for (let i = 0; i < tree.relatedDocs.length; i++) {
    const rel = tree.relatedDocs[i];
    const relNode = rel.ownershipNode;
    const relX = x + RELATED_OFFSET_X;
    const relY = y + i * (NODE_HEIGHT * 0.6);

    const relData = {
      label: relNode.instrument || 'Related',
      grantee: relNode.grantee,
      grantor: relNode.grantor,
      instrument: relNode.instrument,
      date: relNode.date || relNode.fileDate,
      grantFraction: relNode.initialFraction,
      remainingFraction: relNode.fraction,
      relativeShare: computeRelativeShare(relNode, node.initialFraction),
      nodeId: relNode.id,
    } satisfies OwnershipNodeData;

    result.flowNodes.push({
      id: relNode.id,
      type: 'ownership',
      position: { x: relX, y: relY },
      data: relData as OwnershipNodeData & Record<string, unknown>,
    });

    result.flowEdges.push({
      id: `e-${node.id}-${relNode.id}`,
      source: node.id,
      target: relNode.id,
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#a0522d', strokeWidth: 1, },
    });
  }

  // Position children centered below
  if (tree.children.length === 0) return;

  const childY = y + NODE_HEIGHT + V_GAP;
  const totalChildWidth = tree.children.reduce(
    (sum, child) => sum + child.subtreeWidth, 0
  ) + H_GAP * (tree.children.length - 1);

  let childCenterX = centerX - totalChildWidth / 2;

  for (const child of tree.children) {
    const childCenter = childCenterX + child.subtreeWidth / 2;
    positionNodes(child, childCenter, childY, result, node.id, node.initialFraction);
    childCenterX += child.subtreeWidth + H_GAP;
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Convert a flat array of ownership nodes into a laid-out React Flow graph.
 *
 * All nodes land on a single canvas. No pages, no sheets.
 * The tree is compact and hierarchical. Zoom out to see the whole thing.
 */
export function layoutOwnershipTree(nodes: OwnershipNode[]): LayoutResult {
  if (nodes.length === 0) return { flowNodes: [], flowEdges: [] };

  const trees = buildTree(nodes);
  for (const tree of trees) computeWidths(tree);

  const result: LayoutResult = { flowNodes: [], flowEdges: [] };

  // Position each root tree side by side
  let offsetX = 0;
  for (const tree of trees) {
    const centerX = offsetX + tree.subtreeWidth / 2;
    positionNodes(tree, centerX, 0, result, null, null);
    offsetX += tree.subtreeWidth + H_GAP * 4;
  }

  return result;
}
