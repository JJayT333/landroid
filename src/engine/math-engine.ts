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

/**
 * Read the stored NPRI royalty characterization off a CalcNode.
 *
 * Propagation helper so NPRI conveyances and predecessor inserts inherit the
 * stored deed characterization from the parent branch.
 */
function getCalcRoyaltyKind(node: CalcNode): OwnershipNode['royaltyKind'] {
  return (node.rest.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? null;
}

function getCalcFixedRoyaltyBasis(node: CalcNode): OwnershipNode['fixedRoyaltyBasis'] {
  return (
    (node.rest.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined) ?? null
  );
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

function parseStrictDecimal(
  value: string | number | Decimal | undefined | null
): Decimal | null {
  if (value instanceof Decimal) {
    return value.isFinite() ? value : null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? new Decimal(value) : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = new Decimal(trimmed);
      return parsed.isFinite() ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
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

const EPSILON = new Decimal('0.000000001');

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
  if (parent.type === 'related') {
    return err('invalid_input', 'Conveyances must originate from a title-interest node');
  }

  const parentInterestClass = getCalcInterestClass(parent);
  const childInterestClass =
    (form.interestClass as InterestClass | undefined) ?? parentInterestClass;
  if (childInterestClass !== parentInterestClass) {
    return err(
      'interest_class_mismatch',
      'Use the NPRI workflow to create royalty burdens from a mineral node'
    );
  }

  const parsedShare = parseStrictDecimal(share);
  if (!parsedShare) return err('invalid_input', 'share must be a finite number');
  if (parsedShare.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'share must be greater than zero');
  }
  const shareAmt = parsedShare;
  if (shareAmt.greaterThan(clamp(parent.fraction).plus(EPSILON))) {
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
  const royaltyKind =
    childInterestClass === 'npri'
      ? (
          (form.royaltyKind as OwnershipNode['royaltyKind'] | undefined)
          ?? getCalcRoyaltyKind(parent)
        )
      : null;
  const fixedRoyaltyBasis =
    childInterestClass === 'npri' && royaltyKind === 'fixed'
      ? (
          (form.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined)
          ?? getCalcFixedRoyaltyBasis(parent)
          ?? 'burdened_branch'
        )
      : null;

  const newNode: CalcNode = {
    id: newNodeId,
    type: 'conveyance',
    parentId,
    fraction: shareAmt,
    initialFraction: shareAmt,
    rest: {
      ...(form ?? {}),
      interestClass: childInterestClass,
      royaltyKind,
      fixedRoyaltyBasis,
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

  const parsedShare = parseStrictDecimal(share);
  if (!parsedShare) return err('invalid_input', 'share must be a finite number');
  const shareAmt = parsedShare;
  if (shareAmt.lessThanOrEqualTo(0)) return err('invalid_input', 'share must be greater than zero');
  const royaltyKind =
    (form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? 'fixed';
  const fixedRoyaltyBasis =
    royaltyKind === 'fixed'
      ? (
          (form.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined)
          ?? 'burdened_branch'
        )
      : null;

  const newNode: CalcNode = {
    id: newNodeId,
    type: 'conveyance',
    parentId,
    fraction: shareAmt,
    initialFraction: shareAmt,
    rest: {
      ...(form ?? {}),
      interestClass: 'npri',
      royaltyKind,
      fixedRoyaltyBasis,
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
  if (node.type === 'related') {
    return err('invalid_input', 'Cannot rebalance a related document or lease node');
  }

  const parsedNewInitial = parseStrictDecimal(newInitialFraction);
  if (!parsedNewInitial) {
    return err('invalid_input', 'newInitialFraction must be a finite number');
  }
  if (parsedNewInitial.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'newInitialFraction must be greater than zero');
  }
  const newInitial = parsedNewInitial;
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
  if (activeNode.type === 'related') {
    return err('invalid_input', 'Cannot insert a predecessor above a related document or lease node');
  }

  const oldInitial = activeNode.initialFraction;
  if (oldInitial.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'Cannot insert predecessor on a node with zero or near-zero initial fraction');
  }

  const parsedNewInitial = parseStrictDecimal(newInitialFraction);
  if (!parsedNewInitial) {
    return err('invalid_input', 'newInitialFraction must be a finite number');
  }
  if (parsedNewInitial.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'newInitialFraction must be greater than zero');
  }
  const newInitial = parsedNewInitial;
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
      fixedRoyaltyBasis:
        (
          (form.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined)
          ?? getCalcFixedRoyaltyBasis(activeNode)
        )
        && (
          ((form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? getCalcRoyaltyKind(activeNode))
            === 'fixed'
        )
          ? (
              (form.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined)
              ?? getCalcFixedRoyaltyBasis(activeNode)
              ?? 'burdened_branch'
            )
          : null,
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
  if (sourceRoot.type === 'related' || destination.type === 'related') {
    return err('invalid_input', 'Attach conveyance only works between title-interest nodes');
  }
  if (getCalcInterestClass(sourceRoot) !== getCalcInterestClass(destination)) {
    return err('interest_class_mismatch', 'Cannot attach across mineral and NPRI branches');
  }

  const descendants = collectAllocatingDescendantIds(nodes, activeNodeId);
  if (attachParentId === activeNodeId || descendants.has(attachParentId)) {
    return err('conflicting_structure', 'Cannot attach to self or descendant');
  }

  const sourceParentId =
    sourceRoot.parentId && sourceRoot.parentId !== 'unlinked' ? sourceRoot.parentId : null;
  const sourceParent = sourceParentId
    ? nodes.find((n) => n.id === sourceParentId) ?? null
    : null;
  const refundSourceParent = Boolean(
    sourceParent
    && sourceRoot.type !== 'related'
    && allocatesAgainstParent(sourceParent, sourceRoot)
  );

  const parsedCalcShare = parseStrictDecimal(calcShare);
  if (!parsedCalcShare) return err('invalid_input', 'calcShare must be a finite number');
  if (parsedCalcShare.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'calcShare must be greater than zero');
  }
  const newRootFraction = parsedCalcShare;
  const destinationCapacity = refundSourceParent && sourceParentId === attachParentId
    ? clamp(destination.fraction.plus(sourceRoot.initialFraction))
    : clamp(destination.fraction);
  if (newRootFraction.greaterThan(destinationCapacity.plus(EPSILON))) {
    return err('invalid_input', 'calcShare exceeds destination remaining fraction', {
      attachParentId,
      destinationFraction: serialize(destinationCapacity),
      requestedShare: serialize(newRootFraction),
    });
  }

  const oldRootInitial = Decimal.max(sourceRoot.initialFraction, sourceRoot.fraction, '0.000000001');
  const scaleFactor = newRootFraction.div(oldRootInitial);

  const updatedNodes = nodes.map((n) => {
    let next = n;

    if (refundSourceParent && sourceParentId && next.id === sourceParentId) {
      next = {
        ...next,
        fraction: clamp(next.fraction.plus(sourceRoot.initialFraction)),
      };
    }

    if (next.id === attachParentId) {
      next = { ...next, fraction: clamp(next.fraction.minus(newRootFraction)) };
    }

    if (next.id === activeNodeId) {
      const updated: CalcNode = {
        ...next,
        parentId: attachParentId,
        type: 'conveyance',
        fraction: clamp(next.fraction.mul(scaleFactor)),
        initialFraction: newRootFraction,
        rest: {
          ...next.rest,
          ...(form ?? {}),
          interestClass: getCalcInterestClass(sourceRoot),
          royaltyKind:
            (form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? getCalcRoyaltyKind(sourceRoot),
          fixedRoyaltyBasis:
            (
              (form.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined)
              ?? getCalcFixedRoyaltyBasis(sourceRoot)
            )
            && (
              ((form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? getCalcRoyaltyKind(sourceRoot))
                === 'fixed'
            )
              ? (
                  (form.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined)
                  ?? getCalcFixedRoyaltyBasis(sourceRoot)
                  ?? 'burdened_branch'
                )
              : null,
        } as Record<string, unknown>,
      };
      delete updated.rest.fraction;
      delete updated.rest.initialFraction;
      delete updated.rest.id;
      delete updated.rest.type;
      delete updated.rest.parentId;
      return updated;
    }
    if (descendants.has(next.id)) {
      return {
        ...next,
        fraction: clamp(next.fraction.mul(scaleFactor)),
        initialFraction: clamp(next.initialFraction.mul(scaleFactor)),
      };
    }
    return next;
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

export interface ValidationIssue {
  code: string;
  nodeId?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type NpriBranchDiscrepancyKind =
  | 'fixed_whole_tract_over_branch'
  | 'fixed_branch_over_branch'
  | 'floating_over_royalty';

export interface NpriBranchDiscrepancy {
  kind: NpriBranchDiscrepancyKind;
  burdenedBranchNodeId: string;
  npriNodeIds: string[];
  totalBurden: string;
  capacity: string;
  excess: string;
}

function findBurdenedMineralAncestorId(
  node: CalcNode,
  byId: Map<string, CalcNode>
): string | null {
  let cursor = node.parentId ? byId.get(node.parentId) ?? null : null;

  while (cursor) {
    if (cursor.type !== 'related' && getCalcInterestClass(cursor) === 'mineral') {
      return cursor.id;
    }
    cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
  }

  return null;
}

export function findNpriBranchDiscrepancies(
  nodes: OwnershipNode[]
): NpriBranchDiscrepancy[] {
  const calcNodes = nodes.map(toCalc);
  const byId = new Map(calcNodes.map((node) => [node.id, node]));
  const branchTotals = new Map<
    string,
    {
      fixedWholeTractTotal: Decimal;
      fixedWholeTractNodeIds: string[];
      fixedBranchTotal: Decimal;
      fixedBranchNodeIds: string[];
      floatingTotal: Decimal;
      floatingNodeIds: string[];
    }
  >();

  calcNodes.forEach((node) => {
    if (
      node.type === 'related'
      || getCalcInterestClass(node) !== 'npri'
      || !node.fraction.greaterThan(0)
    ) {
      return;
    }

    const burdenedBranchNodeId = findBurdenedMineralAncestorId(node, byId);
    if (!burdenedBranchNodeId) {
      return;
    }

    const totals = branchTotals.get(burdenedBranchNodeId) ?? {
      fixedWholeTractTotal: new Decimal(0),
      fixedWholeTractNodeIds: [],
      fixedBranchTotal: new Decimal(0),
      fixedBranchNodeIds: [],
      floatingTotal: new Decimal(0),
      floatingNodeIds: [],
    };

    if (getCalcRoyaltyKind(node) === 'floating') {
      totals.floatingTotal = totals.floatingTotal.plus(node.fraction);
      totals.floatingNodeIds.push(node.id);
    } else if (getCalcFixedRoyaltyBasis(node) === 'whole_tract') {
      totals.fixedWholeTractTotal = totals.fixedWholeTractTotal.plus(node.fraction);
      totals.fixedWholeTractNodeIds.push(node.id);
    } else {
      totals.fixedBranchTotal = totals.fixedBranchTotal.plus(node.fraction);
      totals.fixedBranchNodeIds.push(node.id);
    }

    branchTotals.set(burdenedBranchNodeId, totals);
  });

  const discrepancies: NpriBranchDiscrepancy[] = [];
  branchTotals.forEach((totals, burdenedBranchNodeId) => {
    const branchNode = byId.get(burdenedBranchNodeId);
    const branchCapacity = branchNode?.initialFraction ?? new Decimal(0);

    if (totals.fixedWholeTractTotal.greaterThan(branchCapacity.plus(EPSILON))) {
      discrepancies.push({
        kind: 'fixed_whole_tract_over_branch',
        burdenedBranchNodeId,
        npriNodeIds: totals.fixedWholeTractNodeIds,
        totalBurden: serialize(totals.fixedWholeTractTotal),
        capacity: serialize(branchCapacity),
        excess: serialize(totals.fixedWholeTractTotal.minus(branchCapacity)),
      });
    }

    if (totals.fixedBranchTotal.greaterThan(new Decimal(1).plus(EPSILON))) {
      discrepancies.push({
        kind: 'fixed_branch_over_branch',
        burdenedBranchNodeId,
        npriNodeIds: totals.fixedBranchNodeIds,
        totalBurden: serialize(totals.fixedBranchTotal),
        capacity: '1',
        excess: serialize(totals.fixedBranchTotal.minus(1)),
      });
    }

    if (totals.floatingTotal.greaterThan(new Decimal(1).plus(EPSILON))) {
      discrepancies.push({
        kind: 'floating_over_royalty',
        burdenedBranchNodeId,
        npriNodeIds: totals.floatingNodeIds,
        totalBurden: serialize(totals.floatingTotal),
        capacity: '1',
        excess: serialize(totals.floatingTotal.minus(1)),
      });
    }
  });

  return discrepancies;
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
    const allocationDelta = allocated.minus(initial);
    if (allocationDelta.greaterThan(EPSILON)) {
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
    } else if (allocationDelta.lessThan(EPSILON.negated())) {
      issues.push({
        code: 'under_allocated_branch',
        nodeId: node.id,
        message: `Allocated branch interest is below initial grant at ${node.id}`,
        details: {
          initial: serialize(initial),
          remaining: serialize(remaining),
          childInitialTotal: serialize(childInitialTotal),
          allocated: serialize(allocated),
        },
      });
    }
  }

  for (const node of nodes) {
    if (node.type !== 'related') continue;
    if (!clamp(node.initialFraction).isZero() || !clamp(node.fraction).isZero()) {
      issues.push({
        code: 'related_node_with_fraction',
        nodeId: node.id,
        message: `Related node ${node.id} should not carry ownership fractions`,
        details: {
          initialFraction: serialize(node.initialFraction),
          fraction: serialize(node.fraction),
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
