import {
  findNpriBranchDiscrepancies,
  validateOwnershipGraph,
  type ValidationIssue,
} from '../../engine/math-engine';
import type { DeskMap, OwnershipNode } from '../../types/node';
import type { DeskMapCoverageSummary } from './deskmap-coverage';

export interface DeskMapWarningDotState {
  hasWarning: boolean;
  graphIssues: ValidationIssue[];
  npriDiscrepancyCount: number;
  leaseOverlapCount: number;
}

export interface BuildDeskMapWarningDotStateInput {
  deskMap: Pick<DeskMap, 'nodeIds'>;
  nodes: readonly OwnershipNode[];
  coverageSummary?: Pick<DeskMapCoverageSummary, 'leaseOverlaps'>;
}

export function buildDeskMapWarningDotState(
  input: BuildDeskMapWarningDotStateInput
): DeskMapWarningDotState {
  const nodeIds = new Set(input.deskMap.nodeIds);
  const deskMapNodes = input.nodes.filter((node) => nodeIds.has(node.id));
  const graphIssues = validateOwnershipGraph(deskMapNodes).issues;
  const npriDiscrepancyCount = findNpriBranchDiscrepancies(deskMapNodes).length;
  const leaseOverlapCount = input.coverageSummary?.leaseOverlaps.length ?? 0;

  return {
    hasWarning:
      graphIssues.length > 0
      || npriDiscrepancyCount > 0
      || leaseOverlapCount > 0,
    graphIssues,
    npriDiscrepancyCount,
    leaseOverlapCount,
  };
}

export function hasDeskMapWarningDot(
  input: BuildDeskMapWarningDotStateInput
): boolean {
  return buildDeskMapWarningDotState(input).hasWarning;
}
