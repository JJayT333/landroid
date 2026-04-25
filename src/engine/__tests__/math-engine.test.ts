/**
 * Math Engine test suite.
 *
 * Verifies all four operations with exact 9-decimal Decimal.js precision.
 * The critical test: a 100% interest rebalanced to 0.5 rippling through
 * three generations of heirs.
 */
import { describe, it, expect } from 'vitest';
import { d } from '../decimal';
import { formatAsFraction } from '../fraction-display';
import {
  executeConveyance,
  executeCreateNpri,
  executeCreateRootNode,
  executeRebalance,
  executePredecessorInsert,
  executeAttachConveyance,
  executeDeleteBranch,
  calculateShare,
  findNpriBranchDiscrepancies,
  validateOwnershipGraph,
  rootOwnershipTotal,
} from '../math-engine';
import { createBlankNode } from '../../types/node';
import type { OwnershipNode } from '../../types/node';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, parentId: string | null, initial: string, fraction: string): OwnershipNode {
  return {
    ...createBlankNode(id, parentId),
    initialFraction: initial,
    fraction,
  };
}

function findNode(nodes: OwnershipNode[], id: string): OwnershipNode {
  const n = nodes.find((n) => n.id === id);
  if (!n) throw new Error(`Node ${id} not found`);
  return n;
}

// ---------------------------------------------------------------------------
// calculateShare
// ---------------------------------------------------------------------------

describe('calculateShare', () => {
  it('fraction mode: 1/2 of initial=1.0 → 0.5', () => {
    const share = calculateShare({
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
      numerator: '1',
      denominator: '2',
      manualAmount: '0',
      parentFraction: '1.0',
      parentInitialFraction: '1.0',
    });
    expect(share.toFixed(9)).toBe('0.500000000');
  });

  it('fraction mode: 1/3 of initial=1.0 → 0.333333333', () => {
    const share = calculateShare({
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
      numerator: '1',
      denominator: '3',
      manualAmount: '0',
      parentFraction: '1.0',
      parentInitialFraction: '1.0',
    });
    expect(share.toFixed(9)).toBe('0.333333333');
  });

  it('fraction mode with remaining basis', () => {
    const share = calculateShare({
      conveyanceMode: 'fraction',
      splitBasis: 'remaining',
      numerator: '1',
      denominator: '2',
      manualAmount: '0',
      parentFraction: '0.6',
      parentInitialFraction: '1.0',
    });
    expect(share.toFixed(9)).toBe('0.300000000');
  });

  it('fraction mode with whole basis (1/4 of 1.0)', () => {
    const share = calculateShare({
      conveyanceMode: 'fraction',
      splitBasis: 'whole',
      numerator: '1',
      denominator: '4',
      manualAmount: '0',
      parentFraction: '0.5',
      parentInitialFraction: '0.5',
    });
    expect(share.toFixed(9)).toBe('0.250000000');
  });

  it('fixed mode', () => {
    const share = calculateShare({
      conveyanceMode: 'fixed',
      splitBasis: 'initial',
      numerator: '0',
      denominator: '1',
      manualAmount: '0.123456789',
      parentFraction: '1.0',
      parentInitialFraction: '1.0',
    });
    expect(share.toFixed(9)).toBe('0.123456789');
  });

  it('all mode returns entire remaining fraction', () => {
    const share = calculateShare({
      conveyanceMode: 'all',
      splitBasis: 'initial',
      numerator: '0',
      denominator: '1',
      manualAmount: '0',
      parentFraction: '0.750000000',
      parentInitialFraction: '1.0',
    });
    expect(share.toFixed(9)).toBe('0.750000000');
  });

  it('caps at parent remaining when share would exceed', () => {
    const share = calculateShare({
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
      numerator: '3',
      denominator: '4',
      manualAmount: '0',
      parentFraction: '0.5',
      parentInitialFraction: '1.0',
    });
    // 3/4 of 1.0 = 0.75, but parent only has 0.5 remaining → capped to 0.5
    expect(share.toFixed(9)).toBe('0.500000000');
  });

  it('zero denominator → 0', () => {
    const share = calculateShare({
      conveyanceMode: 'fraction',
      splitBasis: 'initial',
      numerator: '1',
      denominator: '0',
      manualAmount: '0',
      parentFraction: '1.0',
      parentInitialFraction: '1.0',
    });
    expect(share.toFixed(9)).toBe('0.000000000');
  });
});

// ---------------------------------------------------------------------------
// executeConveyance
// ---------------------------------------------------------------------------

describe('executeConveyance', () => {
  it('basic conveyance: split 0.5 from root', () => {
    const root = makeNode('root', null, '1.000000000', '1.000000000');
    const result = executeConveyance({
      allNodes: [root],
      parentId: 'root',
      newNodeId: 'child1',
      share: '0.5',
      form: { ...createBlankNode('child1', 'root'), grantee: 'Heir A' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const parent = findNode(result.data, 'root');
    const child = findNode(result.data, 'child1');

    expect(parent.fraction).toBe('0.500000000');
    expect(parent.initialFraction).toBe('1.000000000');
    expect(child.fraction).toBe('0.500000000');
    expect(child.initialFraction).toBe('0.500000000');
    expect(child.parentId).toBe('root');
    expect(result.audit.action).toBe('convey');
    expect(result.audit.affectedCount).toBe(2);
  });

  it('rejects share exceeding parent fraction', () => {
    const root = makeNode('root', null, '1.000000000', '0.300000000');
    const result = executeConveyance({
      allNodes: [root],
      parentId: 'root',
      newNodeId: 'child1',
      share: '0.5',
      form: createBlankNode('child1', 'root'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_input');
  });

  it('rejects duplicate newNodeId', () => {
    const root = makeNode('root', null, '1.000000000', '1.000000000');
    const result = executeConveyance({
      allNodes: [root],
      parentId: 'root',
      newNodeId: 'root',
      share: '0.5',
      form: createBlankNode('root', 'root'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflicting_structure');
  });

  it('convey 1/3 preserves 9-decimal precision', () => {
    const root = makeNode('root', null, '1.000000000', '1.000000000');
    const result = executeConveyance({
      allNodes: [root],
      parentId: 'root',
      newNodeId: 'child1',
      share: '0.333333333',
      form: createBlankNode('child1', 'root'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findNode(result.data, 'root').fraction).toBe('0.666666667');
    expect(findNode(result.data, 'child1').fraction).toBe('0.333333333');
  });

  it('rejects zero or invalid share values', () => {
    const root = makeNode('root', null, '1.000000000', '1.000000000');

    const zeroShare = executeConveyance({
      allNodes: [root],
      parentId: 'root',
      newNodeId: 'child-zero',
      share: '0',
      form: createBlankNode('child-zero', 'root'),
    });
    expect(zeroShare.ok).toBe(false);

    const invalidShare = executeConveyance({
      allNodes: [root],
      parentId: 'root',
      newNodeId: 'child-invalid',
      share: 'not-a-number',
      form: createBlankNode('child-invalid', 'root'),
    });
    expect(invalidShare.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// executeRebalance — THE CRITICAL CASCADE TEST
// ---------------------------------------------------------------------------

describe('executeRebalance', () => {
  it('THREE-GENERATION CASCADE: root 1.0 → 0.5 ripples through all descendants', () => {
    // Setup: Root with 100% interest, partially conveyed
    //   Root: initial=1.0, fraction=0.5 (conveyed 0.5 total)
    //   ├── Child A: initial=0.25, fraction=0.125 (conveyed 0.125 total)
    //   │   ├── Grandchild A1: initial=0.0625, fraction=0.0625
    //   │   └── Grandchild A2: initial=0.0625, fraction=0.0625
    //   └── Child B: initial=0.25, fraction=0.25
    const nodes: OwnershipNode[] = [
      makeNode('root', null, '1.000000000', '0.500000000'),
      makeNode('childA', 'root', '0.250000000', '0.125000000'),
      makeNode('grandA1', 'childA', '0.062500000', '0.062500000'),
      makeNode('grandA2', 'childA', '0.062500000', '0.062500000'),
      makeNode('childB', 'root', '0.250000000', '0.250000000'),
    ];

    // Rebalance root from 1.0 → 0.5
    const result = executeRebalance({
      allNodes: nodes,
      nodeId: 'root',
      newInitialFraction: '0.500000000',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      console.error('Rebalance failed:', result.error);
      return;
    }

    const data = result.data;

    // Root: initial=0.5, fraction=0.25 (scaled by 0.5)
    const root = findNode(data, 'root');
    expect(root.initialFraction).toBe('0.500000000');
    expect(root.fraction).toBe('0.250000000');

    // Child A: initial=0.125, fraction=0.0625 (scaled by 0.5)
    const childA = findNode(data, 'childA');
    expect(childA.initialFraction).toBe('0.125000000');
    expect(childA.fraction).toBe('0.062500000');

    // Grandchild A1: initial=0.03125, fraction=0.03125 (scaled by 0.5)
    const grandA1 = findNode(data, 'grandA1');
    expect(grandA1.initialFraction).toBe('0.031250000');
    expect(grandA1.fraction).toBe('0.031250000');

    // Grandchild A2: initial=0.03125, fraction=0.03125 (scaled by 0.5)
    const grandA2 = findNode(data, 'grandA2');
    expect(grandA2.initialFraction).toBe('0.031250000');
    expect(grandA2.fraction).toBe('0.031250000');

    // Child B: initial=0.125, fraction=0.125 (scaled by 0.5)
    const childB = findNode(data, 'childB');
    expect(childB.initialFraction).toBe('0.125000000');
    expect(childB.fraction).toBe('0.125000000');

    // Audit
    expect(result.audit.action).toBe('rebalance');
    expect(result.audit.affectedCount).toBe(5); // root + 2 children + 2 grandchildren
  });

  it('rebalance with parent gets fraction returned', () => {
    const nodes: OwnershipNode[] = [
      makeNode('grandparent', null, '1.000000000', '0.500000000'),
      makeNode('parent', 'grandparent', '0.500000000', '0.300000000'),
      makeNode('child', 'parent', '0.200000000', '0.200000000'),
    ];

    const result = executeRebalance({
      allNodes: nodes,
      nodeId: 'parent',
      newInitialFraction: '0.250000000',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Grandparent gets fraction back: 0.5 + (0.5 - 0.25) = 0.75
    const gp = findNode(result.data, 'grandparent');
    expect(gp.fraction).toBe('0.750000000');

    // Parent scaled: initial=0.25, fraction= 0.3 * (0.25/0.5) = 0.15
    const parent = findNode(result.data, 'parent');
    expect(parent.initialFraction).toBe('0.250000000');
    expect(parent.fraction).toBe('0.150000000');

    // Child scaled: initial= 0.2 * 0.5 = 0.1, fraction= 0.2 * 0.5 = 0.1
    const child = findNode(result.data, 'child');
    expect(child.initialFraction).toBe('0.100000000');
    expect(child.fraction).toBe('0.100000000');
  });

  it('rejects rebalance on zero-initial node', () => {
    const nodes = [makeNode('n1', null, '0.000000000', '0.000000000')];
    const result = executeRebalance({
      allNodes: nodes,
      nodeId: 'n1',
      newInitialFraction: '0.5',
    });
    expect(result.ok).toBe(false);
  });

  it('cascade preserves graph validity after rebalance', () => {
    const nodes: OwnershipNode[] = [
      makeNode('root', null, '1.000000000', '0.500000000'),
      makeNode('a', 'root', '0.250000000', '0.125000000'),
      makeNode('a1', 'a', '0.062500000', '0.062500000'),
      makeNode('a2', 'a', '0.062500000', '0.062500000'),
      makeNode('b', 'root', '0.250000000', '0.250000000'),
    ];

    const result = executeRebalance({
      allNodes: nodes,
      nodeId: 'root',
      newInitialFraction: '0.500000000',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const validation = validateOwnershipGraph(result.data);
    expect(validation.valid).toBe(true);
  });

  it('rejects zero or invalid new initial fractions', () => {
    const nodes: OwnershipNode[] = [makeNode('root', null, '1.000000000', '1.000000000')];

    const zeroInitial = executeRebalance({
      allNodes: nodes,
      nodeId: 'root',
      newInitialFraction: '0',
    });
    expect(zeroInitial.ok).toBe(false);

    const invalidInitial = executeRebalance({
      allNodes: nodes,
      nodeId: 'root',
      newInitialFraction: 'not-a-number',
    });
    expect(invalidInitial.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// executePredecessorInsert
// ---------------------------------------------------------------------------

describe('executePredecessorInsert', () => {
  it('inserts predecessor between parent and child', () => {
    const nodes: OwnershipNode[] = [
      makeNode('root', null, '1.000000000', '0.500000000'),
      makeNode('child', 'root', '0.500000000', '0.500000000'),
    ];

    const result = executePredecessorInsert({
      allNodes: nodes,
      activeNodeId: 'child',
      activeNodeParentId: 'root',
      newPredecessorId: 'pred1',
      newInitialFraction: '0.250000000',
      form: { ...createBlankNode('pred1', 'root'), grantee: 'Predecessor Entity' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pred = findNode(result.data, 'pred1');
    expect(pred.parentId).toBe('root');
    expect(pred.initialFraction).toBe('0.250000000');
    expect(pred.fraction).toBe('0.000000000'); // predecessor's remaining is zero (all goes to child)

    const child = findNode(result.data, 'child');
    expect(child.parentId).toBe('pred1');
    // Child scaled: 0.5 * (0.25/0.5) = 0.25
    expect(child.initialFraction).toBe('0.250000000');
    expect(child.fraction).toBe('0.250000000');

    // Root gets fraction back: 0.5 + (0.5 - 0.25) = 0.75
    const root = findNode(result.data, 'root');
    expect(root.fraction).toBe('0.750000000');

    const validation = validateOwnershipGraph(result.data);
    expect(validation.valid).toBe(true);
  });

  it('rejects self-predecessor', () => {
    const nodes = [makeNode('n1', null, '1.000000000', '1.000000000')];
    const result = executePredecessorInsert({
      allNodes: nodes,
      activeNodeId: 'n1',
      activeNodeParentId: null,
      newPredecessorId: 'n1',
      newInitialFraction: '0.5',
      form: createBlankNode('n1'),
    });
    expect(result.ok).toBe(false);
  });

  it('supports predecessor insert on a root node', () => {
    const nodes = [makeNode('root', null, '1.000000000', '1.000000000')];
    const result = executePredecessorInsert({
      allNodes: nodes,
      activeNodeId: 'root',
      activeNodeParentId: null,
      newPredecessorId: 'pred-root',
      newInitialFraction: '0.500000000',
      form: { ...createBlankNode('pred-root', null), grantee: 'Earlier Owner' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(findNode(result.data, 'pred-root').parentId).toBeNull();
    expect(findNode(result.data, 'pred-root').initialFraction).toBe('0.500000000');
    expect(findNode(result.data, 'pred-root').fraction).toBe('0.000000000');
    expect(findNode(result.data, 'root').parentId).toBe('pred-root');
    expect(findNode(result.data, 'root').initialFraction).toBe('0.500000000');
    expect(validateOwnershipGraph(result.data).valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// executeAttachConveyance
// ---------------------------------------------------------------------------

describe('executeAttachConveyance', () => {
  it('moves subtree to new parent with correct scaling', () => {
    const nodes: OwnershipNode[] = [
      makeNode('root1', null, '1.000000000', '0.500000000'),
      makeNode('child1', 'root1', '0.500000000', '0.500000000'),
      makeNode('root2', null, '1.000000000', '1.000000000'),
    ];

    const result = executeAttachConveyance({
      allNodes: nodes,
      activeNodeId: 'child1',
      attachParentId: 'root2',
      calcShare: '0.250000000',
      form: createBlankNode('child1', 'root2'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const child = findNode(result.data, 'child1');
    expect(child.parentId).toBe('root2');
    expect(child.initialFraction).toBe('0.250000000');
    // fraction scaled: 0.5 * (0.25/0.5) = 0.25
    expect(child.fraction).toBe('0.250000000');

    // root2 reduced by share
    const root2 = findNode(result.data, 'root2');
    expect(root2.fraction).toBe('0.750000000');

    // root1 refunded when child branch leaves
    const root1 = findNode(result.data, 'root1');
    expect(root1.fraction).toBe('1.000000000');

    const validation = validateOwnershipGraph(result.data);
    expect(validation.valid).toBe(true);
  });

  it('rejects self-attachment', () => {
    const nodes = [makeNode('n1', null, '1.000000000', '1.000000000')];
    const result = executeAttachConveyance({
      allNodes: nodes,
      activeNodeId: 'n1',
      attachParentId: 'n1',
      calcShare: '0.5',
      form: createBlankNode('n1'),
    });
    expect(result.ok).toBe(false);
  });

  it('rejects attachment to own descendant', () => {
    const nodes: OwnershipNode[] = [
      makeNode('parent', null, '1.000000000', '0.500000000'),
      makeNode('child', 'parent', '0.500000000', '0.500000000'),
    ];
    const result = executeAttachConveyance({
      allNodes: nodes,
      activeNodeId: 'parent',
      attachParentId: 'child',
      calcShare: '0.25',
      form: createBlankNode('parent'),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflicting_structure');
  });

  it('scales entire subtree on attach', () => {
    const nodes: OwnershipNode[] = [
      makeNode('src', null, '1.000000000', '0.500000000'),
      makeNode('srcChild', 'src', '0.500000000', '0.250000000'),
      makeNode('srcGrand', 'srcChild', '0.250000000', '0.250000000'),
      makeNode('dest', null, '1.000000000', '1.000000000'),
    ];

    const result = executeAttachConveyance({
      allNodes: nodes,
      activeNodeId: 'src',
      attachParentId: 'dest',
      calcShare: '0.500000000',
      form: createBlankNode('src', 'dest'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Scale factor = 0.5 / 1.0 = 0.5
    const src = findNode(result.data, 'src');
    expect(src.initialFraction).toBe('0.500000000');
    expect(src.fraction).toBe('0.250000000'); // 0.5 * 0.5

    const srcChild = findNode(result.data, 'srcChild');
    expect(srcChild.initialFraction).toBe('0.250000000'); // 0.5 * 0.5
    expect(srcChild.fraction).toBe('0.125000000'); // 0.25 * 0.5

    const srcGrand = findNode(result.data, 'srcGrand');
    expect(srcGrand.initialFraction).toBe('0.125000000'); // 0.25 * 0.5
    expect(srcGrand.fraction).toBe('0.125000000'); // 0.25 * 0.5

    const validation = validateOwnershipGraph(result.data);
    expect(validation.valid).toBe(true);
  });

  it('rejects zero-share and related-node attachments', () => {
    const owner = makeNode('owner', null, '1.000000000', '1.000000000');
    const child = makeNode('child', 'owner', '0.500000000', '0.500000000');
    const destination = makeNode('dest', null, '1.000000000', '1.000000000');
    const leaseNode: OwnershipNode = {
      ...createBlankNode('lease-node', 'owner'),
      type: 'related',
      relatedKind: 'lease',
      linkedLeaseId: 'lease-1',
    };

    const zeroShare = executeAttachConveyance({
      allNodes: [owner, child, destination],
      activeNodeId: 'child',
      attachParentId: 'dest',
      calcShare: '0',
      form: createBlankNode('child', 'dest'),
    });
    expect(zeroShare.ok).toBe(false);

    const relatedAttach = executeAttachConveyance({
      allNodes: [owner, child, destination, leaseNode],
      activeNodeId: 'child',
      attachParentId: 'lease-node',
      calcShare: '0.250000000',
      form: createBlankNode('child', 'lease-node'),
    });
    expect(relatedAttach.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateOwnershipGraph
// ---------------------------------------------------------------------------

describe('validateOwnershipGraph', () => {
  it('valid tree passes', () => {
    const nodes: OwnershipNode[] = [
      makeNode('root', null, '1.000000000', '0.500000000'),
      makeNode('child', 'root', '0.500000000', '0.500000000'),
    ];
    const result = validateOwnershipGraph(nodes);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects over-allocation', () => {
    const nodes: OwnershipNode[] = [
      makeNode('root', null, '1.000000000', '0.600000000'),
      makeNode('child', 'root', '0.600000000', '0.600000000'),
    ];
    // root: initial=1.0, remaining=0.6, childInitial=0.6, allocated=1.2 > 1.0
    const result = validateOwnershipGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'over_allocated_branch')).toBe(true);
  });

  it('detects under-allocation', () => {
    const nodes: OwnershipNode[] = [
      makeNode('root', null, '1.000000000', '0.500000000'),
      makeNode('child', 'root', '0.250000000', '0.250000000'),
    ];
    const result = validateOwnershipGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'under_allocated_branch')).toBe(true);
  });

  it('detects missing parent', () => {
    const nodes = [makeNode('orphan', 'nonexistent', '0.5', '0.5')];
    const result = validateOwnershipGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'missing_parent')).toBe(true);
  });

  it('detects self-parent cycle', () => {
    const nodes = [makeNode('loop', 'loop', '0.5', '0.5')];
    const result = validateOwnershipGraph(nodes);
    expect(result.valid).toBe(false);
  });

  it('detects duplicate ids', () => {
    const nodes = [
      makeNode('dup', null, '0.5', '0.5'),
      makeNode('dup', null, '0.5', '0.5'),
    ];
    const result = validateOwnershipGraph(nodes);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate_id')).toBe(true);
  });

  it('detects related nodes carrying ownership fractions', () => {
    const nodes: OwnershipNode[] = [
      {
        ...createBlankNode('lease-node', 'root'),
        type: 'related',
        relatedKind: 'lease',
        initialFraction: '0.250000000',
        fraction: '0.250000000',
      },
    ];

    const result = validateOwnershipGraph(nodes);
    expect(result.valid).toBe(false);
    expect(
      result.issues.some((issue) => issue.code === 'related_node_with_fraction')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rootOwnershipTotal
// ---------------------------------------------------------------------------

describe('rootOwnershipTotal', () => {
  it('sums root node fractions', () => {
    const nodes: OwnershipNode[] = [
      makeNode('root1', null, '0.500000000', '0.500000000'),
      makeNode('root2', null, '0.500000000', '0.500000000'),
      makeNode('child', 'root1', '0.250000000', '0.250000000'),
    ];
    // Only root1 (0.5) + root2 (0.5) = 1.0 — child is not a root
    const total = rootOwnershipTotal(nodes);
    expect(total.toFixed(9)).toBe('1.000000000');
  });
});

// ---------------------------------------------------------------------------
// Real-world title scenario
// ---------------------------------------------------------------------------

describe('Real-world title scenario', () => {
  it('New Mexico mineral deed chain: patent → multiple conveyances → heir rebalance', () => {
    // Federal Patent grants 100% mineral interest
    const nodes: OwnershipNode[] = [
      makeNode('patent', null, '1.000000000', '1.000000000'),
    ];

    // Step 1: Patent holder conveys 1/2 to Heir A
    const step1 = executeConveyance({
      allNodes: nodes,
      parentId: 'patent',
      newNodeId: 'heirA',
      share: '0.500000000',
      form: { ...createBlankNode('heirA', 'patent'), instrument: 'Mineral Deed', grantee: 'Heir A' },
    });
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;

    // Step 2: Patent holder conveys 1/4 to Heir B
    const step2 = executeConveyance({
      allNodes: step1.data,
      parentId: 'patent',
      newNodeId: 'heirB',
      share: '0.250000000',
      form: { ...createBlankNode('heirB', 'patent'), instrument: 'Mineral Deed', grantee: 'Heir B' },
    });
    expect(step2.ok).toBe(true);
    if (!step2.ok) return;

    // Patent now has 0.25 remaining
    expect(findNode(step2.data, 'patent').fraction).toBe('0.250000000');

    // Step 3: Heir A conveys 1/4 of their 0.5 to Grandchild
    const step3 = executeConveyance({
      allNodes: step2.data,
      parentId: 'heirA',
      newNodeId: 'grandchild',
      share: '0.125000000',
      form: { ...createBlankNode('grandchild', 'heirA'), instrument: 'Warranty Deed', grantee: 'Grandchild' },
    });
    expect(step3.ok).toBe(true);
    if (!step3.ok) return;

    // Heir A: initial=0.5, fraction= 0.5 - 0.125 = 0.375
    expect(findNode(step3.data, 'heirA').fraction).toBe('0.375000000');
    expect(findNode(step3.data, 'grandchild').fraction).toBe('0.125000000');

    // Step 4: Rebalance — title curative discovers patent was actually only 2/3 interest
    const step4 = executeRebalance({
      allNodes: step3.data,
      nodeId: 'patent',
      newInitialFraction: '0.666666667',
    });
    expect(step4.ok).toBe(true);
    if (!step4.ok) return;

    // scaleFactor = 0.666666667 / 1.0 = 0.666666667
    const sf = d('0.666666667');

    const patent = findNode(step4.data, 'patent');
    expect(patent.initialFraction).toBe('0.666666667');
    // fraction: 0.25 * 0.666666667 = 0.166666667 (rounded)
    expect(d(patent.fraction).toFixed(9)).toBe(d('0.25').mul(sf).toFixed(9));

    const heirA = findNode(step4.data, 'heirA');
    // initial: 0.5 * 0.666666667 = 0.333333334
    expect(d(heirA.initialFraction).toFixed(9)).toBe(d('0.5').mul(sf).toFixed(9));

    const grandchild = findNode(step4.data, 'grandchild');
    // initial: 0.125 * 0.666666667 = 0.083333333
    expect(d(grandchild.initialFraction).toFixed(9)).toBe(d('0.125').mul(sf).toFixed(9));

    const heirB = findNode(step4.data, 'heirB');
    // initial: 0.25 * 0.666666667 = 0.166666667
    expect(d(heirB.initialFraction).toFixed(9)).toBe(d('0.25').mul(sf).toFixed(9));

    // Validate the whole graph
    const validation = validateOwnershipGraph(step4.data);
    expect(validation.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// User's exact scenario: Grant/Remaining display through the tree
// ---------------------------------------------------------------------------

describe('User scenario: grant + remaining through tree', () => {
  it('Root 100% → A gets 1/2, B gets 1/2 → A splits to C,D at 1/4 each → B splits to E,F,G,H at 1/8 each', () => {
    // Original Grantor: 100%
    let nodes: OwnershipNode[] = [
      makeNode('grantor', null, '1.000000000', '1.000000000'),
    ];

    // Grantor conveys 1/2 to Person A
    const s1 = executeConveyance({
      allNodes: nodes,
      parentId: 'grantor', newNodeId: 'personA', share: '0.500000000',
      form: { ...createBlankNode('personA', 'grantor'), grantee: 'Person A' },
    });
    expect(s1.ok).toBe(true);
    if (!s1.ok) return;

    // Grantor conveys 1/2 to Person B
    const s2 = executeConveyance({
      allNodes: s1.data,
      parentId: 'grantor', newNodeId: 'personB', share: '0.500000000',
      form: { ...createBlankNode('personB', 'grantor'), grantee: 'Person B' },
    });
    expect(s2.ok).toBe(true);
    if (!s2.ok) return;

    // Check: Grantor granted 1.0, remaining 0.0
    const grantor2 = findNode(s2.data, 'grantor');
    expect(grantor2.initialFraction).toBe('1.000000000');  // Granted: 1/1
    expect(grantor2.fraction).toBe('0.000000000');          // Remaining: 0

    // Person A conveys 1/2 of their 0.5 (= 0.25) to Person C
    const s3 = executeConveyance({
      allNodes: s2.data,
      parentId: 'personA', newNodeId: 'personC', share: '0.250000000',
      form: { ...createBlankNode('personC', 'personA'), grantee: 'Person C' },
    });
    expect(s3.ok).toBe(true);
    if (!s3.ok) return;

    // Person A conveys remaining 0.25 to Person D
    const s4 = executeConveyance({
      allNodes: s3.data,
      parentId: 'personA', newNodeId: 'personD', share: '0.250000000',
      form: { ...createBlankNode('personD', 'personA'), grantee: 'Person D' },
    });
    expect(s4.ok).toBe(true);
    if (!s4.ok) return;

    // Person A: granted 0.5, remaining 0.0 (conveyed all)
    const personA = findNode(s4.data, 'personA');
    expect(personA.initialFraction).toBe('0.500000000');  // Granted: 1/2
    expect(personA.fraction).toBe('0.000000000');          // Remaining: 0

    // Person C: granted 0.25, remaining 0.25 (no children)
    const personC = findNode(s4.data, 'personC');
    expect(personC.initialFraction).toBe('0.250000000');  // Granted: 1/4
    expect(personC.fraction).toBe('0.250000000');          // Remaining: 1/4

    // Person D: granted 0.25, remaining 0.25
    const personD = findNode(s4.data, 'personD');
    expect(personD.initialFraction).toBe('0.250000000');
    expect(personD.fraction).toBe('0.250000000');

    // Person B conveys to 4 people: E, F, G, H — each gets 0.125 (1/8)
    let current = s4.data;
    for (const name of ['personE', 'personF', 'personG', 'personH']) {
      const result = executeConveyance({
        allNodes: current,
        parentId: 'personB', newNodeId: name, share: '0.125000000',
        form: { ...createBlankNode(name, 'personB'), grantee: name },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.data;
    }

    // Person B: granted 0.5, remaining 0.0 (conveyed all to 4 people)
    const personB = findNode(current, 'personB');
    expect(personB.initialFraction).toBe('0.500000000');  // Granted: 1/2
    expect(personB.fraction).toBe('0.000000000');          // Remaining: 0

    // Each of E,F,G,H: granted 0.125, remaining 0.125
    for (const name of ['personE', 'personF', 'personG', 'personH']) {
      const person = findNode(current, name);
      expect(person.initialFraction).toBe('0.125000000');  // Granted: 1/8
      expect(person.fraction).toBe('0.125000000');          // Remaining: 1/8
    }

    // Total interest across all leaf nodes should = 1.0
    const leafFractions = ['personC', 'personD', 'personE', 'personF', 'personG', 'personH']
      .map(id => d(findNode(current, id).fraction));
    const total = leafFractions.reduce((sum, f) => sum.plus(f), d('0'));
    expect(total.toFixed(9)).toBe('1.000000000');

    // Graph valid
    expect(validateOwnershipGraph(current).valid).toBe(true);
  });
});

describe('NPRI branch handling', () => {
  it('creates an NPRI branch without reducing the mineral parent', () => {
    const nodes: OwnershipNode[] = [
      makeNode('grantor', null, '1.000000000', '1.000000000'),
    ];

    const result = executeCreateNpri({
      allNodes: nodes,
      parentId: 'grantor',
      newNodeId: 'npri-1',
      share: '0.500000000',
      form: {
        ...createBlankNode('npri-1', 'grantor'),
        instrument: 'Royalty Deed',
        grantee: 'NPRI Holder',
        interestClass: 'npri',
        royaltyKind: 'floating',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(findNode(result.data, 'grantor').fraction).toBe('1.000000000');
    expect(findNode(result.data, 'npri-1')).toMatchObject({
      interestClass: 'npri',
      royaltyKind: 'floating',
      initialFraction: '0.500000000',
      fraction: '0.500000000',
    });
    expect(rootOwnershipTotal(result.data).toFixed(9)).toBe('1.000000000');
    expect(validateOwnershipGraph(result.data).valid).toBe(true);
  });

  it('allows but reports a fixed whole-tract NPRI that exceeds the burdened branch share', () => {
    const nodes: OwnershipNode[] = [
      makeNode('grantor', null, '0.125000000', '0.125000000'),
    ];

    const result = executeCreateNpri({
      allNodes: nodes,
      parentId: 'grantor',
      newNodeId: 'npri-1',
      share: '0.250000000',
      form: {
        ...createBlankNode('npri-1', 'grantor'),
        instrument: 'Royalty Deed',
        grantee: 'NPRI Holder',
        interestClass: 'npri',
        royaltyKind: 'fixed',
        fixedRoyaltyBasis: 'whole_tract',
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(validateOwnershipGraph(result.data).valid).toBe(true);
    expect(findNpriBranchDiscrepancies(result.data)).toEqual([
      {
        kind: 'fixed_whole_tract_over_branch',
        burdenedBranchNodeId: 'grantor',
        npriNodeIds: ['npri-1'],
        totalBurden: '0.250000000',
        capacity: '0.125000000',
        excess: '0.125000000',
      },
    ]);
  });

  it('keeps NPRI branches out of mineral rebalances and delete restores', () => {
    const nodes: OwnershipNode[] = [
      makeNode('grantor', null, '1.000000000', '0.500000000'),
      {
        ...createBlankNode('mineral-child', 'grantor'),
        grantee: 'Mineral Child',
        initialFraction: '0.500000000',
        fraction: '0.500000000',
      },
      {
        ...createBlankNode('npri-1', 'grantor'),
        instrument: 'Royalty Deed',
        grantee: 'NPRI Holder',
        initialFraction: '0.500000000',
        fraction: '0.500000000',
        interestClass: 'npri',
        royaltyKind: 'floating',
      },
    ];

    const rebalance = executeRebalance({
      allNodes: nodes,
      nodeId: 'grantor',
      newInitialFraction: '0.750000000',
    });

    expect(rebalance.ok).toBe(true);
    if (!rebalance.ok) return;

    expect(findNode(rebalance.data, 'grantor').fraction).toBe('0.375000000');
    expect(findNode(rebalance.data, 'mineral-child').initialFraction).toBe('0.375000000');
    expect(findNode(rebalance.data, 'npri-1')).toMatchObject({
      initialFraction: '0.500000000',
      fraction: '0.500000000',
    });

    const deleteNpri = executeDeleteBranch({
      allNodes: rebalance.data,
      nodeId: 'npri-1',
    });

    expect(deleteNpri.ok).toBe(true);
    if (!deleteNpri.ok) return;

    expect(findNode(deleteNpri.data, 'grantor').fraction).toBe('0.375000000');
    expect(validateOwnershipGraph(deleteNpri.data).valid).toBe(true);
  });
});

describe('executeDeleteBranch', () => {
  it('restores a deleted conveyance amount to its parent', () => {
    const nodes: OwnershipNode[] = [
      makeNode('grantor', null, '1.000000000', '0.500000000'),
      makeNode('child', 'grantor', '0.500000000', '0.500000000'),
    ];

    const result = executeDeleteBranch({
      allNodes: nodes,
      nodeId: 'child',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    const grantor = findNode(result.data, 'grantor');
    expect(d(grantor.fraction).toString()).toBe('1');
    expect(result.audit.action).toBe('delete_branch');
    expect(result.audit.affectedCount).toBe(1);
  });

  it('removes an entire descendant branch and restores the original conveyed amount', () => {
    const nodes: OwnershipNode[] = [
      makeNode('grantor', null, '1.000000000', '0.500000000'),
      makeNode('child', 'grantor', '0.500000000', '0.250000000'),
      makeNode('grandchild', 'child', '0.250000000', '0.250000000'),
    ];

    const result = executeDeleteBranch({
      allNodes: nodes,
      nodeId: 'child',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.map((node) => node.id)).toEqual(['grantor']);
    expect(d(findNode(result.data, 'grantor').fraction).toString()).toBe('1');
    expect(result.audit.affectedCount).toBe(2);
  });
});

describe('executeCreateRootNode', () => {
  it('appends a mineral orphan tree on an empty workspace', () => {
    const result = executeCreateRootNode({
      allNodes: [],
      newNodeId: 'root-1',
      initialFraction: '0.25',
      form: { interestClass: 'mineral' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    const created = findNode(result.data, 'root-1');
    expect(created.parentId).toBeNull();
    expect(created.interestClass).toBe('mineral');
    expect(d(created.initialFraction).toString()).toBe('0.25');
    expect(d(created.fraction).toString()).toBe('0.25');
    expect(result.audit.action).toBe('create_root_node');
    expect(result.audit.affectedCount).toBe(1);
    expect(validateOwnershipGraph(result.data).valid).toBe(true);
  });

  it('creates a floating NPRI root with no fixed basis', () => {
    const result = executeCreateRootNode({
      allNodes: [],
      newNodeId: 'npri-root',
      initialFraction: '0.125',
      form: { interestClass: 'npri', royaltyKind: 'floating' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findNode(result.data, 'npri-root')).toMatchObject({
      interestClass: 'npri',
      royaltyKind: 'floating',
      fixedRoyaltyBasis: null,
    });
  });

  it('defaults fixedRoyaltyBasis to burdened_branch for a fixed NPRI', () => {
    const result = executeCreateRootNode({
      allNodes: [],
      newNodeId: 'npri-root',
      initialFraction: '0.0625',
      form: { interestClass: 'npri', royaltyKind: 'fixed' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(findNode(result.data, 'npri-root').fixedRoyaltyBasis).toBe('burdened_branch');
  });

  it('rejects a related/lease form', () => {
    const result = executeCreateRootNode({
      allNodes: [],
      newNodeId: 'lease-1',
      initialFraction: '1',
      form: { type: 'related', interestClass: 'mineral' },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_input');
  });

  it('rejects an initialFraction outside (0, 1]', () => {
    const zero = executeCreateRootNode({
      allNodes: [],
      newNodeId: 'root-1',
      initialFraction: '0',
      form: { interestClass: 'mineral' },
    });
    expect(zero.ok).toBe(false);

    const overOne = executeCreateRootNode({
      allNodes: [],
      newNodeId: 'root-2',
      initialFraction: '1.5',
      form: { interestClass: 'mineral' },
    });
    expect(overOne.ok).toBe(false);
  });

  it('rejects a duplicate id', () => {
    const result = executeCreateRootNode({
      allNodes: [makeNode('root-1', null, '0.5', '0.5')],
      newNodeId: 'root-1',
      initialFraction: '0.25',
      form: { interestClass: 'mineral' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('conflicting_structure');
  });

  it('lets a new orphan tree land despite pre-existing unrelated graph issues', () => {
    // A pre-existing node with fraction that already exceeds its initialFraction
    // — an invalid state. Creating an unrelated orphan should not be blocked.
    const brokenNode = makeNode('broken', null, '0.25', '0.9');
    const result = executeCreateRootNode({
      allNodes: [brokenNode],
      newNodeId: 'fresh-root',
      initialFraction: '0.5',
      form: { interestClass: 'mineral' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.find((n) => n.id === 'fresh-root')).toBeDefined();
    // the broken node is still present — we did not try to fix it, just allowed
    // a new orphan alongside it.
    expect(result.data.find((n) => n.id === 'broken')).toBeDefined();
  });
});

describe('high precision chained conveyances', () => {
  it('preserves exact binary fractions through repeated half conveyances', () => {
    let nodes: OwnershipNode[] = [
      makeNode('root', null, '1', '1'),
    ];

    const chain = [
      ['root', 'lease', '0.015625'],
      ['lease', 'assignment1', '0.0078125'],
      ['assignment1', 'assignment2', '0.00390625'],
      ['assignment2', 'assignment3', '0.001953125'],
      ['assignment3', 'assignment4', '0.0009765625'],
    ] as const;

    for (const [parentId, childId, share] of chain) {
      const result = executeConveyance({
        allNodes: nodes,
        parentId,
        newNodeId: childId,
        share,
        form: createBlankNode(childId, parentId),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      nodes = result.data;
    }

    const deepest = findNode(nodes, 'assignment4');
    expect(deepest.initialFraction).toBe('0.0009765625');
    expect(formatAsFraction(deepest.initialFraction)).toBe('1/1024');
    expect(validateOwnershipGraph(nodes).valid).toBe(true);
  });
});

describe('root mineral total invariant (audit H6)', () => {
  it('rejects a rebalance that would push root total above 1', () => {
    // Two roots each at 0.5 — legal, totals to 1.0. Rebalancing one to 0.75
    // would push the total to 1.25.
    const nodes = [
      { ...makeNode('root-a', null, '0.5', '0.5'), interestClass: 'mineral' as const },
      { ...makeNode('root-b', null, '0.5', '0.5'), interestClass: 'mineral' as const },
    ];
    const result = executeRebalance({
      allNodes: nodes,
      nodeId: 'root-a',
      newInitialFraction: '0.75',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_graph');
    expect(result.error.message).toMatch(/root mineral total/i);
  });

  it('rejects a predecessor insert that would push root total above 1', () => {
    // One root at 0.6. Inserting a predecessor at 0.75 moves the root up
    // (the new predecessor replaces root, totaling 0.75 — fine), but if we
    // had another root at 0.6, the combined total would be 1.35.
    const nodes = [
      { ...makeNode('root-a', null, '0.6', '0.6'), interestClass: 'mineral' as const },
      { ...makeNode('root-b', null, '0.6', '0.6'), interestClass: 'mineral' as const },
    ];
    const result = executePredecessorInsert({
      allNodes: nodes,
      activeNodeId: 'root-a',
      activeNodeParentId: null,
      newPredecessorId: 'pred-a',
      newInitialFraction: '0.9',
      form: { interestClass: 'mineral' },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_graph');
  });

  it('allows a rebalance that decreases a root total that was already over 1', () => {
    // Pre-existing over-100 state (1.5). Shrinking a root leaves the state
    // still over 1 but better than before — allowed.
    const nodes = [
      { ...makeNode('root-a', null, '0.9', '0.9'), interestClass: 'mineral' as const },
      { ...makeNode('root-b', null, '0.6', '0.6'), interestClass: 'mineral' as const },
    ];
    const result = executeRebalance({
      allNodes: nodes,
      nodeId: 'root-a',
      newInitialFraction: '0.5',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(rootOwnershipTotal(result.data).toFixed(9)).toBe('1.100000000');
  });

  it('allows rebalance that raises total but stays <= 1', () => {
    const nodes = [
      { ...makeNode('root-a', null, '0.25', '0.25'), interestClass: 'mineral' as const },
    ];
    const result = executeRebalance({
      allNodes: nodes,
      nodeId: 'root-a',
      newInitialFraction: '0.9',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(rootOwnershipTotal(result.data).toFixed(9)).toBe('0.900000000');
  });

  // executeAttachConveyance cannot structurally raise the root mineral total
  // (the moved node always becomes a child, never gains a root). The guard is
  // defensive parity with executeRebalance / executePredecessorInsert so a
  // future change cannot violate H6 silently. These cases pin the guard's
  // observable behaviour: a legal attach must still succeed, and an attach
  // that moves a root must not false-reject when the pre-existing total was
  // already over 1.
  it('attach succeeds when total stays <= 1 (guard does not block valid moves)', () => {
    const nodes: OwnershipNode[] = [
      { ...makeNode('root-a', null, '0.5', '0.5'), interestClass: 'mineral' as const },
      { ...makeNode('root-b', null, '0.5', '0.5'), interestClass: 'mineral' as const },
    ];
    const result = executeAttachConveyance({
      allNodes: nodes,
      activeNodeId: 'root-a',
      attachParentId: 'root-b',
      calcShare: '0.25',
      form: createBlankNode('root-a', 'root-b'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // root-a is no longer a root; only root-b contributes its remaining
    // fraction (0.5 − 0.25 = 0.25).
    expect(rootOwnershipTotal(result.data).toFixed(9)).toBe('0.250000000');
  });

  it('attach succeeds when pre-existing total > 1 and the move does not worsen it', () => {
    // Pre-existing over-100 state. Attaching root-a under root-b removes
    // root-a from the root set, so the new total is strictly lower.
    const nodes: OwnershipNode[] = [
      { ...makeNode('root-a', null, '0.9', '0.9'), interestClass: 'mineral' as const },
      { ...makeNode('root-b', null, '0.6', '0.6'), interestClass: 'mineral' as const },
    ];
    const result = executeAttachConveyance({
      allNodes: nodes,
      activeNodeId: 'root-a',
      attachParentId: 'root-b',
      calcShare: '0.4',
      form: createBlankNode('root-a', 'root-b'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // root-b is the only remaining root with fraction 0.6 − 0.4 = 0.2.
    expect(rootOwnershipTotal(result.data).toFixed(9)).toBe('0.200000000');
  });
});
