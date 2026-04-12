import { useEffect, useMemo, useState } from 'react';
import FormField from '../components/shared/FormField';
import FractionDisplay from '../components/shared/FractionDisplay';
import { useCurativeStore } from '../store/curative-store';
import { useOwnerStore } from '../store/owner-store';
import { useUIStore } from '../store/ui-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  TITLE_ISSUE_PRIORITY_OPTIONS,
  TITLE_ISSUE_STATUS_OPTIONS,
  TITLE_ISSUE_TYPE_OPTIONS,
  createBlankTitleIssue,
  type TitleIssue,
  type TitleIssuePriority,
  type TitleIssueStatus,
  type TitleIssueType,
} from '../types/title-issue';
import type { Lease, Owner } from '../types/owner';
import type { DeskMap, OwnershipNode } from '../types/node';

type StatusFilter = 'all' | 'active' | TitleIssueStatus;
type PriorityFilter = 'all' | TitleIssuePriority;
type TitleIssueForm = Omit<TitleIssue, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>;

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Active Only' },
  { value: 'all', label: 'All Statuses' },
  ...TITLE_ISSUE_STATUS_OPTIONS.map((status) => ({ value: status, label: status })),
];

const PRIORITY_FILTER_OPTIONS: Array<{ value: PriorityFilter; label: string }> = [
  { value: 'all', label: 'All Priorities' },
  ...TITLE_ISSUE_PRIORITY_OPTIONS.map((priority) => ({
    value: priority,
    label: priority,
  })),
];

const COMPANY_READINESS_BACKLOG = [
  'Lease admin calendar and clause flags',
  'Division order, pay status, and suspense workflow',
  'Pooling / unit document package',
  'RRC well and GIS integration',
  'Document OCR and clause extraction',
  'Advanced interests: executive rights, life estates, term minerals, NPI/BIAPO',
  'Enterprise audit trail and reviewer signoff',
];

function titleIssueIsClosed(issue: Pick<TitleIssue, 'status'>) {
  return issue.status === 'Resolved' || issue.status === 'Deferred';
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function describeOwner(owner: Owner | undefined) {
  return owner?.name || 'Unlinked owner';
}

function describeLease(lease: Lease | undefined) {
  if (!lease) {
    return 'Unlinked lease';
  }

  return [lease.leaseName, lease.lessee, lease.docNo].filter(Boolean).join(' • ')
    || 'Unnamed lease';
}

function describeDeskMap(deskMap: DeskMap | undefined) {
  if (!deskMap) {
    return 'Unlinked tract';
  }

  return [deskMap.code, deskMap.name].filter(Boolean).join(' • ')
    || 'Unnamed tract';
}

function describeNode(node: OwnershipNode | undefined) {
  if (!node) {
    return 'Unlinked branch';
  }

  const label = node.grantee || node.grantor || node.docNo || node.id;
  const classLabel = node.interestClass === 'npri' ? 'NPRI' : 'Mineral';
  return `${label} (${classLabel})`;
}

function issueToForm(issue: TitleIssue): TitleIssueForm {
  return {
    title: issue.title,
    issueType: issue.issueType,
    priority: issue.priority,
    status: issue.status,
    affectedDeskMapId: issue.affectedDeskMapId,
    affectedNodeId: issue.affectedNodeId,
    affectedOwnerId: issue.affectedOwnerId,
    affectedLeaseId: issue.affectedLeaseId,
    sourceDocNo: issue.sourceDocNo,
    requiredCurativeAction: issue.requiredCurativeAction,
    responsibleParty: issue.responsibleParty,
    dueDate: issue.dueDate,
    notes: issue.notes,
    resolutionNotes: issue.resolutionNotes,
  };
}

function getDueDateTone(issue: Pick<TitleIssue, 'dueDate' | 'status'>) {
  if (!issue.dueDate || titleIssueIsClosed(issue)) {
    return 'text-ink-light';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(`${issue.dueDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return 'text-ink-light';
  }

  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysUntilDue < 0) {
    return 'text-seal';
  }
  if (daysUntilDue <= 14) {
    return 'text-amber-700';
  }
  return 'text-ink-light';
}

function getPriorityBadgeClass(priority: TitleIssuePriority) {
  if (priority === 'Critical') {
    return 'border-seal/30 bg-seal/10 text-seal';
  }
  if (priority === 'High') {
    return 'border-amber-500/40 bg-amber-100 text-amber-800';
  }
  if (priority === 'Medium') {
    return 'border-leather/30 bg-leather/10 text-leather';
  }
  return 'border-ledger-line bg-white text-ink-light';
}

function getStatusBadgeClass(status: TitleIssueStatus) {
  if (status === 'Resolved') {
    return 'border-emerald-500/30 bg-emerald-50 text-emerald-700';
  }
  if (status === 'Deferred') {
    return 'border-slate-300 bg-slate-50 text-slate-600';
  }
  if (status === 'Ready for Review') {
    return 'border-gold/50 bg-gold/10 text-leather';
  }
  return 'border-leather/30 bg-leather/10 text-leather';
}

export function filterTitleIssues(
  issues: TitleIssue[],
  context: {
    searchQuery: string;
    statusFilter: StatusFilter;
    priorityFilter: PriorityFilter;
    deskMaps: DeskMap[];
    nodes: OwnershipNode[];
    owners: Owner[];
    leases: Lease[];
  }
) {
  const deskMapById = new Map(context.deskMaps.map((deskMap) => [deskMap.id, deskMap]));
  const nodeById = new Map(context.nodes.map((node) => [node.id, node]));
  const ownerById = new Map(context.owners.map((owner) => [owner.id, owner]));
  const leaseById = new Map(context.leases.map((lease) => [lease.id, lease]));
  const normalizedQuery = normalizeSearchText(context.searchQuery);

  return issues.filter((issue) => {
    if (context.statusFilter === 'active' && titleIssueIsClosed(issue)) {
      return false;
    }
    if (context.statusFilter !== 'active' && context.statusFilter !== 'all') {
      if (issue.status !== context.statusFilter) {
        return false;
      }
    }
    if (
      context.priorityFilter !== 'all' &&
      issue.priority !== context.priorityFilter
    ) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }

    const searchText = normalizeSearchText(
      [
        issue.title,
        issue.issueType,
        issue.priority,
        issue.status,
        issue.sourceDocNo,
        issue.requiredCurativeAction,
        issue.responsibleParty,
        issue.notes,
        issue.resolutionNotes,
        describeDeskMap(
          issue.affectedDeskMapId
            ? deskMapById.get(issue.affectedDeskMapId)
            : undefined
        ),
        describeNode(
          issue.affectedNodeId ? nodeById.get(issue.affectedNodeId) : undefined
        ),
        describeOwner(
          issue.affectedOwnerId
            ? ownerById.get(issue.affectedOwnerId)
            : undefined
        ),
        describeLease(
          issue.affectedLeaseId
            ? leaseById.get(issue.affectedLeaseId)
            : undefined
        ),
      ].join(' ')
    );

    return searchText.includes(normalizedQuery);
  });
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full rounded-lg border border-ledger-line bg-parchment px-3 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function LinkedSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
        {label}
      </span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="w-full rounded-lg border border-ledger-line bg-parchment px-3 py-1.5 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
      >
        <option value="">None linked</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function CurativeView() {
  const workspaceId = useCurativeStore((state) => state.workspaceId);
  const titleIssues = useCurativeStore((state) => state.titleIssues);
  const selectedIssueId = useCurativeStore((state) => state.selectedIssueId);
  const selectIssue = useCurativeStore((state) => state.selectIssue);
  const addIssue = useCurativeStore((state) => state.addIssue);
  const updateIssue = useCurativeStore((state) => state.updateIssue);
  const removeIssue = useCurativeStore((state) => state.removeIssue);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const setActiveDeskMap = useWorkspaceStore((state) => state.setActiveDeskMap);
  const setActiveNode = useWorkspaceStore((state) => state.setActiveNode);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const setView = useUIStore((state) => state.setView);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [form, setForm] = useState<TitleIssueForm | null>(null);
  const [saving, setSaving] = useState(false);

  const visibleIssues = useMemo(
    () =>
      filterTitleIssues(titleIssues, {
        searchQuery,
        statusFilter,
        priorityFilter,
        deskMaps,
        nodes,
        owners,
        leases,
      }),
    [deskMaps, leases, nodes, owners, priorityFilter, searchQuery, statusFilter, titleIssues]
  );

  const selectedIssue = selectedIssueId
    ? titleIssues.find((issue) => issue.id === selectedIssueId) ?? null
    : null;
  const selectedIssueVisible = selectedIssue
    ? visibleIssues.some((issue) => issue.id === selectedIssue.id)
    : false;
  const issueForPanel = selectedIssueVisible ? selectedIssue : null;

  const activeIssues = titleIssues.filter((issue) => !titleIssueIsClosed(issue));
  const criticalIssues = activeIssues.filter(
    (issue) => issue.priority === 'Critical' || issue.priority === 'High'
  );
  const reviewIssues = activeIssues.filter(
    (issue) => issue.status === 'Ready for Review'
  );
  const overdueIssues = activeIssues.filter(
    (issue) => getDueDateTone(issue) === 'text-seal'
  );

  const deskMapOptions = useMemo(
    () =>
      deskMaps.map((deskMap) => ({
        id: deskMap.id,
        label: describeDeskMap(deskMap),
      })),
    [deskMaps]
  );
  const nodeOptions = useMemo(() => {
    const allowedNodeIds = form?.affectedDeskMapId
      ? new Set(
          deskMaps.find((deskMap) => deskMap.id === form.affectedDeskMapId)?.nodeIds ?? []
        )
      : null;

    return nodes
      .filter((node) => !allowedNodeIds || allowedNodeIds.has(node.id))
      .map((node) => ({
        id: node.id,
        label: describeNode(node),
      }));
  }, [deskMaps, form?.affectedDeskMapId, nodes]);
  const ownerOptions = useMemo(
    () =>
      owners.map((owner) => ({
        id: owner.id,
        label: describeOwner(owner),
      })),
    [owners]
  );
  const leaseOptions = useMemo(
    () =>
      leases
        .filter((lease) => !form?.affectedOwnerId || lease.ownerId === form.affectedOwnerId)
        .map((lease) => ({
          id: lease.id,
          label: describeLease(lease),
        })),
    [form?.affectedOwnerId, leases]
  );

  useEffect(() => {
    if (visibleIssues.length === 0) {
      if (selectedIssueId) {
        selectIssue(null);
      }
      return;
    }
    if (
      !selectedIssueId ||
      !visibleIssues.some((issue) => issue.id === selectedIssueId)
    ) {
      selectIssue(visibleIssues[0]?.id ?? null);
    }
  }, [selectIssue, selectedIssueId, visibleIssues]);

  useEffect(() => {
    setForm(issueForPanel ? issueToForm(issueForPanel) : null);
  }, [issueForPanel?.id]);

  const setFormField = <K extends keyof TitleIssueForm>(
    field: K,
    value: TitleIssueForm[K]
  ) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const openLinkedDeskMap = () => {
    if (!issueForPanel?.affectedDeskMapId) {
      return;
    }
    setActiveDeskMap(issueForPanel.affectedDeskMapId);
    setActiveNode(issueForPanel.affectedNodeId);
    setView('chart');
  };

  return (
    <div className="grid h-full gap-4 bg-parchment-dark/30 p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-ledger-line bg-parchment shadow-sm">
        <div className="border-b border-ledger-line bg-ledger px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-display font-bold text-ink">
                Curative
              </div>
              <div className="text-xs text-ink-light">
                {activeIssues.length} active title issue{activeIssues.length === 1 ? '' : 's'}
              </div>
            </div>
            <button
              type="button"
              disabled={!workspaceId}
              onClick={async () => {
                if (!workspaceId) return;
                await addIssue(
                  createBlankTitleIssue(workspaceId, {
                    title: 'New title issue',
                    issueType: 'Title opinion requirement',
                    requiredCurativeAction: 'Describe the document or action needed to cure this.',
                  })
                );
              }}
              className="rounded-lg border border-leather/30 px-3 py-2 text-xs font-semibold text-leather transition-colors hover:bg-leather/10 disabled:opacity-50"
            >
              + New Issue
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-ledger-line bg-white px-2 py-2">
              <div className="text-lg font-display font-bold text-seal">
                {criticalIssues.length}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-light">
                High Risk
              </div>
            </div>
            <div className="rounded-lg border border-ledger-line bg-white px-2 py-2">
              <div className="text-lg font-display font-bold text-amber-700">
                {overdueIssues.length}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-light">
                Overdue
              </div>
            </div>
            <div className="rounded-lg border border-ledger-line bg-white px-2 py-2">
              <div className="text-lg font-display font-bold text-leather">
                {reviewIssues.length}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-ink-light">
                Review
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-ledger-line bg-parchment-dark/40 px-4 py-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
              Search
            </span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Owner, tract, defect, doc no., cure..."
              className="mt-1.5 w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="mt-1.5 w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-leather"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
                Priority
              </span>
              <select
                value={priorityFilter}
                onChange={(event) =>
                  setPriorityFilter(event.target.value as PriorityFilter)
                }
                className="mt-1.5 w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-leather"
              >
                {PRIORITY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 text-xs text-ink-light">
            Showing {visibleIssues.length}/{titleIssues.length}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {titleIssues.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-light">
              No curative issues yet. Add probate, NPRI discrepancy, lease, lien,
              ratification, or title-opinion requirements here as they come up.
            </div>
          ) : visibleIssues.length === 0 ? (
            <div className="px-4 py-6 text-sm text-ink-light">
              <div className="font-semibold text-ink">No issues match.</div>
              <div className="mt-1">Clear the filter or search different title terms.</div>
            </div>
          ) : (
            visibleIssues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => selectIssue(issue.id)}
                className={`w-full border-b border-ledger-line px-4 py-3 text-left transition-colors ${
                  issueForPanel?.id === issue.id ? 'bg-leather/10' : 'hover:bg-ledger'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">
                      {issue.title || 'Untitled title issue'}
                    </div>
                    <div className="mt-1 text-xs text-ink-light">
                      {issue.issueType}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPriorityBadgeClass(issue.priority)}`}
                  >
                    {issue.priority}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadgeClass(issue.status)}`}
                  >
                    {issue.status}
                  </span>
                  {issue.dueDate && (
                    <span className={`text-[11px] font-semibold ${getDueDateTone(issue)}`}>
                      Due {issue.dueDate}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="min-w-0">
        {issueForPanel && form ? (
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-ledger-line bg-parchment shadow-sm">
            <div className="border-b border-ledger-line bg-ledger px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xl font-display font-bold text-ink">
                    {issueForPanel.title || 'Untitled title issue'}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-light">
                    <span>{issueForPanel.issueType}</span>
                    <span>•</span>
                    <span>{describeDeskMap(deskMaps.find((deskMap) => deskMap.id === issueForPanel.affectedDeskMapId))}</span>
                    {issueForPanel.affectedNodeId && (
                      <>
                        <span>•</span>
                        <span>
                          {describeNode(nodes.find((node) => node.id === issueForPanel.affectedNodeId))}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={!issueForPanel.affectedDeskMapId}
                    onClick={openLinkedDeskMap}
                    className="rounded-lg border border-leather/30 px-3 py-2 text-xs font-semibold text-leather transition-colors hover:bg-leather/10 disabled:opacity-40"
                  >
                    Open Desk Map
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Delete this curative issue?')) return;
                      await removeIssue(issueForPanel.id);
                    }}
                    className="rounded-lg px-3 py-2 text-xs font-semibold text-seal transition-colors hover:bg-seal/10"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField
                      label="Issue Title"
                      value={form.title}
                      onChange={(value) => setFormField('title', value)}
                    />
                    <SelectField<TitleIssueType>
                      label="Issue Type"
                      value={form.issueType}
                      onChange={(value) => setFormField('issueType', value)}
                      options={TITLE_ISSUE_TYPE_OPTIONS}
                    />
                    <SelectField<TitleIssuePriority>
                      label="Priority"
                      value={form.priority}
                      onChange={(value) => setFormField('priority', value)}
                      options={TITLE_ISSUE_PRIORITY_OPTIONS}
                    />
                    <SelectField<TitleIssueStatus>
                      label="Status"
                      value={form.status}
                      onChange={(value) => setFormField('status', value)}
                      options={TITLE_ISSUE_STATUS_OPTIONS}
                    />
                    <FormField
                      label="Source Doc No."
                      value={form.sourceDocNo}
                      onChange={(value) => setFormField('sourceDocNo', value)}
                    />
                    <FormField
                      label="Due Date"
                      type="date"
                      value={form.dueDate}
                      onChange={(value) => setFormField('dueDate', value)}
                    />
                    <FormField
                      label="Responsible Party"
                      value={form.responsibleParty}
                      onChange={(value) => setFormField('responsibleParty', value)}
                      className="md:col-span-2"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
                      Required Curative Action
                    </label>
                    <textarea
                      value={form.requiredCurativeAction}
                      onChange={(event) =>
                        setFormField('requiredCurativeAction', event.target.value)
                      }
                      rows={4}
                      className="w-full resize-y rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
                      placeholder="Example: obtain affidavit of heirship, probate order, release, ratification, correction deed, or title-opinion waiver."
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
                      Working Notes
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(event) => setFormField('notes', event.target.value)}
                      rows={5}
                      className="w-full resize-y rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wider text-ink-light">
                      Resolution Notes
                    </label>
                    <textarea
                      value={form.resolutionNotes}
                      onChange={(event) =>
                        setFormField('resolutionNotes', event.target.value)
                      }
                      rows={3}
                      className="w-full resize-y rounded-lg border border-ledger-line bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
                      placeholder="Who approved it, what document cured it, or why it was deferred."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-ledger-line bg-white/70 p-4">
                    <div className="text-sm font-display font-bold text-ink">
                      Affected Title
                    </div>
                    <div className="mt-3 space-y-3">
                      <LinkedSelect
                        label="Tract / Desk Map"
                        value={form.affectedDeskMapId}
                        onChange={(value) => {
                          const nextNodeId =
                            value &&
                            form.affectedNodeId &&
                            deskMaps
                              .find((deskMap) => deskMap.id === value)
                              ?.nodeIds.includes(form.affectedNodeId)
                              ? form.affectedNodeId
                              : null;
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  affectedDeskMapId: value,
                                  affectedNodeId: nextNodeId,
                                }
                              : current
                          );
                        }}
                        options={deskMapOptions}
                      />
                      <LinkedSelect
                        label="Branch / Owner Card"
                        value={form.affectedNodeId}
                        onChange={(value) => setFormField('affectedNodeId', value)}
                        options={nodeOptions}
                      />
                      <LinkedSelect
                        label="Owner Record"
                        value={form.affectedOwnerId}
                        onChange={(value) => {
                          const nextLeaseId =
                            value &&
                            form.affectedLeaseId &&
                            leases.find((lease) => lease.id === form.affectedLeaseId)
                              ?.ownerId === value
                              ? form.affectedLeaseId
                              : null;
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  affectedOwnerId: value,
                                  affectedLeaseId: nextLeaseId,
                                }
                              : current
                          );
                        }}
                        options={ownerOptions}
                      />
                      <LinkedSelect
                        label="Lease Record"
                        value={form.affectedLeaseId}
                        onChange={(value) => setFormField('affectedLeaseId', value)}
                        options={leaseOptions}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-ledger-line bg-white/70 p-4">
                    <div className="text-sm font-display font-bold text-ink">
                      Current Link Summary
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-ink-light">
                      <div>
                        <span className="font-semibold text-ink">Tract: </span>
                        {describeDeskMap(
                          deskMaps.find((deskMap) => deskMap.id === form.affectedDeskMapId)
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-ink">Branch: </span>
                        {describeNode(nodes.find((node) => node.id === form.affectedNodeId))}
                      </div>
                      {form.affectedNodeId && (
                        <div>
                          <span className="font-semibold text-ink">Branch decimal: </span>
                          <FractionDisplay
                            value={
                              nodes.find((node) => node.id === form.affectedNodeId)
                                ?.fraction ?? '0'
                            }
                          />
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-ink">Owner: </span>
                        {describeOwner(owners.find((owner) => owner.id === form.affectedOwnerId))}
                      </div>
                      <div>
                        <span className="font-semibold text-ink">Lease: </span>
                        {describeLease(leases.find((lease) => lease.id === form.affectedLeaseId))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gold/40 bg-gold/10 p-4 text-sm text-ink">
                    <div className="font-display font-bold">Company readiness list</div>
                    <div className="mt-2 text-xs leading-5 text-ink-light">
                      Added to the running roadmap after curative:
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-ink-light">
                      {COMPANY_READINESS_BACKLOG.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-ledger-line bg-parchment-dark/40 px-5 py-3">
              <div className="text-xs text-ink-light">
                Warning-only workflow: issues document title risk and payout readiness;
                they do not block title-building edits.
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  await updateIssue(issueForPanel.id, form);
                  setSaving(false);
                }}
                className="rounded-lg bg-leather px-4 py-2 text-sm font-semibold text-parchment transition-colors hover:bg-leather-light disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Issue'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-ledger-line bg-parchment">
            <div className="max-w-lg px-6 text-center">
              <div className="text-xl font-display font-bold text-ink">
                No curative issue selected
              </div>
              <div className="mt-2 text-sm text-ink-light">
                Create an issue for title defects, missing curative documents,
                lease gaps, NPRI discrepancies, or payout holds that need a
                landman-reviewable explanation.
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
