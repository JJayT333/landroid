/**
 * Pure ownership-graph operations shared by the unified engine's calculators:
 * descendant collection, branch scaling, graph validation, NPRI branch-burden
 * discrepancy detection, and root mineral totals.
 *
 * Faithful port of the corresponding helpers in the v2 engine (math-engine.ts).
 * Arithmetic and emission are preserved exactly; fraction emission routes
 * through `emitNodeFraction` (= serialize) so output is byte-identical.
 */
import { Decimal } from 'decimal.js';

import { clamp } from '../../engine/decimal';
import type { OwnershipNode } from '../../types/node';
import { emitNodeFraction } from '../precision/emit';
import {
  allocatesAgainstParent,
  getCalcFixedRoyaltyBasis,
  getCalcInterestClass,
  getCalcRoyaltyKind,
  toCalc,
  type CalcNode,
} from './calc-node';

export const EPSILON = new Decimal('0.000000001');

// ── Descendant collection / scaling ─────────────────────────

/** Build parentId->children index, then DFS to collect all descendants. O(n). */
export function collectDescendantIds(nodes: CalcNode[], rootId: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId == null || node.parentId === 'unlinked') continue;
    if (!childrenOf.has(node.parentId)) childrenOf.set(node.parentId, []);
    childrenOf.get(node.parentId)!.push(node.id);
  }
  const descendants = new Set<string>();
  const stack = childrenOf.get(rootId)?.slice() ?? [];
  while (stack.length) {
    const id = stack.pop()!;
    if (descendants.has(id)) continue;
    descendants.add(id);
    const children = childrenOf.get(id);
    if (children) stack.push(...children);
  }
  return descendants;
}

export function collectAllocatingDescendantIds(
  nodes: CalcNode[],
  rootId: string
): Set<string> {
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
  const stack = (childrenOf.get(rootId) ?? []).filter(
    (node) => node.type !== 'related' && getCalcInterestClass(node) === targetInterestClass
  );

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

/** Scale fraction and initialFraction for a node and all its allocating descendants. */
export function applyBranchScale(
  nodes: CalcNode[],
  rootId: string,
  scaleFactor: Decimal
): CalcNode[] {
  if (!scaleFactor.isFinite()) return nodes;
  const descendants = collectAllocatingDescendantIds(nodes, rootId);
  return nodes.map((node) => {
    if (node.id !== rootId && !descendants.has(node.id)) return node;
    return {
      ...node,
      fraction: clamp(node.fraction.mul(scaleFactor)),
      initialFraction: clamp(node.initialFraction.mul(scaleFactor)),
    };
  });
}

// ── Root mineral total (the over-100 guard input) ───────────

/**
 * Sum of root mineral INITIAL fractions -- the over-100 guard input. A root's
 * ownership budget is the amount it was granted, not the residue after
 * descendants took shares, so this sums `initialFraction`.
 *
 * Contrast `rootOwnershipTotal` (calculators/ownership.ts), the diagnostic that
 * sums the REMAINING `fraction` across mineral roots. The two have deliberately
 * opposite inputs: this one guards that a mutation cannot push granted ownership
 * over 1; the other reports how much of the granted ownership is still unconveyed.
 */
export function rootMineralInitialTotal(nodes: CalcNode[]): Decimal {
  let total = new Decimal(0);
  for (const node of nodes) {
    if (node.type === 'related' || node.parentId === 'unlinked') continue;
    const interestClass = getCalcInterestClass(node);
    if (interestClass !== 'mineral') continue;
    if (node.parentId == null) {
      total = total.plus(node.initialFraction);
    }
  }
  return total;
}

// ── Graph validation ────────────────────────────────────────

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

/**
 * Pass 1: node identity. Builds the `byId` index (used by later passes) and
 * flags missing ids, duplicate ids, and non-finite / negative fractions.
 */
function validateNodeIdentity(
  nodes: CalcNode[],
  byId: Map<string, CalcNode>,
  issues: ValidationIssue[]
): void {
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
}

/** Pass 2: parent links. Flags missing parents and self-parent cycles. */
function validateParentLinks(
  nodes: CalcNode[],
  byId: Map<string, CalcNode>,
  issues: ValidationIssue[]
): void {
  for (const node of nodes) {
    if (!node.id || node.parentId == null || node.parentId === 'unlinked') continue;
    if (!byId.has(node.parentId)) {
      issues.push({ code: 'missing_parent', nodeId: node.id, message: `Missing parent ${node.parentId} for ${node.id}` });
    }
    if (node.parentId === node.id) {
      issues.push({ code: 'self_parent', nodeId: node.id, message: `Self-parent cycle at ${node.id}` });
    }
  }
}

/** Pass 3: cycle detection by walking each node's ancestry. */
function validateCycles(
  nodes: CalcNode[],
  byId: Map<string, CalcNode>,
  issues: ValidationIssue[]
): void {
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
}

/**
 * Pass 4: branch allocation invariant. For each non-related node,
 * remaining + sum(allocating-child initialFractions) must equal initialFraction
 * within EPSILON; flags over- and under-allocated branches.
 */
function validateBranchAllocation(nodes: CalcNode[], issues: ValidationIssue[]): void {
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
          initial: emitNodeFraction(initial),
          remaining: emitNodeFraction(remaining),
          childInitialTotal: emitNodeFraction(childInitialTotal),
          allocated: emitNodeFraction(allocated),
        },
      });
    } else if (allocationDelta.lessThan(EPSILON.negated())) {
      issues.push({
        code: 'under_allocated_branch',
        nodeId: node.id,
        message: `Allocated branch interest is below initial grant at ${node.id}`,
        details: {
          initial: emitNodeFraction(initial),
          remaining: emitNodeFraction(remaining),
          childInitialTotal: emitNodeFraction(childInitialTotal),
          allocated: emitNodeFraction(allocated),
        },
      });
    }
  }
}

/** Pass 5: related (document/lease) nodes must carry zero ownership fractions. */
function validateRelatedNodes(nodes: CalcNode[], issues: ValidationIssue[]): void {
  for (const node of nodes) {
    if (node.type !== 'related') continue;
    if (!clamp(node.initialFraction).isZero() || !clamp(node.fraction).isZero()) {
      issues.push({
        code: 'related_node_with_fraction',
        nodeId: node.id,
        message: `Related node ${node.id} should not carry ownership fractions`,
        details: {
          initialFraction: emitNodeFraction(node.initialFraction),
          fraction: emitNodeFraction(node.fraction),
        },
      });
    }
  }
}

/**
 * Validate the ownership graph. Composes five named passes in a fixed order so
 * the returned issue array is identical to the historical single-function form.
 */
export function validateCalcGraph(nodes: CalcNode[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, CalcNode>();

  validateNodeIdentity(nodes, byId, issues);
  validateParentLinks(nodes, byId, issues);
  validateCycles(nodes, byId, issues);
  validateBranchAllocation(nodes, issues);
  validateRelatedNodes(nodes, issues);

  return { valid: issues.length === 0, issues };
}

// ── NPRI branch-burden discrepancies ────────────────────────

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
        totalBurden: emitNodeFraction(totals.fixedWholeTractTotal),
        capacity: emitNodeFraction(branchCapacity),
        excess: emitNodeFraction(totals.fixedWholeTractTotal.minus(branchCapacity)),
      });
    }

    if (totals.fixedBranchTotal.greaterThan(new Decimal(1).plus(EPSILON))) {
      discrepancies.push({
        kind: 'fixed_branch_over_branch',
        burdenedBranchNodeId,
        npriNodeIds: totals.fixedBranchNodeIds,
        totalBurden: emitNodeFraction(totals.fixedBranchTotal),
        capacity: '1',
        excess: emitNodeFraction(totals.fixedBranchTotal.minus(1)),
      });
    }

    if (totals.floatingTotal.greaterThan(new Decimal(1).plus(EPSILON))) {
      discrepancies.push({
        kind: 'floating_over_royalty',
        burdenedBranchNodeId,
        npriNodeIds: totals.floatingNodeIds,
        totalBurden: emitNodeFraction(totals.floatingTotal),
        capacity: '1',
        excess: emitNodeFraction(totals.floatingTotal.minus(1)),
      });
    }
  });

  return discrepancies;
}
