/**
 * Predecessor insert modal — insert a predecessor node above an existing node.
 */
import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { useWorkspaceStore } from '../../store/workspace-store';
import { formatAsFraction } from '../../engine/fraction-display';
import { d } from '../../engine/decimal';
import type { OwnershipNode } from '../../types/node';

interface PredecessorModalProps {
  node: OwnershipNode;
  onClose: () => void;
}

export default function PredecessorModal({ node, onClose }: PredecessorModalProps) {
  const insertPredecessor = useWorkspaceStore((s) => s.insertPredecessor);

  const [form, setForm] = useState({
    instrument: '',
    date: '',
    fileDate: '',
    grantor: '',
    grantee: node.grantor || '',
    vol: '',
    page: '',
    docNo: '',
    newInitialFraction: node.initialFraction,
  });

  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const currentFrac = formatAsFraction(d(node.initialFraction));
  const newFrac = formatAsFraction(d(form.newInitialFraction));
  const willScale = form.newInitialFraction !== node.initialFraction;

  const handleSave = () => {
    setError(null);

    const newPredId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const success = insertPredecessor(node.id, newPredId, form.newInitialFraction, {
      instrument: form.instrument,
      date: form.date,
      fileDate: form.fileDate,
      grantor: form.grantor,
      grantee: form.grantee,
      vol: form.vol,
      page: form.page,
      docNo: form.docNo,
    });

    if (!success) {
      setError(useWorkspaceStore.getState().lastError || 'Insert predecessor failed');
      return;
    }

    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Insert Predecessor above ${node.grantee || 'Unknown'}`}>
      <div className="space-y-4">
        <div className="bg-ledger rounded-lg p-3 text-xs text-ink-light">
          <span className="uppercase tracking-wider">Current node interest: </span>
          <span className="font-mono font-semibold text-ink">{currentFrac}</span>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Predecessor Info
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <InstrumentSelect value={form.instrument} onChange={(v) => set('instrument', v)} />
            <FormField label="Doc #" value={form.docNo} onChange={(v) => set('docNo', v)} />
            <FormField label="Grantor" value={form.grantor} onChange={(v) => set('grantor', v)} />
            <FormField label="Grantee" value={form.grantee} onChange={(v) => set('grantee', v)} />
            <FormField label="File Date" value={form.fileDate} onChange={(v) => set('fileDate', v)} type="date" />
            <FormField label="Inst. Date" value={form.date} onChange={(v) => set('date', v)} type="date" />
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Predecessor's Interest
          </legend>
          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Interest of Whole Tract
            </label>
            <input
              type="text"
              value={form.newInitialFraction}
              onChange={(e) => set('newInitialFraction', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-ink font-mono text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            />
            <div className="text-[10px] text-ink-light mt-1 font-mono">= {newFrac}</div>
          </div>

          {willScale && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-2 text-xs text-ink">
              <span className="font-semibold">Cascade:</span> The current node and all
              its descendants will be scaled to fit under this new predecessor's interest.
            </div>
          )}
        </fieldset>

        {error && (
          <div className="bg-seal/10 border border-seal/30 rounded-lg p-3 text-sm text-seal">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-leather text-parchment hover:bg-leather-light transition-colors"
          >
            Insert Predecessor
          </button>
        </div>
      </div>
    </Modal>
  );
}
