/**
 * Public surface of the unified title-math engine.
 *
 * Re-exports the same names (and identical signatures) the pre-rewrite
 * `src/engine/math-engine.ts` exposed to consumers, so the eventual cutover is a
 * mechanical import-source flip. The one intentional omission is
 * `collectDescendantIds`, whose old export leaked the internal CalcNode type and
 * is consumed nowhere (workspace-store and ai/approval-preview define their own
 * OwnershipNode-typed versions).
 *
 * Coverage, leasehold, and tree-share calculators are added here as their phases
 * land.
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
  rootOwnershipTotal,
  validateOwnershipGraph,
} from './calculators/ownership';
export type {
  AttachConveyanceParams,
  ConveyanceParams,
  CreateNpriParams,
  CreateRootNodeParams,
  DeleteBranchParams,
  PredecessorInsertParams,
  RebalanceParams,
  ShareParams,
} from './calculators/ownership';
export { findNpriBranchDiscrepancies } from './model/graph-ops';
export type {
  NpriBranchDiscrepancy,
  NpriBranchDiscrepancyKind,
  ValidationIssue,
  ValidationResult,
} from './model/graph-ops';
export {
  allocateLeaseCoverage,
  buildLeaseScopeIndex,
  calculateDeskMapCoverageSummary,
  getActiveLeases,
  getLeasesForOwnerNode,
  isLeaseActive,
} from './calculators/coverage';
export type {
  DeskMapCoverageSummary,
  LeaseCoverageAllocation,
  LeaseCoverageOverlap,
  LeaseCoverageResult,
  LeaseScopeIndex,
} from './calculators/coverage';
export * from './calculators/leasehold';
export {
  computeLiveOwnershipFractions,
  computeRelativeShare,
} from './calculators/tree-share';
export type { LiveOwnershipFractions } from './calculators/tree-share';
