/**
 * Node edit modal — edit document metadata and ownership fractions.
 *
 * KEY BEHAVIOR: If the user changes initialFraction, saving triggers
 * executeRebalance which cascades to ALL descendants. If only metadata
 * changes, it's a simple updateNode with no cascade.
 */
import { useRef, useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { useWorkspaceStore } from '../../store/workspace-store';
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import { savePdf, deletePdf } from '../../storage/pdf-store';
import type { OwnershipNode } from '../../types/node';

interface NodeEditModalProps {
  node: OwnershipNode;
  onViewPdf?: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeEditModal({ node, onClose, onViewPdf }: NodeEditModalProps) {
  const updateNode = useWorkspaceStore((s) => s.updateNode);
  const rebalance = useWorkspaceStore((s) => s.rebalance);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    instrument: node.instrument,
    date: node.date,
    fileDate: node.fileDate,
    grantor: node.grantor,
    grantee: node.grantee,
    vol: node.vol,
    page: node.page,
    docNo: node.docNo,
    landDesc: node.landDesc,
    remarks: node.remarks,
    initialFraction: node.initialFraction,
    isDeceased: node.isDeceased,
    obituary: node.obituary,
    graveyardLink: node.graveyardLink,
  });

  const [error, setError] = useState<string | null>(null);

  const initialChanged = form.initialFraction !== node.initialFraction;
  const previewFrac = formatAsFraction(d(form.initialFraction));
  const oldFrac = formatAsFraction(d(node.initialFraction));

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = () => {
    setError(null);

    if (initialChanged) {
      const { initialFraction, ...otherFields } = form;
      const success = rebalance(node.id, initialFraction, otherFields);
      if (!success) {
        setError(useWorkspaceStore.getState().lastError || 'Rebalance failed');
        return;
      }
    } else {
      updateNode(node.id, form);
    }

    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Edit Node" wide>
      <div className="space-y-4">
        {/* Document info */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Document
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <InstrumentSelect
              value={form.instrument}
              onChange={(v) => set('instrument', v)}
            />
            <FormField label="Doc #" value={form.docNo} onChange={(v) => set('docNo', v)} />
            <FormField label="File Date" value={form.fileDate} onChange={(v) => set('fileDate', v)} type="date" />
            <FormField label="Inst. Date" value={form.date} onChange={(v) => set('date', v)} type="date" />
            <FormField label="Volume" value={form.vol} onChange={(v) => set('vol', v)} />
            <FormField label="Page" value={form.page} onChange={(v) => set('page', v)} />
          </div>
        </fieldset>

        {/* Parties */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Parties
          </legend>
          <FormField label="Grantor" value={form.grantor} onChange={(v) => set('grantor', v)} />
          <FormField label="Grantee" value={form.grantee} onChange={(v) => set('grantee', v)} />
        </fieldset>

        {/* Ownership — THE KEY FIELD */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Ownership Interest
          </legend>

          <div className="bg-ledger rounded-lg p-3 space-y-2">
            <div>
              <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                Interest of Whole Tract
              </label>
              <input
                type="text"
                value={form.initialFraction}
                onChange={(e) => set('initialFraction', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink font-mono text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
              />
              <div className="text-[10px] text-ink-light mt-1 font-mono">
                = {previewFrac}
              </div>
            </div>

            {initialChanged && (
              <div className="bg-gold/10 border border-gold/30 rounded-lg p-2 text-xs text-ink">
                <span className="font-semibold">Cascade warning:</span> Changing
                from {oldFrac} to {previewFrac} will scale ALL descendants
                by factor {(() => {
                  const oldD = d(node.initialFraction);
                  const newD = d(form.initialFraction);
                  if (oldD.isZero()) return 'N/A';
                  return newD.div(oldD).toFixed(6);
                })()}
              </div>
            )}

            <div className="text-[10px] text-ink-light">
              <span className="uppercase tracking-wider">Remaining: </span>
              <span className="font-mono font-semibold">
                {formatAsFraction(d(node.fraction))}
              </span>
              <span className="ml-2 text-ink-light/60">(calculated, not editable)</span>
            </div>
          </div>
        </fieldset>

        {/* Land description */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Land & Notes
          </legend>
          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Land Description
            </label>
            <textarea
              value={form.landDesc}
              onChange={(e) => set('landDesc', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>
          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Remarks
            </label>
            <textarea
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>
        </fieldset>

        {/* Death info */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Status
          </legend>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDeceased}
              onChange={(e) => set('isDeceased', e.target.checked)}
              className="rounded border-ledger-line text-leather focus:ring-leather"
            />
            Deceased
          </label>
          {form.isDeceased && (
            <>
              <FormField label="Obituary / Death Notes" value={form.obituary} onChange={(v) => set('obituary', v)} />
              <FormField label="Find A Grave Link" value={form.graveyardLink} onChange={(v) => set('graveyardLink', v)} />
            </>
          )}
        </fieldset>

        {/* PDF attachment */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Attached PDF
          </legend>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await savePdf(node.id, file);
              updateNode(node.id, { hasDoc: true });
              e.target.value = '';
            }}
          />
          <div className="flex items-center gap-2">
            {node.hasDoc ? (
              <>
                <button
                  type="button"
                  onClick={() => onViewPdf?.(node.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
                >
                  View PDF
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await deletePdf(node.id);
                    updateNode(node.id, { hasDoc: false });
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-seal hover:bg-seal/10 transition-colors"
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-ledger-line transition-colors"
              >
                Attach PDF
              </button>
            )}
          </div>
        </fieldset>

        {/* Error display */}
        {error && (
          <div className="bg-seal/10 border border-seal/30 rounded-lg p-3 text-sm text-seal">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-parchment transition-colors ${
              initialChanged
                ? 'bg-gold hover:bg-gold-light'
                : 'bg-leather hover:bg-leather-light'
            }`}
          >
            {initialChanged ? 'Save & Rebalance' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
