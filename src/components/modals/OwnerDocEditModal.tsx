import { useState } from 'react';
import Modal from '../shared/Modal';
import type { Lease, OwnerDoc, OwnerDocCategory } from '../../types/owner';
import { DOC_CATEGORY_OPTIONS } from '../../types/owner';

interface OwnerDocEditModalProps {
  doc: OwnerDoc;
  leases: Lease[];
  onClose: () => void;
  onPreview: () => void;
  onSave: (fields: {
    category: OwnerDocCategory;
    leaseId: string | null;
    notes: string;
  }) => void;
}

export default function OwnerDocEditModal({
  doc,
  leases,
  onClose,
  onPreview,
  onSave,
}: OwnerDocEditModalProps) {
  const [category, setCategory] = useState<OwnerDocCategory>(doc.category);
  const [leaseId, setLeaseId] = useState(doc.leaseId ?? '');
  const [notes, setNotes] = useState(doc.notes);

  return (
    <Modal open onClose={onClose} title="Edit Owner Document">
      <div className="space-y-4">
        <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-2">
          <div className="text-xs font-semibold text-ink">{doc.fileName}</div>
          <div className="text-[11px] text-ink-light">{doc.mimeType || 'Unknown type'}</div>
        </div>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as OwnerDocCategory)}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
          >
            {DOC_CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Lease
          </label>
          <select
            value={leaseId}
            onChange={(event) => setLeaseId(event.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
          >
            <option value="">Not linked</option>
            {leases.map((lease) => (
              <option key={lease.id} value={lease.id}>
                {lease.leaseName || lease.lessee || lease.docNo || lease.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-ledger-line">
          <button
            type="button"
            onClick={onPreview}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
          >
            Preview
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onSave({
                  category,
                  leaseId: leaseId || null,
                  notes,
                });
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
