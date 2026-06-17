/**
 * Curative → Desk Map flag helper.
 *
 * Pure: maps the open Critical/High curative issues that touch a given desk map.
 * An issue touches a desk map when it is linked to it directly
 * (`affectedDeskMapId === deskMap.id`) or to one of its nodes
 * (`affectedNodeId ∈ deskMap.nodeIds`); an issue counts once even if both links
 * point at the same map. No store reads — the caller supplies the issues.
 */
import type { DeskMap } from '../../types/node';
import { isOpenHighRiskTitleIssue, type TitleIssue } from '../../types/title-issue';

/** Count of open Critical/High curative issues affecting `deskMap`. */
export function countOpenHighRiskCurativeIssuesForDeskMap(
  deskMap: Pick<DeskMap, 'id' | 'nodeIds'>,
  curativeIssues: readonly TitleIssue[]
): number {
  const nodeIds = new Set(deskMap.nodeIds);
  let count = 0;
  for (const issue of curativeIssues) {
    if (!isOpenHighRiskTitleIssue(issue)) continue;
    if (
      issue.affectedDeskMapId === deskMap.id
      || (issue.affectedNodeId !== null && nodeIds.has(issue.affectedNodeId))
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * Count of DISTINCT open Critical/High curative issues affecting ANY of a unit's
 * desk maps — the transfer-order hold count. Matches the same way the dot does
 * (by `affectedDeskMapId` or `affectedNodeId`), so the hold and the dots agree;
 * each issue is counted once even if it touches several of the unit's tracts.
 */
export function countOpenHighRiskCurativeIssuesForUnit(
  deskMaps: ReadonlyArray<Pick<DeskMap, 'id' | 'nodeIds'>>,
  curativeIssues: readonly TitleIssue[]
): number {
  if (deskMaps.length === 0) return 0;
  const deskMapIds = new Set(deskMaps.map((deskMap) => deskMap.id));
  const nodeIds = new Set(deskMaps.flatMap((deskMap) => deskMap.nodeIds));
  let count = 0;
  for (const issue of curativeIssues) {
    if (!isOpenHighRiskTitleIssue(issue)) continue;
    if (
      (issue.affectedDeskMapId !== null && deskMapIds.has(issue.affectedDeskMapId))
      || (issue.affectedNodeId !== null && nodeIds.has(issue.affectedNodeId))
    ) {
      count += 1;
    }
  }
  return count;
}
