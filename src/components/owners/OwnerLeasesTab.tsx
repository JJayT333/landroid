import { useMemo, useState } from 'react';
import Button from '../shared/Button';
import FormField from '../shared/FormField';
import { useConfirmation } from '../shared/ConfirmationProvider';
import { distinctLesseeNames } from '../leasehold/lessee-names';
import { useOwnerStore } from '../../store/owner-store';
import { READ_ONLY_WORKSPACE_EDIT_TITLE } from '../../store/write-lease-store';
import {
  LEASE_STATUS_OPTIONS,
  createBlankLease,
  isLeaseStatusOption,
  normalizeLease,
  type Lease,
} from '../../types/owner';
import { d, serialize } from '../../engine/decimal';
import { formatAsFraction } from '../../engine/fraction-display';
import {
  normalizeInterestString,
  parseInterestString,
  parseStrictInterestString,
} from '../../utils/interest-string';
import type { OwnerLeaseDeskMapTarget } from './owner-lease-deskmap';
import {
  groupLeasesByInstrument,
  type LeaseInstrumentGroup,
} from './owner-lease-grouping';

/** Instrument fields carried across every record of a collapsed lease group. */
const LEASE_INSTRUMENT_FIELDS = [
  'leaseName',
  'lessee',
  'royaltyRate',
  'leasedInterest',
  'effectiveDate',
  'expirationDate',
  'status',
  'docNo',
  'notes',
] as const;

/**
 * Union the desk-map attach targets across every record in a collapsed group,
 * keyed by the owner mineral node, preferring an already-attached target and
 * remembering which record owns it (so the button acts on the right record).
 */
function unionGroupDeskMapTargets(
  group: LeaseInstrumentGroup,
  getDeskMapTargetsForLease: (leaseId: string) => OwnerLeaseDeskMapTarget[]
): Array<OwnerLeaseDeskMapTarget & { leaseId: string }> {
  const byNode = new Map<string, OwnerLeaseDeskMapTarget & { leaseId: string }>();
  for (const record of group.records) {
    for (const target of getDeskMapTargetsForLease(record.id)) {
      const existing = byNode.get(target.parentNodeId);
      if (!existing || (!existing.leaseNodeId && target.leaseNodeId)) {
        byNode.set(target.parentNodeId, { ...target, leaseId: record.id });
      }
    }
  }
  return [...byNode.values()].sort((left, right) => {
    if (left.leaseNodeId && !right.leaseNodeId) return -1;
    if (!left.leaseNodeId && right.leaseNodeId) return 1;
    const byName = left.deskMapName.localeCompare(right.deskMapName);
    return byName !== 0 ? byName : left.parentNodeLabel.localeCompare(right.parentNodeLabel);
  });
}

interface OwnerLeasesTabProps {
  workspaceId: string;
  ownerId: string;
  leases: Lease[];
  onAdd: (lease: Lease) => Promise<void>;
  onUpdate: (id: string, fields: Partial<Lease>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  getDeskMapTargetsForLease: (leaseId: string) => OwnerLeaseDeskMapTarget[];
  onOpenDeskMapLeaseTarget: (
    lease: Lease,
    target: OwnerLeaseDeskMapTarget
  ) => void;
  readOnly?: boolean;
}

export default function OwnerLeasesTab({
  workspaceId,
  ownerId,
  leases,
  onAdd,
  onUpdate,
  onRemove,
  getDeskMapTargetsForLease,
  onOpenDeskMapLeaseTarget,
  readOnly = false,
}: OwnerLeasesTabProps) {
  const { confirm: requestConfirmation } = useConfirmation();
  const [draft, setDraft] = useState<Lease | null>(null);
  // When editing a collapsed group of duplicate records, the instrument fields
  // are applied to ALL of them on save so they stay collapsed (null = single).
  const [editingGroupIds, setEditingGroupIds] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const leaseGroups = useMemo(() => groupLeasesByInstrument(leases), [leases]);
  // Suggest lessees from every lease in the project, not just this owner's
  // (the `leases` prop is owner-filtered).
  const allLeases = useOwnerStore((state) => state.leases);
  const lesseeSuggestions = useMemo(
    () => distinctLesseeNames(allLeases),
    [allLeases]
  );

  const beginAdd = () => {
    if (readOnly) return;
    setSaveError(null);
    setEditingGroupIds(null);
    setDraft(createBlankLease(workspaceId, ownerId));
  };

  const beginEditGroup = (group: LeaseInstrumentGroup) => {
    if (readOnly) return;
    setSaveError(null);
    // Edit applies to every record in a collapsed group so they stay one card.
    setEditingGroupIds(group.records.length > 1 ? group.records.map((record) => record.id) : null);
    setDraft(normalizeLease(group.primary, { workspaceId, ownerId }));
  };

  const set = (field: keyof Lease, value: string) => {
    setSaveError(null);
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const formatLeasedInterest = (value: string) => {
    const normalized = normalizeInterestString(value);
    if (!normalized) {
      return null;
    }

    return formatAsFraction(d(parseInterestString(normalized)));
  };

  const statusOptions = draft
    ? (isLeaseStatusOption(draft.status)
      ? [...LEASE_STATUS_OPTIONS]
      : [draft.status, ...LEASE_STATUS_OPTIONS])
    : [...LEASE_STATUS_OPTIONS];

  return (
    <div className="space-y-4">
      {draft ? (
        <div className="rounded-md border border-ledger-line bg-ledger p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Lease Name"
              value={draft.leaseName}
              onChange={(value) => set('leaseName', value)}
              disabled={readOnly}
            />
            <FormField
              label="Lessee"
              value={draft.lessee}
              onChange={(value) => set('lessee', value)}
              disabled={readOnly}
              suggestions={lesseeSuggestions}
            />
            <FormField
              label="Royalty"
              value={draft.royaltyRate}
              onChange={(value) => set('royaltyRate', value)}
              disabled={readOnly}
            />
            <FormField
              label="Leased Interest"
              value={draft.leasedInterest}
              onChange={(value) => set('leasedInterest', value)}
              disabled={readOnly}
            />
            <FormField
              label="Effective Date"
              type="date"
              value={draft.effectiveDate}
              onChange={(value) => set('effectiveDate', value)}
              disabled={readOnly}
            />
            <FormField
              label="Expiration Date"
              type="date"
              value={draft.expirationDate}
              onChange={(value) => set('expirationDate', value)}
              disabled={readOnly}
            />
            <div>
              <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                Status
              </label>
              <select
                value={draft.status}
                disabled={readOnly}
                onChange={(event) => set('status', event.target.value)}
                className="w-full px-3 py-2 rounded-md border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {isLeaseStatusOption(status) ? status : `${status} (legacy)`}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              label="Doc #"
              value={draft.docNo}
              onChange={(value) => set('docNo', value)}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Notes
            </label>
            <textarea
              value={draft.notes}
              disabled={readOnly}
              onChange={(event) => set('notes', event.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-md border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {saveError && (
            <div className="rounded-md border border-seal/30 bg-seal/10 px-3 py-2 text-xs text-seal">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setSaveError(null);
                setEditingGroupIds(null);
                setDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={readOnly || saving}
              onClick={async () => {
                if (readOnly) return;
                // Strict-parse both interest fields BEFORE saving. A blank value is a
                // legal "not entered yet" state and parses as Decimal(0); a typo like
                // "abc" or "1/0" returns null and blocks the save with an inline error.
                // This closes audit finding #4 — the silent-zero bug on malformed input.
                const parsedRoyalty = parseStrictInterestString(draft.royaltyRate);
                if (parsedRoyalty === null) {
                  setSaveError(
                    'Royalty must be a fraction (e.g. 1/8), a decimal (e.g. 0.125), or blank.'
                  );
                  return;
                }
                const parsedLeasedInterest = parseStrictInterestString(draft.leasedInterest);
                if (parsedLeasedInterest === null) {
                  setSaveError(
                    'Leased Interest must be a fraction (e.g. 1/2), a decimal (e.g. 0.5), or blank.'
                  );
                  return;
                }

                setSaveError(null);
                setSaving(true);
                // Preserve the user's raw royalty text (1/8 stays 1/8, not 0.125) — the
                // parse above is a validator only. Leased Interest normalizes to a
                // serialized decimal to match existing storage format.
                const trimmedLeasedInterest = draft.leasedInterest.trim();
                const normalizedDraft = {
                  ...draft,
                  royaltyRate: draft.royaltyRate.trim(),
                  leasedInterest: trimmedLeasedInterest.length === 0
                    ? ''
                    : serialize(parsedLeasedInterest),
                };
                if (editingGroupIds && editingGroupIds.length > 1) {
                  // Apply the instrument fields to every collapsed record so the
                  // group stays a single card (ids/owner/workspace untouched).
                  const instrumentFields: Partial<Lease> = {};
                  for (const field of LEASE_INSTRUMENT_FIELDS) {
                    instrumentFields[field] = normalizedDraft[field];
                  }
                  await Promise.all(
                    editingGroupIds.map((id) => onUpdate(id, instrumentFields))
                  );
                } else if (leases.some((lease) => lease.id === draft.id)) {
                  await onUpdate(draft.id, normalizedDraft);
                } else {
                  await onAdd(normalizedDraft);
                }
                setSaving(false);
                setEditingGroupIds(null);
                setDraft(null);
              }}
              title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
            >
              {saving ? 'Saving...' : 'Save Lease'}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={readOnly}
          onClick={beginAdd}
          title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
          className="px-3 py-2 rounded-md text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add Lease
        </button>
      )}

      <div className="space-y-3">
        {leases.length === 0 && (
          <div className="rounded-md border border-dashed border-ledger-line px-4 py-5 text-sm text-ink-light">
            No leases linked to this owner yet.
          </div>
        )}

        {leaseGroups.map((group) => {
          const lease = group.primary;
          const recordCount = group.records.length;
          const deskMapTargets = unionGroupDeskMapTargets(group, getDeskMapTargetsForLease);
          return (
            <div
              key={group.key}
              className="rounded-md border border-ledger-line bg-parchment px-4 py-3"
            >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-ink">
                    {lease.leaseName || lease.lessee || 'Untitled Lease'}
                  </div>
                  {recordCount > 1 && (
                    <span className="px-2 py-0.5 rounded-full bg-leather/10 text-[10px] font-semibold text-leather">
                      {recordCount} tracts
                    </span>
                  )}
                </div>
                <div className="text-xs text-ink-light">
                  {lease.lessee ? `Lessee: ${lease.lessee}` : 'Lessee not recorded'}
                </div>
                {(lease.royaltyRate || lease.leasedInterest) && (
                  <div className="text-xs text-ink-light">
                    {[
                      lease.royaltyRate ? `Royalty ${lease.royaltyRate}` : '',
                      lease.leasedInterest
                        ? `Leased ${formatLeasedInterest(lease.leasedInterest)}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                )}
                <div className="text-xs text-ink-light">
                  {lease.effectiveDate || 'No effective date'}
                  {lease.expirationDate ? ` to ${lease.expirationDate}` : ''}
                </div>
                {(lease.status || lease.docNo) && (
                  <div className="text-[11px] text-ink-light">
                    {[lease.status, lease.docNo ? `Doc #${lease.docNo}` : '']
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                )}
                {lease.notes && (
                  <div className="text-sm text-ink whitespace-pre-wrap">{lease.notes}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => beginEditGroup(group)}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-leather hover:bg-leather/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={async () => {
                    if (readOnly) return;
                    const confirmed = await requestConfirmation({
                      title: 'Delete Lease?',
                      message:
                        recordCount > 1
                          ? `Delete this lease across ${recordCount} tracts? Linked map/doc references will be cleared.`
                          : 'Delete this lease? Linked map/doc references will be cleared.',
                      confirmLabel: 'Delete Lease',
                      tone: 'danger',
                    });
                    if (!confirmed) return;
                    for (const record of group.records) {
                      await onRemove(record.id);
                    }
                  }}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold text-seal hover:bg-seal/10 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-ledger-line/70">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-light">
                Desk Map Lease Node
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {deskMapTargets.length > 0 ? (
                  deskMapTargets.map((target) => {
                    const owningLease =
                      group.records.find((record) => record.id === target.leaseId) ?? lease;
                    return (
                      <button
                        key={`${group.key}-${target.parentNodeId}`}
                        type="button"
                        disabled={readOnly && !target.leaseNodeId}
                        onClick={() => onOpenDeskMapLeaseTarget(owningLease, target)}
                        title={
                          readOnly && !target.leaseNodeId
                            ? READ_ONLY_WORKSPACE_EDIT_TITLE
                            : undefined
                        }
                        className="px-3 py-1.5 rounded-md text-xs font-semibold text-emerald-900 hover:bg-emerald-100 border border-emerald-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {target.leaseNodeId ? 'Open' : 'Create'} {target.parentNodeLabel} — {target.deskMapName}
                      </button>
                    );
                  })
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-ink-light border border-ledger-line opacity-70 cursor-not-allowed"
                  >
                    Link Owner In Desk Map First
                  </button>
                )}
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
