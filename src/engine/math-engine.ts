/**
 * Compatibility shim.
 *
 * The ownership-graph math (the seven tree operations, share calculation, graph
 * validation, NPRI branch-discrepancy detection, and root totals) now lives in
 * the unified title-math engine under `src/title-math`. This module re-exports
 * the same public surface so existing consumers keep their import path.
 *
 * Implementation: src/title-math/calculators/ownership.ts and
 * src/title-math/model/graph-ops.ts. The old internal-only `collectDescendantIds`
 * export is intentionally dropped (it leaked the private CalcNode type and is
 * consumed nowhere).
 */
export {
  calculateShare,
  executeAttachConveyance,
  executeConveyance,
  executeCreateNpri,
  executeCreateRootNode,
  executeDeleteBranch,
  executePredecessorInsert,
  executeRebalance,
  findNpriBranchDiscrepancies,
  rootOwnershipTotal,
  validateOwnershipGraph,
} from '../title-math';
export type {
  AttachConveyanceParams,
  ConveyanceParams,
  CreateNpriParams,
  CreateRootNodeParams,
  DeleteBranchParams,
  NpriBranchDiscrepancy,
  NpriBranchDiscrepancyKind,
  PredecessorInsertParams,
  RebalanceParams,
  ShareParams,
  ValidationIssue,
  ValidationResult,
} from '../title-math';
