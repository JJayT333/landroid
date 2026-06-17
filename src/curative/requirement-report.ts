/**
 * Curative requirement report — a printable, numbered list of the title
 * requirements (curative issues) for an examiner / closing file.
 *
 * Pure: the workspace's curative issues + the records they reference → an
 * ordered set of numbered requirements with their affected entities resolved to
 * readable labels. Requirements are numbered in the order they are passed (the
 * view passes the store's order: open first, then by due date), so the printed
 * numbering matches what the operator sees on screen.
 */
import {
  titleIssueIsClosed,
  type TitleIssue,
  type TitleIssuePriority,
  type TitleIssueStatus,
  type TitleIssueType,
} from '../types/title-issue';
import type { DeskMap, OwnershipNode } from '../types/node';
import type { Lease, Owner } from '../types/owner';
import {
  describeDeskMap,
  describeLease,
  describeNode,
  describeOwner,
} from './curative-labels';

export interface CurativeReportContext {
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
  owners: Owner[];
  leases: Lease[];
}

export interface CurativeRequirement {
  /** 1-based requirement number, in report order. */
  number: number;
  issueId: string;
  title: string;
  issueType: TitleIssueType;
  priority: TitleIssuePriority;
  status: TitleIssueStatus;
  isOpen: boolean;
  /** Resolved "Tract: …", "Branch: …", "Owner: …", "Lease: …" labels. */
  affected: string[];
  requiredCurativeAction: string;
  responsibleParty: string;
  dueDate: string;
  sourceDocNo: string;
  notes: string;
  resolutionNotes: string;
}

export interface CurativeRequirementReport {
  requirements: CurativeRequirement[];
  totalCount: number;
  openCount: number;
  criticalOpenCount: number;
}

function affectedLabels(
  issue: TitleIssue,
  ctx: CurativeReportContext
): string[] {
  const labels: string[] = [];
  if (issue.affectedDeskMapId) {
    labels.push(
      `Tract: ${describeDeskMap(ctx.deskMaps.find((deskMap) => deskMap.id === issue.affectedDeskMapId))}`
    );
  }
  if (issue.affectedNodeId) {
    labels.push(
      `Branch: ${describeNode(ctx.nodes.find((node) => node.id === issue.affectedNodeId))}`
    );
  }
  if (issue.affectedOwnerId) {
    labels.push(
      `Owner: ${describeOwner(ctx.owners.find((owner) => owner.id === issue.affectedOwnerId))}`
    );
  }
  if (issue.affectedLeaseId) {
    labels.push(
      `Lease: ${describeLease(ctx.leases.find((lease) => lease.id === issue.affectedLeaseId))}`
    );
  }
  return labels;
}

/** Build the numbered requirement report from the workspace's curative issues. */
export function buildCurativeRequirementReport(
  issues: readonly TitleIssue[],
  ctx: CurativeReportContext
): CurativeRequirementReport {
  const requirements: CurativeRequirement[] = issues.map((issue, index) => {
    const isOpen = !titleIssueIsClosed(issue);
    return {
      number: index + 1,
      issueId: issue.id,
      title: issue.title.trim() || 'Untitled requirement',
      issueType: issue.issueType,
      priority: issue.priority,
      status: issue.status,
      isOpen,
      affected: affectedLabels(issue, ctx),
      requiredCurativeAction: issue.requiredCurativeAction,
      responsibleParty: issue.responsibleParty,
      dueDate: issue.dueDate,
      sourceDocNo: issue.sourceDocNo,
      notes: issue.notes,
      resolutionNotes: issue.resolutionNotes,
    };
  });

  return {
    requirements,
    totalCount: requirements.length,
    openCount: requirements.filter((requirement) => requirement.isOpen).length,
    criticalOpenCount: requirements.filter(
      (requirement) => requirement.isOpen && requirement.priority === 'Critical'
    ).length,
  };
}
