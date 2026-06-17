import {
  findNpriBranchDiscrepancies,
  validateOwnershipGraph,
  type ValidationIssue,
} from '../../title-math';
import type { DeskMap, OwnershipNode } from '../../types/node';
import type { DeskMapCoverageSummary } from '../../title-math';

export interface DeskMapWarningDotState {
  hasWarning: boolean;
  graphIssues: ValidationIssue[];
  npriDiscrepancyCount: number;
  leaseOverlapCount: number;
  curativeIssueCount: number;
}

export interface BuildDeskMapWarningDotStateInput {
  deskMap: Pick<DeskMap, 'nodeIds'>;
  nodes: readonly OwnershipNode[];
  coverageSummary?: Pick<DeskMapCoverageSummary, 'leaseOverlaps'>;
  /** Open Critical/High curative issues affecting this desk map (default 0). */
  curativeIssueCount?: number;
}

export function buildDeskMapWarningDotState(
  input: BuildDeskMapWarningDotStateInput
): DeskMapWarningDotState {
  const nodeIds = new Set(input.deskMap.nodeIds);
  const deskMapNodes = input.nodes.filter((node) => nodeIds.has(node.id));
  const graphIssues = validateOwnershipGraph(deskMapNodes).issues;
  const npriDiscrepancyCount = findNpriBranchDiscrepancies(deskMapNodes).length;
  const leaseOverlapCount = input.coverageSummary?.leaseOverlaps.length ?? 0;
  const curativeIssueCount = input.curativeIssueCount ?? 0;

  return {
    hasWarning:
      graphIssues.length > 0
      || npriDiscrepancyCount > 0
      || leaseOverlapCount > 0
      || curativeIssueCount > 0,
    graphIssues,
    npriDiscrepancyCount,
    leaseOverlapCount,
    curativeIssueCount,
  };
}

export function hasDeskMapWarningDot(
  input: BuildDeskMapWarningDotStateInput
): boolean {
  return buildDeskMapWarningDotState(input).hasWarning;
}
