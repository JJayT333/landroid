/**
 * Phase 4 title cutover — MathInputView parity gate (SHADOW).
 *
 * The migration strategy (docs/project-record-migration-strategy.md) makes
 * MathInputView parity a REQUIRED gate before any cutover claim: the math must be
 * identical whether its node set comes from the live store or from the action
 * layer. This module reconstructs the node set from the durable title records,
 * rebuilds MathInputView, and asserts it equals the live store's MathInputView
 * (and, in tests, the Phase 0 goldens). Any divergence is a bug (guardrail 3).
 *
 * Scope: only the title node set is action-derived. Desk maps, leasehold unit,
 * and leasehold assignments/orris are NOT a Phase 4 title surface, so they are
 * taken from the live workspace unchanged — the gate isolates "do the
 * action-derived nodes drive the same math as the live nodes."
 */
import type { BackendSpineCoreRecord } from '../../backend-spine/contracts';
import type { OwnerWorkspaceData } from '../../storage/owner-persistence';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import { buildMathInputView, type MathInputView } from '../projections';
import { canonicalJson } from './canonical-json';
import { orderNodesLike, reconstructTitleNodes } from './title-replay';

type OwnerSlice = Pick<OwnerWorkspaceData, 'owners' | 'leases'>;

export interface TitleMathParityInput {
  /** The live workspace (source of desk maps + leasehold + node order). */
  liveWorkspace: WorkspaceData;
  /** Durable records carrying the title ActionRecords to reconstruct nodes from. */
  records: readonly BackendSpineCoreRecord[];
  ownerData?: OwnerSlice;
  generatedAt: string;
  projectId?: string;
}

export interface TitleMathParityResult {
  clean: boolean;
  /** Differing top-level MathInputView keys, for diagnostics. */
  divergentKeys: string[];
  liveView: MathInputView;
  actionView: MathInputView;
}

/** The MathInputView a workspace with the action-derived node set would produce. */
export function buildActionDerivedMathInputView(
  input: TitleMathParityInput
): MathInputView {
  const reconstructed = orderNodesLike(
    reconstructTitleNodes(input.records),
    input.liveWorkspace.nodes.map((node) => node.id)
  );
  return buildMathInputView({
    workspace: { ...input.liveWorkspace, nodes: reconstructed },
    ownerData: input.ownerData,
    projectId: input.projectId,
    generatedAt: input.generatedAt,
  });
}

/** Compute live vs action-derived MathInputView and diff them key by key. */
export function runTitleMathParity(input: TitleMathParityInput): TitleMathParityResult {
  const liveView = buildMathInputView({
    workspace: input.liveWorkspace,
    ownerData: input.ownerData,
    projectId: input.projectId,
    generatedAt: input.generatedAt,
  });
  const actionView = buildActionDerivedMathInputView(input);

  const divergentKeys: string[] = [];
  const keys = new Set([
    ...Object.keys(liveView),
    ...Object.keys(actionView),
  ]) as Set<keyof MathInputView>;
  for (const key of keys) {
    if (canonicalJson(liveView[key]) !== canonicalJson(actionView[key])) {
      divergentKeys.push(key);
    }
  }

  return {
    clean: divergentKeys.length === 0,
    divergentKeys,
    liveView,
    actionView,
  };
}

export class TitleMathParityError extends Error {
  constructor(readonly result: TitleMathParityResult) {
    super(
      'Title MathInputView parity diverges (a bug; resolve before cutover). ' +
        `Divergent keys: ${result.divergentKeys.join(', ') || '(none)'}.`
    );
    this.name = 'TitleMathParityError';
  }
}

/**
 * Throw unless the action-derived MathInputView equals the live one. No flip is
 * proposable until this is green (migration-strategy required gate).
 */
export function assertTitleMathParity(
  input: TitleMathParityInput
): TitleMathParityResult {
  const result = runTitleMathParity(input);
  if (!result.clean) throw new TitleMathParityError(result);
  return result;
}
