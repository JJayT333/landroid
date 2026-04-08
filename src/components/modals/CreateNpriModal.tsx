import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { d, serialize } from '../../engine/decimal';
import { formatAsFraction } from '../../engine/fraction-display';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { OwnershipNode, RoyaltyKind } from '../../types/node';

interface CreateNpriModalProps {
  parentNode: OwnershipNode;
  onClose: () => void;
}

function buildPreviewShare(
  numerator: string,
  denominator: string
): { share: string; formatted: string } {
  const num = d(numerator);
  const denom = d(denominator);
  const share = denom.greaterThan(0) ? num.div(denom) : d(0);
  return {
    share: serialize(share),
    formatted: formatAsFraction(share),
  };
}

export default function CreateNpriModal({
  parentNode,
  onClose,
}: CreateNpriModalProps) {
  const createNpri = useWorkspaceStore((state) => state.createNpri);

  const [form, setForm] = useState({
    instrument: 'Royalty Deed',
    date: '',
    fileDate: '',
    grantor: parentNode.grantee,
    grantee: '',
    vol: '',
    page: '',
    docNo: '',
    landDesc: parentNode.landDesc,
    remarks: '',
    royaltyKind: 'fixed' as RoyaltyKind,
    numerator: '1',
    denominator: '16',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const preview = buildPreviewShare(form.numerator, form.denominator);
  const previewLabel =
    form.royaltyKind === 'floating' ? 'of lease royalty' : 'fixed royalty';

  const handleSave = () => {
    setError(null);

    if (!form.grantee.trim()) {
      setError('Grantee is required');
      return;
    }

    const denominator = d(form.denominator);
    if (!denominator.greaterThan(0)) {
      setError('Denominator must be greater than zero');
      return;
    }

    const share = d(preview.share);
    if (!share.greaterThan(0)) {
      setError('NPRI share must be greater than zero');
      return;
    }
    if (share.greaterThan(1)) {
      setError('NPRI share cannot exceed the full royalty interest');
      return;
    }

    const newNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const success = createNpri(parentNode.id, newNodeId, preview.share, {
      instrument: form.instrument,
      date: form.date,
      fileDate: form.fileDate,
      grantor: form.grantor,
      grantee: form.grantee,
      vol: form.vol,
      page: form.page,
      docNo: form.docNo,
      landDesc: form.landDesc,
      remarks: form.remarks,
      numerator: form.numerator,
      denominator: form.denominator,
      interestClass: 'npri',
      royaltyKind: form.royaltyKind,
    });

    if (!success) {
      setError(useWorkspaceStore.getState().lastError || 'NPRI creation failed');
      return;
    }

    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Create NPRI from ${parentNode.grantee || 'Owner'}`} wide>
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-950">
          This creates a separate NPRI branch on Desk Map without reducing the mineral ownership totals.
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Parties & Document
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Grantor" value={form.grantor} onChange={(value) => set('grantor', value)} />
            <FormField label="Grantee" value={form.grantee} onChange={(value) => set('grantee', value)} />
            <InstrumentSelect value={form.instrument} onChange={(value) => set('instrument', value)} />
            <FormField label="Doc #" value={form.docNo} onChange={(value) => set('docNo', value)} />
            <FormField label="File Date" value={form.fileDate} onChange={(value) => set('fileDate', value)} type="date" />
            <FormField label="Inst. Date" value={form.date} onChange={(value) => set('date', value)} type="date" />
            <FormField label="Volume" value={form.vol} onChange={(value) => set('vol', value)} />
            <FormField label="Page" value={form.page} onChange={(value) => set('page', value)} />
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            NPRI Terms
          </legend>

          <div className="flex gap-2">
            {([
              ['fixed', 'Fixed NPRI'],
              ['floating', 'Floating NPRI'],
            ] as const).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => set('royaltyKind', kind)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.royaltyKind === kind
                    ? 'bg-amber-700 text-amber-50'
                    : 'text-amber-900 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-2 text-xs text-ink-light">
            {form.royaltyKind === 'floating'
              ? 'Floating NPRI records a fraction of the lease royalty, such as 1/2 of lessor royalty.'
              : 'Fixed NPRI records a fixed share of production, such as 1/16.'}
            <div className="mt-1 text-ink-light/80">
              Deed-text preservation only — NPRI nodes are excluded from
              today&rsquo;s leasehold decimal math, so the fixed/floating
              choice is recorded on the node but does not yet change any
              computed royalty.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={form.numerator}
              onChange={(event) => set('numerator', event.target.value)}
              className="w-20 px-3 py-1.5 rounded-lg border border-ledger-line bg-parchment text-ink font-mono text-sm text-center focus:ring-2 focus:ring-leather outline-none"
            />
            <span className="text-ink-light text-lg">/</span>
            <input
              type="text"
              value={form.denominator}
              onChange={(event) => set('denominator', event.target.value)}
              className="w-20 px-3 py-1.5 rounded-lg border border-ledger-line bg-parchment text-ink font-mono text-sm text-center focus:ring-2 focus:ring-leather outline-none"
            />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                Recorded Burden
              </span>
              <span className="text-sm font-mono font-semibold text-amber-950">
                {preview.formatted}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-amber-900/80">
              Stored on Desk Map as {preview.formatted} {previewLabel}.
            </div>
          </div>
        </fieldset>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Remarks
          </label>
          <textarea
            value={form.remarks}
            onChange={(event) => set('remarks', event.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
        </div>

        {error && (
          <div className="bg-seal/10 border border-seal/30 rounded-lg p-3 text-sm text-seal">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-700 text-amber-50 hover:bg-amber-800 transition-colors"
          >
            Create NPRI
          </button>
        </div>
      </div>
    </Modal>
  );
}
