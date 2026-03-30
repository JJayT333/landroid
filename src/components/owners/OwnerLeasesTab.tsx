import { useState } from 'react';
import FormField from '../shared/FormField';
import { createBlankLease, normalizeLease, type Lease } from '../../types/owner';
import { d } from '../../engine/decimal';
import { formatAsFraction } from '../../engine/fraction-display';
import { normalizeInterestString, parseInterestString } from '../../utils/interest-string';

interface OwnerLeasesTabProps {
  workspaceId: string;
  ownerId: string;
  leases: Lease[];
  onAdd: (lease: Lease) => Promise<void>;
  onUpdate: (id: string, fields: Partial<Lease>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export default function OwnerLeasesTab({
  workspaceId,
  ownerId,
  leases,
  onAdd,
  onUpdate,
  onRemove,
}: OwnerLeasesTabProps) {
  const [draft, setDraft] = useState<Lease | null>(null);
  const [saving, setSaving] = useState(false);

  const beginAdd = () => {
    setDraft(createBlankLease(workspaceId, ownerId));
  };

  const beginEdit = (lease: Lease) => {
    setDraft(normalizeLease(lease, { workspaceId, ownerId }));
  };

  const set = (field: keyof Lease, value: string) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const formatLeasedInterest = (value: string) => {
    const normalized = normalizeInterestString(value);
    if (!normalized) {
      return null;
    }

    return formatAsFraction(d(parseInterestString(normalized)));
  };

  return (
    <div className="space-y-4">
      {draft ? (
        <div className="rounded-xl border border-ledger-line bg-ledger p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Lease Name"
              value={draft.leaseName}
              onChange={(value) => set('leaseName', value)}
            />
            <FormField
              label="Lessee"
              value={draft.lessee}
              onChange={(value) => set('lessee', value)}
            />
            <FormField
              label="Royalty"
              value={draft.royaltyRate}
              onChange={(value) => set('royaltyRate', value)}
            />
            <FormField
              label="Leased Interest"
              value={draft.leasedInterest}
              onChange={(value) => set('leasedInterest', value)}
            />
            <FormField
              label="Effective Date"
              type="date"
              value={draft.effectiveDate}
              onChange={(value) => set('effectiveDate', value)}
            />
            <FormField
              label="Expiration Date"
              type="date"
              value={draft.expirationDate}
              onChange={(value) => set('expirationDate', value)}
            />
            <FormField
              label="Status"
              value={draft.status}
              onChange={(value) => set('status', value)}
            />
            <FormField
              label="Doc #"
              value={draft.docNo}
              onChange={(value) => set('docNo', value)}
            />
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Notes
            </label>
            <textarea
              value={draft.notes}
              onChange={(event) => set('notes', event.target.value)}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-3 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const normalizedDraft = {
                  ...draft,
                  royaltyRate: draft.royaltyRate.trim(),
                  leasedInterest: normalizeInterestString(draft.leasedInterest),
                };
                if (leases.some((lease) => lease.id === draft.id)) {
                  await onUpdate(draft.id, normalizedDraft);
                } else {
                  await onAdd(normalizedDraft);
                }
                setSaving(false);
                setDraft(null);
              }}
              className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Lease'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={beginAdd}
          className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
        >
          + Add Lease
        </button>
      )}

      <div className="space-y-3">
        {leases.length === 0 && (
          <div className="rounded-lg border border-dashed border-ledger-line px-4 py-5 text-sm text-ink-light">
            No leases linked to this owner yet.
          </div>
        )}

        {leases.map((lease) => (
          <div
            key={lease.id}
            className="rounded-xl border border-ledger-line bg-parchment px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-ink">
                  {lease.leaseName || lease.lessee || 'Untitled Lease'}
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
                  onClick={() => beginEdit(lease)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('Delete this lease? Linked map/doc references will be cleared.')) {
                      return;
                    }
                    await onRemove(lease.id);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
