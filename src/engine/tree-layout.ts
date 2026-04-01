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
import type {
  ELK as ElkEngine,
  ElkNode,
  ElkExtendedEdge,
} from 'elkjs/lib/elk-api.js';
import elkWorkerUrl from 'elkjs/lib/elk-worker.min.js?url';
import type { OwnershipNode } from '../types/node';
import type { FlowEdgeData, OwnershipNodeData } from '../types/flowchart';
import { d, serialize } from './decimal';
import { getTreeLayoutMetrics } from './flowchart-metrics';

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
  type: 'ownership';
  animated: boolean;
  style: { stroke: string; strokeWidth: number };
  data?: FlowEdgeData;
}

export interface LayoutResult {
  flowNodes: LayoutNode[];
  flowEdges: LayoutEdge[];
}

export interface TreeLayoutOptions {
  horizontalSpacingFactor?: number;
  verticalSpacingFactor?: number;
  nodeScale?: number;
}

let elkPromise: Promise<ElkEngine> | null = null;

async function getElk(): Promise<ElkEngine> {
  if (!elkPromise) {
    if (import.meta.env.MODE === 'test' || typeof Worker !== 'function') {
      const bundledModuleId = 'elkjs/lib/elk.bundled.js';
      elkPromise = import(/* @vite-ignore */ bundledModuleId).then(({ default: ELK }) => new ELK());
    } else {
      elkPromise = import('elkjs/lib/elk-api.js').then(({ default: ELK }) =>
        new ELK({ workerUrl: elkWorkerUrl })
      );
    }
  }

  return elkPromise;
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

function computeWidths(tree: TreeNode, metrics: ReturnType<typeof getTreeLayoutMetrics>): void {
  const { nodeWidth, horizontalGap, relatedOffsetX } = metrics;

  if (tree.children.length === 0) {
    // Leaf node: width = node + any related docs beside it
    tree.subtreeWidth = nodeWidth + (tree.relatedDocs.length > 0 ? relatedOffsetX : 0);
    return;
  }

  for (const child of tree.children) {
    computeWidths(child, metrics);
  }

  // Width = sum of children widths + gaps
  const childrenTotalWidth = tree.children.reduce(
    (sum, child) => sum + child.subtreeWidth, 0
  ) + horizontalGap * (tree.children.length - 1);

  // Parent node needs at least NODE_WIDTH (+ related offset)
  const selfWidth = nodeWidth + (tree.relatedDocs.length > 0 ? relatedOffsetX : 0);

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

function createOwnershipNodeData(
  node: OwnershipNode,
  parentInitialFraction: string | null,
  nodeScale = 1,
): OwnershipNodeData {
  return {
    label: node.grantee || node.instrument || 'Document',
    grantee: node.grantee,
    grantor: node.grantor,
    instrument: node.instrument,
    date: node.date || node.fileDate,
    grantFraction: node.initialFraction,
    remainingFraction: node.fraction,
    relativeShare: computeRelativeShare(node, parentInitialFraction),
    nodeId: node.id,
    nodeScale,
  };
}

function positionNodes(
  tree: TreeNode,
  centerX: number,
  y: number,
  result: LayoutResult,
  parentId: string | null,
  parentInitialFraction: string | null,
  metrics: ReturnType<typeof getTreeLayoutMetrics>,
): void {
  const { nodeWidth, nodeHeight, verticalGap, horizontalGap, relatedOffsetX } = metrics;
  const x = centerX - nodeWidth / 2;

  // Create flow node
  const node = tree.ownershipNode;
  const data = createOwnershipNodeData(node, parentInitialFraction, metrics.nodeScale);

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
      type: 'ownership',
      animated: false,
      style: { stroke: '#8b4513', strokeWidth: 2 },
      data: { edgeScale: 1, variant: 'primary' },
    });
  }

  // Position related documents beside this node
  for (let i = 0; i < tree.relatedDocs.length; i++) {
    const rel = tree.relatedDocs[i];
    const relNode = rel.ownershipNode;
    const relX = x + relatedOffsetX;
    const relY = y + i * (nodeHeight * 0.6);
    const relData = createOwnershipNodeData(relNode, node.initialFraction, metrics.nodeScale);

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
      type: 'ownership',
      animated: false,
      style: { stroke: '#a0522d', strokeWidth: 1, },
      data: { edgeScale: 1, variant: 'related' },
    });
  }

  // Position children centered below
  if (tree.children.length === 0) return;

  const childY = y + nodeHeight + verticalGap;
  const totalChildWidth = tree.children.reduce(
    (sum, child) => sum + child.subtreeWidth, 0
  ) + horizontalGap * (tree.children.length - 1);

  let childCenterX = centerX - totalChildWidth / 2;

  for (const child of tree.children) {
    const childCenter = childCenterX + child.subtreeWidth / 2;
    positionNodes(child, childCenter, childY, result, node.id, node.initialFraction, metrics);
    childCenterX += child.subtreeWidth + horizontalGap;
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Convert a flat array of ownership nodes into a laid-out React Flow graph.
 *
 * All nodes land on a single canvas. No pages, no sheets.
 * The tree is compact and hierarchical. Zoom out to see the whole thing.
 */
export function layoutOwnershipTree(nodes: OwnershipNode[], options: TreeLayoutOptions = {}): LayoutResult {
  if (nodes.length === 0) return { flowNodes: [], flowEdges: [] };

  const metrics = getTreeLayoutMetrics(
    options.horizontalSpacingFactor,
    options.verticalSpacingFactor,
    options.nodeScale
  );
  const trees = buildTree(nodes);
  for (const tree of trees) computeWidths(tree, metrics);

  const result: LayoutResult = { flowNodes: [], flowEdges: [] };

  // Position each root tree side by side
  let offsetX = 0;
  for (const tree of trees) {
    const centerX = offsetX + tree.subtreeWidth / 2;
    positionNodes(tree, centerX, 0, result, null, null, metrics);
    offsetX += tree.subtreeWidth + metrics.rootGap;
  }

  return result;
}

function createCoreEdgeStyle(): LayoutEdge['style'] {
  return { stroke: '#8b4513', strokeWidth: 2 };
}

function createRelatedEdgeStyle(): LayoutEdge['style'] {
  return { stroke: '#a0522d', strokeWidth: 1 };
}

export async function layoutOwnershipTreeWithElk(
  nodes: OwnershipNode[],
  options: TreeLayoutOptions = {},
): Promise<LayoutResult> {
  if (nodes.length === 0) return { flowNodes: [], flowEdges: [] };

  const metrics = getTreeLayoutMetrics(
    options.horizontalSpacingFactor,
    options.verticalSpacingFactor,
    options.nodeScale
  );
  const allNodes = new Map(nodes.map((node) => [node.id, node]));
  const ownershipNodes = nodes.filter((node) => node.type !== 'related');
  const relatedByParent = new Map<string, OwnershipNode[]>();

  for (const node of nodes) {
    if (node.type !== 'related' || !node.parentId || node.parentId === 'unlinked') continue;
    if (!relatedByParent.has(node.parentId)) relatedByParent.set(node.parentId, []);
    relatedByParent.get(node.parentId)!.push(node);
  }

  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': String(metrics.horizontalGap),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(metrics.elkLayerGap),
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: ownershipNodes.map((node) => ({
      id: node.id,
      width: metrics.nodeWidth,
      height: metrics.nodeHeight,
    })),
    edges: ownershipNodes
      .filter((node) => node.parentId && node.parentId !== 'unlinked')
      .map<ElkExtendedEdge>((node) => ({
        id: `e-${node.parentId}-${node.id}`,
        sources: [node.parentId as string],
        targets: [node.id],
      })),
  };

  const elk = await getElk();
  let layout: Awaited<ReturnType<typeof elk.layout<ElkNode>>>;
  try {
    layout = await elk.layout(elkGraph);
  } catch {
    return layoutOwnershipTree(nodes, options);
  }

  const positionedNodes = new Map((layout.children ?? []).map((node) => [node.id, node]));
  if (positionedNodes.size !== ownershipNodes.length) {
    return layoutOwnershipTree(nodes, options);
  }

  const centeredLayout = layoutOwnershipTree(nodes, options);
  const centeredPositions = new Map(
    centeredLayout.flowNodes.map((node) => [node.id, node.position])
  );

  const result: LayoutResult = { flowNodes: [], flowEdges: [] };

  for (const node of ownershipNodes) {
    const positioned = positionedNodes.get(node.id);
    const centeredPosition = centeredPositions.get(node.id);
    if (!positioned) continue;

    result.flowNodes.push({
      id: node.id,
      type: 'ownership',
      position: {
        x: centeredPosition?.x ?? positioned.x ?? 0,
        y: positioned.y ?? 0,
      },
      data: createOwnershipNodeData(
        node,
        node.parentId && node.parentId !== 'unlinked'
          ? allNodes.get(node.parentId)?.initialFraction ?? null
          : null,
        metrics.nodeScale,
      ) as OwnershipNodeData & Record<string, unknown>,
    });

    if (node.parentId && node.parentId !== 'unlinked') {
      result.flowEdges.push({
        id: `e-${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id,
        type: 'ownership',
        animated: false,
        style: createCoreEdgeStyle(),
        data: { edgeScale: 1, variant: 'primary' },
      });
    }
  }

  for (const [parentId, relatedDocs] of relatedByParent) {
    const parentFlowNode = result.flowNodes.find((node) => node.id === parentId);
    const parentSource = allNodes.get(parentId);
    if (!parentFlowNode || !parentSource) continue;

    for (let index = 0; index < relatedDocs.length; index += 1) {
      const relNode = relatedDocs[index];
      const centeredPosition = centeredPositions.get(relNode.id);
      result.flowNodes.push({
        id: relNode.id,
        type: 'ownership',
        position: {
          x: centeredPosition?.x ?? parentFlowNode.position.x + metrics.relatedOffsetX,
          y: centeredPosition?.y ?? parentFlowNode.position.y + index * (metrics.nodeHeight * 0.6),
        },
        data: createOwnershipNodeData(relNode, parentSource.initialFraction, metrics.nodeScale) as OwnershipNodeData & Record<string, unknown>,
      });

      result.flowEdges.push({
        id: `e-${parentId}-${relNode.id}`,
        source: parentId,
        target: relNode.id,
        type: 'ownership',
        animated: false,
        style: createRelatedEdgeStyle(),
        data: { edgeScale: 1, variant: 'related' },
      });
    }
  }

  return result;
}
