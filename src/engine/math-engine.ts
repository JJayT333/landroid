/**
 * LANDroid Math Engine v2
 *
 * All ownership calculations use Decimal.js with high internal precision.
 * Ported from v1 mathEngine.js — same algorithms, no float arithmetic.
 *
 * Four core operations:
 *   1. executeConveyance  — split fraction from parent to new child
 *   2. executeRebalance   — scale a branch by changing its initialFraction
 *   3. executePredecessorInsert — insert a node between parent and child
 *   4. executeAttachConveyance  — move subtree to a new parent
 *   5. executeDeleteBranch — remove a branch and restore the parent's conveyed amount
 */
import { Decimal } from 'decimal.js';
import { d, clamp, serialize } from './decimal';
import type {
  OwnershipNode,
  ConveyanceMode,
  InterestClass,
  SplitBasis,
} from '../types/node';
import type { Result, Audit } from '../types/result';

// ---------------------------------------------------------------------------
// Internal node type for calculations (fractions as Decimal)
// ---------------------------------------------------------------------------
interface CalcNode {
  id: string;
  type: string;
  parentId: string | null;
  fraction: Decimal;
  initialFraction: Decimal;
  /** Pass-through all other fields unchanged. */
  rest: Record<string, unknown>;
}

function getCalcInterestClass(node: CalcNode): InterestClass {
  return (node.rest.interestClass as InterestClass | undefined) ?? 'mineral';
}

function getCalcRoyaltyKind(node: CalcNode): OwnershipNode['royaltyKind'] {
  return (node.rest.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? null;
}

function allocatesAgainstParent(parent: CalcNode, child: CalcNode): boolean {
  return getCalcInterestClass(parent) === getCalcInterestClass(child);
}

function toCalc(node: OwnershipNode): CalcNode {
  const { id, type, parentId, fraction, initialFraction, ...rest } = node;
  return {
    id,
    type,
    parentId,
    fraction: d(fraction),
    initialFraction: d(initialFraction),
    rest: rest as Record<string, unknown>,
  };
}

function fromCalc(cn: CalcNode): OwnershipNode {
  return {
    ...cn.rest,
    id: cn.id,
    type: cn.type as OwnershipNode['type'],
    parentId: cn.parentId,
    fraction: serialize(cn.fraction),
    initialFraction: serialize(cn.initialFraction),
  } as OwnershipNode;
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

/** Build parentId→children index, then DFS to collect all descendants. O(n). */
export function collectDescendantIds(nodes: CalcNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId == null || n.parentId === 'unlinked') continue;
    if (!childrenOf.has(n.parentId)) childrenOf.set(n.parentId, []);
    childrenOf.get(n.parentId)!.push(n.id);
  }
  const desc = new Set<string>();
  const stack = childrenOf.get(rootId)?.slice() ?? [];
  while (stack.length) {
    const id = stack.pop()!;
    if (desc.has(id)) continue;
    desc.add(id);
    const children = childrenOf.get(id);
    if (children) stack.push(...children);
  }
  return desc;
}

function collectAllocatingDescendantIds(nodes: CalcNode[], rootId: string): Set<string> {
  const root = nodes.find((node) => node.id === rootId);
  if (!root) return new Set();

  const targetInterestClass = getCalcInterestClass(root);
  const childrenOf = new Map<string, CalcNode[]>();
  for (const node of nodes) {
    if (node.parentId == null || node.parentId === 'unlinked') continue;
    if (!childrenOf.has(node.parentId)) childrenOf.set(node.parentId, []);
    childrenOf.get(node.parentId)!.push(node);
  }

  const descendants = new Set<string>();
  const stack = (childrenOf.get(rootId) ?? [])
    .filter((node) => node.type !== 'related' && getCalcInterestClass(node) === targetInterestClass);

  while (stack.length) {
    const node = stack.pop()!;
    if (descendants.has(node.id)) continue;
    descendants.add(node.id);
    const children = childrenOf.get(node.id) ?? [];
    children.forEach((child) => {
      if (child.type !== 'related' && getCalcInterestClass(child) === targetInterestClass) {
        stack.push(child);
      }
    });
  }

  return descendants;
}

/** Scale fraction and initialFraction for a node and all its descendants. */
function applyBranchScale(nodes: CalcNode[], rootId: string, scaleFactor: Decimal): CalcNode[] {
  if (!scaleFactor.isFinite()) return nodes;
  const descendants = collectAllocatingDescendantIds(nodes, rootId);
  return nodes.map((n) => {
    if (n.id !== rootId && !descendants.has(n.id)) return n;
    return {
      ...n,
      fraction: clamp(n.fraction.mul(scaleFactor)),
      initialFraction: clamp(n.initialFraction.mul(scaleFactor)),
    };
  });
}

// ---------------------------------------------------------------------------
// Share calculation
// ---------------------------------------------------------------------------

export interface ShareParams {
  conveyanceMode: ConveyanceMode;
  splitBasis: SplitBasis;
  numerator: string;
  denominator: string;
  manualAmount: string;
  parentFraction: string;
  parentInitialFraction: string;
}

/** Calculate the share amount for a conveyance. */
export function calculateShare(params: ShareParams): Decimal {
  const parentFrac = d(params.parentFraction);
  const parentInitial = d(params.parentInitialFraction);

  if (params.conveyanceMode === 'all') return clamp(parentFrac);

  if (params.conveyanceMode === 'fixed') return clamp(d(params.manualAmount));

  if (params.conveyanceMode === 'fraction') {
    const num = d(params.numerator);
    const denom = d(params.denominator);
    if (denom.isZero() || !denom.isFinite()) return new Decimal(0);
    const ratio = num.div(denom);

    let base: Decimal;
    if (params.splitBasis === 'whole') base = new Decimal(1);
    else if (params.splitBasis === 'remaining') base = parentFrac;
    else base = parentInitial;

    const raw = clamp(base.mul(ratio));
    return Decimal.min(raw, clamp(parentFrac));
  }

  return new Decimal(0);
}

// ---------------------------------------------------------------------------
// Result constructors
// ---------------------------------------------------------------------------

function ok(nodes: CalcNode[], audit: Audit): Result<OwnershipNode[]> {
  return { ok: true, data: nodes.map(fromCalc), audit };
}

function err(code: string, message: string, details?: unknown): Result<OwnershipNode[]> {
  return { ok: false, error: { code, message, details: details ?? null } };
}

// ---------------------------------------------------------------------------
// Operation 1: Conveyance
// ---------------------------------------------------------------------------

export interface ConveyanceParams {
  allNodes: OwnershipNode[];
  parentId: string;
  newNodeId: string;
  share: string;
  form: Partial<OwnershipNode>;
}

export function executeConveyance(params: ConveyanceParams): Result<OwnershipNode[]> {
  const { parentId, newNodeId, share, form } = params;
  const nodes = params.allNodes.map(toCalc);

  if (!parentId || !newNodeId) return err('invalid_input', 'parentId and newNodeId are required');
  if (nodes.find((n) => n.id === newNodeId)) return err('conflicting_structure', `newNodeId ${newNodeId} already exists`);

  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return err('missing_node', `parentId ${parentId} was not found`);

  const parentInterestClass = getCalcInterestClass(parent);
  const childInterestClass =
    (form.interestClass as InterestClass | undefined) ?? parentInterestClass;
  if (childInterestClass !== parentInterestClass) {
    return err(
      'interest_class_mismatch',
      'Use the NPRI workflow to create royalty burdens from a mineral node'
    );
  }

  const shareAmt = clamp(d(share));
  if (!shareAmt.isFinite()) return err('invalid_input', 'share must be a finite number');
  if (shareAmt.greaterThan(clamp(parent.fraction).plus('0.000000001'))) {
    return err('invalid_input', 'share exceeds parent remaining fraction', {
      parentId,
      parentFraction: serialize(parent.fraction),
      requestedShare: serialize(shareAmt),
    });
  }

  // Apply: reduce parent, create child
  const updatedNodes = nodes.map((n) => {
    if (n.id !== parentId) return n;
    return { ...n, fraction: clamp(n.fraction.minus(shareAmt)) };
  });

  const newNode: CalcNode = {
    id: newNodeId,
    type: 'conveyance',
    parentId,
    fraction: shareAmt,
    initialFraction: shareAmt,
    rest: {
      ...(form ?? {}),
      interestClass: childInterestClass,
      royaltyKind: childInterestClass === 'npri'
        ? ((form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? getCalcRoyaltyKind(parent))
        : null,
    } as Record<string, unknown>,
  };
  // Remove fraction/initialFraction from rest since they're on CalcNode directly
  delete newNode.rest.fraction;
  delete newNode.rest.initialFraction;
  delete newNode.rest.id;
  delete newNode.rest.type;
  delete newNode.rest.parentId;

  updatedNodes.push(newNode);

  const validation = validateCalcGraph(updatedNodes);
  if (!validation.valid) return err('invalid_graph', 'Conveyance would produce invalid ownership graph', validation.issues);

  return ok(updatedNodes, { action: 'convey', affectedCount: 2 });
}

export interface CreateNpriParams {
  allNodes: OwnershipNode[];
  parentId: string;
  newNodeId: string;
  share: string;
  form: Partial<OwnershipNode>;
}

export function executeCreateNpri(params: CreateNpriParams): Result<OwnershipNode[]> {
  const { parentId, newNodeId, share, form } = params;
  const nodes = params.allNodes.map(toCalc);

  if (!parentId || !newNodeId) return err('invalid_input', 'parentId and newNodeId are required');
  if (nodes.find((n) => n.id === newNodeId)) {
    return err('conflicting_structure', `newNodeId ${newNodeId} already exists`);
  }

  const parent = nodes.find((n) => n.id === parentId);
  if (!parent) return err('missing_node', `parentId ${parentId} was not found`);
  if (parent.type === 'related') {
    return err('invalid_input', 'NPRI branches must originate from a conveyance node');
  }
  if (getCalcInterestClass(parent) !== 'mineral') {
    return err(
      'interest_class_mismatch',
      'Use a regular conveyance to split an existing NPRI branch'
    );
  }

  const shareAmt = clamp(d(share));
  if (!shareAmt.isFinite()) return err('invalid_input', 'share must be a finite number');
  if (shareAmt.lessThanOrEqualTo(0)) return err('invalid_input', 'share must be greater than zero');
  if (shareAmt.greaterThan('1.000000001')) {
    return err('invalid_input', 'NPRI share cannot exceed the full royalty interest');
  }

  const newNode: CalcNode = {
    id: newNodeId,
    type: 'conveyance',
    parentId,
    fraction: shareAmt,
    initialFraction: shareAmt,
    rest: {
      ...(form ?? {}),
      interestClass: 'npri',
      royaltyKind:
        (form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? 'fixed',
    } as Record<string, unknown>,
  };
  delete newNode.rest.fraction;
  delete newNode.rest.initialFraction;
  delete newNode.rest.id;
  delete newNode.rest.type;
  delete newNode.rest.parentId;

  const updatedNodes = [...nodes, newNode];
  const validation = validateCalcGraph(updatedNodes);
  if (!validation.valid) {
    return err('invalid_graph', 'NPRI creation would produce invalid ownership graph', validation.issues);
  }

  return ok(updatedNodes, {
    action: 'create_npri',
    affectedCount: 1,
  });
}

// ---------------------------------------------------------------------------
// Operation 2: Rebalance
// ---------------------------------------------------------------------------

export interface RebalanceParams {
  allNodes: OwnershipNode[];
  nodeId: string;
  newInitialFraction: string;
  parentId?: string;
  formFields?: Partial<OwnershipNode>;
}

export function executeRebalance(params: RebalanceParams): Result<OwnershipNode[]> {
  const { nodeId, newInitialFraction, formFields } = params;
  let nodes = params.allNodes.map(toCalc);

  if (!nodeId) return err('invalid_input', 'nodeId is required');
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return err('missing_node', 'Unable to rebalance missing node');

  const oldInitial = node.initialFraction;
  if (oldInitial.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'Cannot rebalance a node with zero or near-zero initial fraction');
  }

  const newInitial = clamp(d(newInitialFraction));
  const scaleFactor = newInitial.div(oldInitial);
  const descendants = collectAllocatingDescendantIds(nodes, nodeId);
  const affectedCount = descendants.size + 1;

  // Scale the branch
  nodes = applyBranchScale(nodes, nodeId, scaleFactor);

  // Update target node's initialFraction explicitly + optional form fields
  const resolvedParentId = node.parentId ?? params.parentId ?? null;
  nodes = nodes.map((n) => {
    if (n.id === nodeId) {
      const updated = { ...n, initialFraction: newInitial };
      if (formFields) {
        const { fraction: _f, initialFraction: _i, id: _id, type: _t, parentId: _p, ...restFields } = formFields;
        updated.rest = { ...updated.rest, ...restFields };
      }
      return updated;
    }
    if (
      resolvedParentId &&
      n.id === resolvedParentId &&
      allocatesAgainstParent(n, node)
    ) {
      return { ...n, fraction: clamp(n.fraction.plus(oldInitial).minus(newInitial)) };
    }
    return n;
  });

  const validation = validateCalcGraph(nodes);
  if (!validation.valid) return err('invalid_graph', 'Rebalance would produce invalid ownership graph', validation.issues);

  return ok(nodes, {
    action: 'rebalance',
    oldInitialFraction: serialize(oldInitial),
    newInitialFraction: serialize(newInitial),
    scaleFactor: scaleFactor.toFixed(12),
    affectedCount,
  });
}

// ---------------------------------------------------------------------------
// Operation 3: Predecessor Insert
// ---------------------------------------------------------------------------

export interface PredecessorInsertParams {
  allNodes: OwnershipNode[];
  activeNodeId: string;
  activeNodeParentId: string | null;
  newPredecessorId: string;
  newInitialFraction: string;
  form: Partial<OwnershipNode>;
}

export function executePredecessorInsert(params: PredecessorInsertParams): Result<OwnershipNode[]> {
  const { activeNodeId, activeNodeParentId, newPredecessorId, newInitialFraction, form } = params;
  let nodes = params.allNodes.map(toCalc);

  if (!activeNodeId || !newPredecessorId) return err('invalid_input', 'activeNodeId and newPredecessorId are required');
  const activeNode = nodes.find((n) => n.id === activeNodeId);
  if (!activeNode) return err('missing_node', 'Unable to insert predecessor for missing node');
  if (nodes.find((n) => n.id === newPredecessorId)) return err('conflicting_structure', `newPredecessorId ${newPredecessorId} already exists`);
  if (newPredecessorId === activeNodeId) return err('conflicting_structure', 'newPredecessorId cannot equal activeNodeId');

  const oldInitial = activeNode.initialFraction;
  if (oldInitial.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'Cannot insert predecessor on a node with zero or near-zero initial fraction');
  }

  const newInitial = clamp(d(newInitialFraction));
  const scaleFactor = newInitial.div(oldInitial);
  const descendants = collectAllocatingDescendantIds(nodes, activeNodeId);
  const affectedCount = descendants.size + 1;

  // Scale the active branch
  nodes = applyBranchScale(nodes, activeNodeId, scaleFactor);

  // Reparent active node to new predecessor, adjust old parent fraction
  nodes = nodes.map((n) => {
    if (n.id === activeNodeId) return { ...n, parentId: newPredecessorId };
    if (
      activeNodeParentId &&
      n.id === activeNodeParentId &&
      allocatesAgainstParent(n, activeNode)
    ) {
      return { ...n, fraction: clamp(n.fraction.plus(oldInitial).minus(newInitial)) };
    }
    return n;
  });

  // Create predecessor node
  const predNode: CalcNode = {
    id: newPredecessorId,
    type: 'conveyance',
    parentId: activeNodeParentId,
    initialFraction: newInitial,
    fraction: new Decimal(0),
    rest: {
      ...(form ?? {}),
      interestClass:
        (form.interestClass as InterestClass | undefined) ?? getCalcInterestClass(activeNode),
      royaltyKind:
        (form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? getCalcRoyaltyKind(activeNode),
    } as Record<string, unknown>,
  };
  delete predNode.rest.fraction;
  delete predNode.rest.initialFraction;
  delete predNode.rest.id;
  delete predNode.rest.type;
  delete predNode.rest.parentId;

  nodes.push(predNode);

  const validation = validateCalcGraph(nodes);
  if (!validation.valid) return err('invalid_graph', 'Predecessor insert would produce invalid ownership graph', validation.issues);

  return ok(nodes, {
    action: 'precede',
    oldInitialFraction: serialize(oldInitial),
    newInitialFraction: serialize(newInitial),
    scaleFactor: scaleFactor.toFixed(12),
    affectedCount,
  });
}

// ---------------------------------------------------------------------------
// Operation 4: Attach Conveyance (move subtree)
// ---------------------------------------------------------------------------

export interface AttachConveyanceParams {
  allNodes: OwnershipNode[];
  activeNodeId: string;
  attachParentId: string;
  calcShare: string;
  form: Partial<OwnershipNode>;
}

export function executeAttachConveyance(params: AttachConveyanceParams): Result<OwnershipNode[]> {
  const { activeNodeId, attachParentId, calcShare, form } = params;
  const nodes = params.allNodes.map(toCalc);

  if (!activeNodeId || !attachParentId) return err('invalid_input', 'activeNodeId and attachParentId are required');
  const sourceRoot = nodes.find((n) => n.id === activeNodeId);
  if (!sourceRoot) return err('missing_node', `activeNodeId ${activeNodeId} was not found`);
  const destination = nodes.find((n) => n.id === attachParentId);
  if (!destination) return err('missing_node', `attachParentId ${attachParentId} was not found`);
  if (getCalcInterestClass(sourceRoot) !== getCalcInterestClass(destination)) {
    return err('interest_class_mismatch', 'Cannot attach across mineral and NPRI branches');
  }

  const descendants = collectAllocatingDescendantIds(nodes, activeNodeId);
  if (attachParentId === activeNodeId || descendants.has(attachParentId)) {
    return err('conflicting_structure', 'Cannot attach to self or descendant');
  }

  const newRootFraction = clamp(d(calcShare));
  if (!newRootFraction.isFinite()) return err('invalid_input', 'calcShare must be a finite number');
  if (newRootFraction.greaterThan(clamp(destination.fraction).plus('0.000000001'))) {
    return err('invalid_input', 'calcShare exceeds destination remaining fraction', {
      attachParentId,
      destinationFraction: serialize(destination.fraction),
      requestedShare: serialize(newRootFraction),
    });
  }

  const oldRootInitial = Decimal.max(sourceRoot.initialFraction, sourceRoot.fraction, '0.000000001');
  const scaleFactor = newRootFraction.div(oldRootInitial);

  const updatedNodes = nodes.map((n) => {
    if (n.id === attachParentId) {
      return { ...n, fraction: clamp(n.fraction.minus(newRootFraction)) };
    }
    if (n.id === activeNodeId) {
      const updated: CalcNode = {
        ...n,
        parentId: attachParentId,
        type: 'conveyance',
        fraction: clamp(n.fraction.mul(scaleFactor)),
        initialFraction: newRootFraction,
        rest: {
          ...n.rest,
          ...(form ?? {}),
          interestClass: getCalcInterestClass(sourceRoot),
          royaltyKind:
            (form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? getCalcRoyaltyKind(sourceRoot),
        } as Record<string, unknown>,
      };
      delete updated.rest.fraction;
      delete updated.rest.initialFraction;
      delete updated.rest.id;
      delete updated.rest.type;
      delete updated.rest.parentId;
      return updated;
    }
    if (descendants.has(n.id)) {
      return {
        ...n,
        fraction: clamp(n.fraction.mul(scaleFactor)),
        initialFraction: clamp(n.initialFraction.mul(scaleFactor)),
      };
    }
    return n;
  });

  const validation = validateCalcGraph(updatedNodes);
  if (!validation.valid) return err('invalid_graph', 'Attach would produce invalid ownership graph', validation.issues);

  return ok(updatedNodes, {
    action: 'attach_conveyance',
    oldRootFraction: serialize(sourceRoot.initialFraction),
    newRootFraction: serialize(newRootFraction),
    scaleFactor: scaleFactor.toFixed(12),
    affectedCount: descendants.size + 1,
  });
}

// ---------------------------------------------------------------------------
// Operation 5: Delete Branch
// ---------------------------------------------------------------------------

export interface DeleteBranchParams {
  allNodes: OwnershipNode[];
  nodeId: string;
}

export function executeDeleteBranch(params: DeleteBranchParams): Result<OwnershipNode[]> {
  const { nodeId } = params;
  const nodes = params.allNodes.map(toCalc);

  if (!nodeId) return err('invalid_input', 'nodeId is required');
  const target = nodes.find((n) => n.id === nodeId);
  if (!target) return err('missing_node', `nodeId ${nodeId} was not found`);

  const descendants = collectDescendantIds(nodes, nodeId);
  const removedIds = new Set([nodeId, ...descendants]);

  const updatedNodes = nodes
    .filter((n) => !removedIds.has(n.id))
    .map((n) => {
      if (
      target.type !== 'related' &&
      target.parentId &&
      target.parentId !== 'unlinked' &&
      n.id === target.parentId &&
      allocatesAgainstParent(n, target)
      ) {
        return {
          ...n,
          fraction: clamp(n.fraction.plus(target.initialFraction)),
        };
      }
      return n;
    });

  const validation = validateCalcGraph(updatedNodes);
  if (!validation.valid) {
    return err(
      'invalid_graph',
      'Delete would produce invalid ownership graph',
      validation.issues
    );
  }

  return ok(updatedNodes, {
    action: 'delete_branch',
    affectedCount: removedIds.size,
    restoredParentId:
      target.type !== 'related' && target.parentId && target.parentId !== 'unlinked'
        ? target.parentId
        : null,
    restoredFraction:
      target.type !== 'related' ? serialize(target.initialFraction) : '0',
  });
}

// ---------------------------------------------------------------------------
// Graph validation
// ---------------------------------------------------------------------------

interface ValidationIssue {
  code: string;
  nodeId?: string;
  message: string;
  details?: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

function validateCalcGraph(nodes: CalcNode[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, CalcNode>();

  // Check for duplicates and invalid fractions
  for (const node of nodes) {
    if (!node.id) {
      issues.push({ code: 'invalid_node', message: 'Node missing id' });
      continue;
    }
    if (byId.has(node.id)) {
      issues.push({ code: 'duplicate_id', nodeId: node.id, message: `Duplicate node id ${node.id}` });
    }
    byId.set(node.id, node);

    if (!node.fraction.isFinite()) {
      issues.push({ code: 'non_finite_fraction', nodeId: node.id, message: `Non-finite fraction at ${node.id}` });
    }
    if (!node.initialFraction.isFinite()) {
      issues.push({ code: 'non_finite_initial_fraction', nodeId: node.id, message: `Non-finite initialFraction at ${node.id}` });
    }
    if (node.fraction.isNegative()) {
      issues.push({ code: 'negative_fraction', nodeId: node.id, message: `Negative fraction at ${node.id}` });
    }
    if (node.initialFraction.isNegative()) {
      issues.push({ code: 'negative_initial_fraction', nodeId: node.id, message: `Negative initialFraction at ${node.id}` });
    }
  }

  // Check parent references
  for (const node of nodes) {
    if (!node.id || node.parentId == null || node.parentId === 'unlinked') continue;
    if (!byId.has(node.parentId)) {
      issues.push({ code: 'missing_parent', nodeId: node.id, message: `Missing parent ${node.parentId} for ${node.id}` });
    }
    if (node.parentId === node.id) {
      issues.push({ code: 'self_parent', nodeId: node.id, message: `Self-parent cycle at ${node.id}` });
    }
  }

  // Check for cycles
  for (const node of nodes) {
    if (!node.id) continue;
    const visited = new Set([node.id]);
    let cursor: CalcNode | undefined = node;
    while (cursor?.parentId != null && cursor.parentId !== 'unlinked') {
      const next = byId.get(cursor.parentId);
      if (!next) break;
      if (visited.has(next.id)) {
        issues.push({ code: 'cycle_detected', nodeId: node.id, message: `Cycle detected involving ${next.id}` });
        break;
      }
      visited.add(next.id);
      cursor = next;
    }
  }

  // Check branch allocation invariant
  const EPSILON = new Decimal('0.000000001');
  for (const node of nodes) {
    if (!node.id || node.type === 'related') continue;
    const initial = clamp(node.initialFraction);
    const remaining = clamp(node.fraction);
    let childInitialTotal = new Decimal(0);
    for (const child of nodes) {
      if (
        child.type === 'related' ||
        child.parentId !== node.id ||
        !allocatesAgainstParent(node, child)
      ) continue;
      childInitialTotal = childInitialTotal.plus(clamp(child.initialFraction));
    }
    const allocated = remaining.plus(childInitialTotal);
    if (allocated.minus(initial).greaterThan(EPSILON)) {
      issues.push({
        code: 'over_allocated_branch',
        nodeId: node.id,
        message: `Allocated branch interest exceeds initial grant at ${node.id}`,
        details: {
          initial: serialize(initial),
          remaining: serialize(remaining),
          childInitialTotal: serialize(childInitialTotal),
          allocated: serialize(allocated),
        },
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

// ---------------------------------------------------------------------------
// Public validation (works on serialized nodes)
// ---------------------------------------------------------------------------

export function validateOwnershipGraph(nodes: OwnershipNode[]): ValidationResult {
  return validateCalcGraph(nodes.map(toCalc));
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

/** Sum of all root-level node fractions (should equal 1.0 for a complete tree). */
export function rootOwnershipTotal(nodes: OwnershipNode[]): Decimal {
  let total = new Decimal(0);
  for (const node of nodes) {
    if (
      node.type === 'related' ||
      node.parentId === 'unlinked' ||
      ((node.interestClass ?? 'mineral') !== 'mineral')
    ) continue;
    if (node.parentId == null) {
      total = total.plus(d(node.fraction));
    }
  }
  return total;
}
