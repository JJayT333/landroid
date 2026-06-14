/**
 * CalcNode -- the internal Decimal-fraction representation the unified engine
 * computes over, and the boundary converters to/from the stored OwnershipNode.
 *
 * Ported faithfully from the v2 engine's internal CalcNode (math-engine.ts):
 * id/type/parentId/fraction/initialFraction are lifted out and every other
 * stored field is carried verbatim in `rest`, so a round-trip through
 * toCalc/fromCalc preserves all node data. Node-fraction emission goes through
 * the shared `emitNodeFraction` (= serialize), so output is byte-identical.
 */
import { Decimal } from 'decimal.js';

import { d } from '../../engine/decimal';
import type { InterestClass, OwnershipNode } from '../../types/node';
import { emitNodeFraction } from '../precision/emit';

export interface CalcNode {
  id: string;
  type: string;
  parentId: string | null;
  fraction: Decimal;
  initialFraction: Decimal;
  /** All other stored fields, carried through unchanged. */
  rest: Record<string, unknown>;
}

export function getCalcInterestClass(node: CalcNode): InterestClass {
  return (node.rest.interestClass as InterestClass | undefined) ?? 'mineral';
}

export function getCalcRoyaltyKind(node: CalcNode): OwnershipNode['royaltyKind'] {
  return (node.rest.royaltyKind as OwnershipNode['royaltyKind'] | undefined) ?? null;
}

export function getCalcFixedRoyaltyBasis(node: CalcNode): OwnershipNode['fixedRoyaltyBasis'] {
  return (
    (node.rest.fixedRoyaltyBasis as OwnershipNode['fixedRoyaltyBasis'] | undefined) ?? null
  );
}

/** A child only debits/credits its parent's residue within the same interest class. */
export function allocatesAgainstParent(parent: CalcNode, child: CalcNode): boolean {
  return getCalcInterestClass(parent) === getCalcInterestClass(child);
}

export function toCalc(node: OwnershipNode): CalcNode {
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

export function fromCalc(node: CalcNode): OwnershipNode {
  return {
    ...node.rest,
    id: node.id,
    type: node.type as OwnershipNode['type'],
    parentId: node.parentId,
    fraction: emitNodeFraction(node.fraction),
    initialFraction: emitNodeFraction(node.initialFraction),
  } as OwnershipNode;
}

/** The top-level CalcNode fields that must never leak into `rest`. */
const CALC_NODE_RESERVED_KEYS = [
  'fraction',
  'initialFraction',
  'id',
  'type',
  'parentId',
] as const;

/**
 * Build a CalcNode, stripping the reserved top-level fields out of `rest` so the
 * pass-through bag never shadows the structural fields. Collapses the five
 * repeated `delete newNode.rest.X` statements the ownership ops used to inline.
 */
export function makeCalcNode(params: {
  id: string;
  type: string;
  parentId: string | null;
  fraction: Decimal;
  initialFraction: Decimal;
  rest: Record<string, unknown>;
}): CalcNode {
  const rest = { ...params.rest };
  for (const key of CALC_NODE_RESERVED_KEYS) delete rest[key];
  return {
    id: params.id,
    type: params.type,
    parentId: params.parentId,
    fraction: params.fraction,
    initialFraction: params.initialFraction,
    rest,
  };
}
