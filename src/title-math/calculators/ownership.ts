/**
 * Ownership-graph mutation calculator for the unified title-math engine.
 *
 * Faithful port of the v2 engine's seven tree operations plus share calculation,
 * the over-100 root guard, and the public validation/root-total surface
 * (math-engine.ts). The arithmetic is preserved exactly; node fractions and
 * audit fractions emit through `emitNodeFraction` (= serialize) and scale factors
 * through `emitScaleFactor` (= toFixed(12)), so every Result is byte-identical to
 * the v2 engine. Van Dyke (calculateShare multiplies one ratio against one
 * chosen base, never two user fractions) and warn-don't-cap (calculateShare
 * returns the raw uncapped share) are preserved structurally.
 */
import { Decimal } from 'decimal.js';

import { clamp, d } from '../../engine/decimal';
import type {
  ConveyanceMode,
  InterestClass,
  OwnershipNode,
  SplitBasis,
} from '../../types/node';
import type { Audit, Result } from '../../types/result';
import {
  allocatesAgainstParent,
  fromCalc,
  getCalcFixedRoyaltyBasis,
  getCalcInterestClass,
  getCalcRoyaltyKind,
  makeCalcNode,
  toCalc,
  type CalcNode,
} from '../model/calc-node';
import {
  applyBranchScale,
  collectAllocatingDescendantIds,
  collectDescendantIds,
  EPSILON,
  rootMineralInitialTotal,
  validateCalcGraph,
  type ValidationIssue,
  type ValidationResult,
} from '../model/graph-ops';
import { emitNodeFraction, emitScaleFactor } from '../precision/emit';

// ── Result constructors ─────────────────────────────────────

function ok(nodes: CalcNode[], audit: Audit): Result<OwnershipNode[]> {
  return { ok: true, data: nodes.map(fromCalc), audit };
}

function err(code: string, message: string, details?: unknown): Result<OwnershipNode[]> {
  return { ok: false, error: { code, message, details: details ?? null } };
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

// ── Share calculation ───────────────────────────────────────

export interface ShareParams {
  conveyanceMode: ConveyanceMode;
  splitBasis: SplitBasis;
  numerator: string;
  denominator: string;
  manualAmount: string;
  parentFraction: string;
  parentInitialFraction: string;
}

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

    // Van Dyke: multiply ONE ratio against exactly ONE chosen base, never two
    // user-entered fractions.
    let base: Decimal;
    if (params.splitBasis === 'whole') base = new Decimal(1);
    else if (params.splitBasis === 'remaining') base = parentFrac;
    else base = parentInitial;

    // DA-M1 warn-don't-cap: return the raw requested share UNCAPPED.
    return clamp(base.mul(ratio));
  }

  return new Decimal(0);
}

// ── Over-100 root guard ─────────────────────────────────────

function assertRootTotalNotWorsened(
  before: CalcNode[],
  after: CalcNode[]
): Result<OwnershipNode[]> | null {
  const beforeTotal = rootMineralInitialTotal(before);
  const afterTotal = rootMineralInitialTotal(after);
  const overByAfter = afterTotal.minus(1);
  if (overByAfter.lessThanOrEqualTo(EPSILON)) return null;
  if (afterTotal.greaterThan(beforeTotal.plus(EPSILON))) {
    return err(
      'invalid_graph',
      `Operation would push root mineral total to ${afterTotal.toFixed(9)} (limit 1.0)`,
      { beforeTotal: beforeTotal.toFixed(9), afterTotal: afterTotal.toFixed(9) }
    );
  }
  return null;
}

// ── Operation 1: Conveyance ─────────────────────────────────

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
      parentFraction: emitNodeFraction(parent.fraction),
      requestedShare: emitNodeFraction(shareAmt),
    });
  }

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

  const newNode = makeCalcNode({
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
    },
  });

  updatedNodes.push(newNode);

  const validation = validateCalcGraph(updatedNodes);
  if (!validation.valid) return err('invalid_graph', 'Conveyance would produce invalid ownership graph', validation.issues);

  return ok(updatedNodes, { action: 'convey', affectedCount: 2 });
}

// ── Operation: Create NPRI ──────────────────────────────────

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

  const newNode = makeCalcNode({
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
    },
  });

  const updatedNodes = [...nodes, newNode];
  const validation = validateCalcGraph(updatedNodes);
  if (!validation.valid) {
    return err('invalid_graph', 'NPRI creation would produce invalid ownership graph', validation.issues);
  }

  return ok(updatedNodes, { action: 'create_npri', affectedCount: 1 });
}

// ── Operation: Create Root Node ─────────────────────────────

export interface CreateRootNodeParams {
  allNodes: OwnershipNode[];
  newNodeId: string;
  initialFraction: string;
  form: Partial<OwnershipNode>;
}

export function executeCreateRootNode(
  params: CreateRootNodeParams
): Result<OwnershipNode[]> {
  const { newNodeId, initialFraction, form } = params;
  const nodes = params.allNodes.map(toCalc);

  if (!newNodeId) return err('invalid_input', 'newNodeId is required');
  if (nodes.find((n) => n.id === newNodeId)) {
    return err('conflicting_structure', `newNodeId ${newNodeId} already exists`);
  }

  const requestedType = (form.type as OwnershipNode['type'] | undefined) ?? 'conveyance';
  if (requestedType === 'related') {
    return err('invalid_input', 'Standalone root nodes must be conveyance nodes (not lease/document)');
  }

  const parsed = parseStrictDecimal(initialFraction);
  if (!parsed) return err('invalid_input', 'initialFraction must be a finite number');
  if (parsed.lessThanOrEqualTo(0)) {
    return err('invalid_input', 'initialFraction must be greater than zero');
  }
  if (parsed.greaterThan(new Decimal(1).plus(EPSILON))) {
    return err('invalid_input', 'initialFraction cannot exceed 1');
  }

  const interestClass =
    (form.interestClass as InterestClass | undefined) ?? 'mineral';
  const royaltyKind =
    interestClass === 'npri'
      ? (form.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? 'fixed'
      : null;
  const fixedRoyaltyBasis =
    interestClass === 'npri' && royaltyKind === 'fixed'
      ? (form.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined)
        ?? 'burdened_branch'
      : null;

  const newNode = makeCalcNode({
    id: newNodeId,
    type: 'conveyance',
    parentId: null,
    fraction: parsed,
    initialFraction: parsed,
    rest: {
      ...(form ?? {}),
      interestClass,
      royaltyKind,
      fixedRoyaltyBasis,
    },
  });

  const updatedNodes = [...nodes, newNode];

  const preValidation = validateCalcGraph(nodes);
  const postValidation = validateCalcGraph(updatedNodes);
  const issueKey = (issue: ValidationIssue) => `${issue.code}::${issue.nodeId ?? ''}`;
  const preExistingKeys = new Set(preValidation.issues.map(issueKey));
  const newIssues = postValidation.issues.filter(
    (issue) => !preExistingKeys.has(issueKey(issue))
  );
  if (newIssues.length > 0) {
    return err('invalid_graph', 'Root creation would produce invalid ownership graph', newIssues);
  }

  return ok(updatedNodes, { action: 'create_root_node', affectedCount: 1 });
}

// ── Operation 2: Rebalance ──────────────────────────────────

export interface RebalanceParams {
  allNodes: OwnershipNode[];
  nodeId: string;
  newInitialFraction: string;
  parentId?: string;
  formFields?: Partial<OwnershipNode>;
}

export function executeRebalance(params: RebalanceParams): Result<OwnershipNode[]> {
  const { nodeId, newInitialFraction, formFields } = params;
  const originalNodes = params.allNodes.map(toCalc);
  let nodes = originalNodes;

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

  nodes = applyBranchScale(nodes, nodeId, scaleFactor);

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

  const rootTotalErr = assertRootTotalNotWorsened(originalNodes, nodes);
  if (rootTotalErr) return rootTotalErr;

  return ok(nodes, {
    action: 'rebalance',
    oldInitialFraction: emitNodeFraction(oldInitial),
    newInitialFraction: emitNodeFraction(newInitial),
    scaleFactor: emitScaleFactor(scaleFactor),
    affectedCount,
  });
}

// ── Operation 3: Predecessor Insert ─────────────────────────

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
  const originalNodes = params.allNodes.map(toCalc);
  let nodes = originalNodes;

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

  nodes = applyBranchScale(nodes, activeNodeId, scaleFactor);

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

  const predNode = makeCalcNode({
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
    },
  });

  nodes.push(predNode);

  const validation = validateCalcGraph(nodes);
  if (!validation.valid) return err('invalid_graph', 'Predecessor insert would produce invalid ownership graph', validation.issues);

  const rootTotalErr = assertRootTotalNotWorsened(originalNodes, nodes);
  if (rootTotalErr) return rootTotalErr;

  return ok(nodes, {
    action: 'precede',
    oldInitialFraction: emitNodeFraction(oldInitial),
    newInitialFraction: emitNodeFraction(newInitial),
    scaleFactor: emitScaleFactor(scaleFactor),
    affectedCount,
  });
}

// ── Operation 4: Attach Conveyance (move subtree) ───────────

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
      destinationFraction: emitNodeFraction(destinationCapacity),
      requestedShare: emitNodeFraction(newRootFraction),
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
      return makeCalcNode({
        id: next.id,
        type: 'conveyance',
        parentId: attachParentId,
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
        },
      });
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

  const rootTotalErr = assertRootTotalNotWorsened(nodes, updatedNodes);
  if (rootTotalErr) return rootTotalErr;

  return ok(updatedNodes, {
    action: 'attach_conveyance',
    oldRootFraction: emitNodeFraction(sourceRoot.initialFraction),
    newRootFraction: emitNodeFraction(newRootFraction),
    scaleFactor: emitScaleFactor(scaleFactor),
    affectedCount: descendants.size + 1,
  });
}

// ── Operation 5: Delete Branch ──────────────────────────────

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

  const preValidation = validateCalcGraph(nodes);
  const postValidation = validateCalcGraph(updatedNodes);
  const issueKey = (issue: ValidationIssue) => `${issue.code}::${issue.nodeId ?? ''}`;
  const preExistingKeys = new Set(preValidation.issues.map(issueKey));
  const newIssues = postValidation.issues.filter(
    (issue) => !preExistingKeys.has(issueKey(issue))
  );
  if (newIssues.length > 0) {
    return err(
      'invalid_graph',
      'Delete would introduce new ownership-graph issues',
      newIssues
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
      target.type !== 'related' ? emitNodeFraction(target.initialFraction) : '0',
  });
}

// ── Public validation / aggregates ──────────────────────────

export function validateOwnershipGraph(nodes: OwnershipNode[]): ValidationResult {
  return validateCalcGraph(nodes.map(toCalc));
}

/**
 * Sum of the REMAINING `fraction` across mineral root nodes. Diagnostic/test
 * helper -- normally ~1.0 but legitimately diverges under deliberate over- or
 * under-conveyance. Contrast `rootMineralInitialTotal` (model/graph-ops.ts),
 * which sums INITIAL fractions and is the production over-100 guard input.
 */
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
