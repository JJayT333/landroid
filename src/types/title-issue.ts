export const TITLE_ISSUE_TYPE_OPTIONS = [
  'NPRI discrepancy',
  'Over-conveyance',
  'Missing lease',
  'Missing ratification',
  'Probate / heirship',
  'Bad legal description',
  'Name mismatch',
  'Unreleased lien',
  'Unrecorded assignment',
  'Title opinion requirement',
  'Other',
] as const;

export type TitleIssueType = (typeof TITLE_ISSUE_TYPE_OPTIONS)[number];

export const TITLE_ISSUE_PRIORITY_OPTIONS = [
  'Critical',
  'High',
  'Medium',
  'Low',
] as const;

export type TitleIssuePriority = (typeof TITLE_ISSUE_PRIORITY_OPTIONS)[number];

export const TITLE_ISSUE_STATUS_OPTIONS = [
  'Open',
  'Researching',
  'Curative Requested',
  'Waiting on Third Party',
  'Ready for Review',
  'Resolved',
  'Deferred',
] as const;

export type TitleIssueStatus = (typeof TITLE_ISSUE_STATUS_OPTIONS)[number];

export interface TitleIssue {
  id: string;
  workspaceId: string;
  title: string;
  issueType: TitleIssueType;
  priority: TitleIssuePriority;
  status: TitleIssueStatus;
  affectedDeskMapId: string | null;
  affectedNodeId: string | null;
  affectedOwnerId: string | null;
  affectedLeaseId: string | null;
  sourceDocNo: string;
  requiredCurativeAction: string;
  responsibleParty: string;
  dueDate: string;
  notes: string;
  resolutionNotes: string;
  createdAt: string;
  updatedAt: string;
}

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeOption<T extends readonly string[]>(
  value: unknown,
  options: T,
  fallback: T[number]
): T[number] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = options.find(
      (option) => option.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) {
      return match;
    }
  }

  return fallback;
}

export function createBlankTitleIssue(
  workspaceId: string,
  overrides: Partial<TitleIssue> = {}
): TitleIssue {
  const now = nowIso();
  const issue: TitleIssue = {
    id:
      overrides.id ??
      `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId,
    title: '',
    issueType: 'Title opinion requirement',
    priority: 'Medium',
    status: 'Open',
    affectedDeskMapId: null,
    affectedNodeId: null,
    affectedOwnerId: null,
    affectedLeaseId: null,
    sourceDocNo: '',
    requiredCurativeAction: '',
    responsibleParty: '',
    dueDate: '',
    notes: '',
    resolutionNotes: '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    ...overrides,
  };

  issue.workspaceId = workspaceId;
  return issue;
}

export function normalizeTitleIssue(
  issue: Pick<TitleIssue, 'id'> & Partial<TitleIssue>,
  fallback: { workspaceId?: string } = {}
): TitleIssue {
  const workspaceId = asString(issue.workspaceId) || fallback.workspaceId || '';
  const normalized = createBlankTitleIssue(workspaceId, {
    id: issue.id,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  });

  return {
    ...normalized,
    ...issue,
    workspaceId,
    title: asString(issue.title),
    issueType: normalizeOption(
      issue.issueType,
      TITLE_ISSUE_TYPE_OPTIONS,
      'Title opinion requirement'
    ),
    priority: normalizeOption(issue.priority, TITLE_ISSUE_PRIORITY_OPTIONS, 'Medium'),
    status: normalizeOption(issue.status, TITLE_ISSUE_STATUS_OPTIONS, 'Open'),
    affectedDeskMapId: asNullableString(issue.affectedDeskMapId),
    affectedNodeId: asNullableString(issue.affectedNodeId),
    affectedOwnerId: asNullableString(issue.affectedOwnerId),
    affectedLeaseId: asNullableString(issue.affectedLeaseId),
    sourceDocNo: asString(issue.sourceDocNo),
    requiredCurativeAction: asString(issue.requiredCurativeAction),
    responsibleParty: asString(issue.responsibleParty),
    dueDate: asString(issue.dueDate),
    notes: asString(issue.notes),
    resolutionNotes: asString(issue.resolutionNotes),
    createdAt: asString(issue.createdAt) || normalized.createdAt,
    updatedAt: asString(issue.updatedAt) || normalized.updatedAt,
  };
}

export function normalizeTitleIssues(
  issues: unknown,
  fallback: { workspaceId?: string } = {}
): TitleIssue[] {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.flatMap((issue) => {
    if (
      typeof issue !== 'object' ||
      issue === null ||
      Array.isArray(issue) ||
      typeof (issue as { id?: unknown }).id !== 'string'
    ) {
      return [];
    }

    return [
      normalizeTitleIssue(
        issue as Pick<TitleIssue, 'id'> & Partial<TitleIssue>,
        fallback
      ),
    ];
  });
}
