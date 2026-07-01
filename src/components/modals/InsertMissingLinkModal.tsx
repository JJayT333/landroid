/**
 * Insert / Resolve Missing Link modal.
 *
 * A Missing Link is a placeholder bridge for an UNPROVEN gap in the chain of
 * title ("grandma → ??? → grandson"). This modal does two jobs:
 *
 *  - INSERT (mode 'insert'): collect the known parties, what is missing, an
 *    optional note, and the passthrough mode, then call insertMissingLink to
 *    drop a `provenance: 'placeholder'` bridge above the active node. There is
 *    deliberately NO fraction field — a placeholder is a full pass-through and
 *    the engine never fabricates a fraction below it.
 *
 *  - RESOLVE (mode 'resolve'): once the link is proven, collect the real
 *    instrument + party fields and call resolveMissingLink to promote the
 *    placeholder to a recorded node and close the linked High title issue.
 *
 * Modeled on PredecessorModal so it reads like the rest of the desk.
 */
import { useState } from 'react';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { OwnershipNode, PlaceholderMissing, PlaceholderPassthrough } from '../../types/node';

type Mode = 'insert' | 'resolve';

interface InsertMissingLinkModalProps {
  /** The node this Missing Link sits above (insert) or the placeholder (resolve). */
  node: OwnershipNode;
  mode: Mode;
  onClose: () => void;
}

const MISSING_OPTIONS: ReadonlyArray<{ value: PlaceholderMissing; label: string }> = [
  { value: 'both', label: 'Both — the person and the instrument' },
  { value: 'person', label: 'The person / heir' },
  { value: 'instrument', label: 'The recorded instrument' },
];

export default function InsertMissingLinkModal({
  node,
  mode,
  onClose,
}: InsertMissingLinkModalProps) {
  const insertMissingLink = useWorkspaceStore((s) => s.insertMissingLink);
  const resolveMissingLink = useWorkspaceStore((s) => s.resolveMissingLink);

  // Insert form: parties + triage. No fraction field by design.
  const [insertForm, setInsertForm] = useState({
    // On insert the link sits ABOVE `node`, so the link's grantee is this node's
    // grantor (the known downstream party), mirroring PredecessorModal.
    grantor: '',
    grantee: node.grantor || '',
    placeholderMissing: 'both' as PlaceholderMissing,
    placeholderPassthrough: 'indeterminate' as PlaceholderPassthrough,
    remarks: '',
  });

  // Resolve form: the real recorded instrument + parties now that the link is
  // proven. Pre-filled from whatever the placeholder already carried.
  const [resolveForm, setResolveForm] = useState({
    instrument: node.instrument,
    date: node.date,
    fileDate: node.fileDate,
    grantor: node.grantor,
    grantee: node.grantee,
    vol: node.vol,
    page: node.page,
    docNo: node.docNo,
  });

  const [error, setError] = useState<string | null>(null);

  const setInsert = (field: keyof typeof insertForm, value: string) =>
    setInsertForm((f) => ({ ...f, [field]: value }));
  const setResolve = (field: keyof typeof resolveForm, value: string) =>
    setResolveForm((f) => ({ ...f, [field]: value }));

  const handleInsert = () => {
    setError(null);
    const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const success = insertMissingLink(node.id, newId, {
      grantor: insertForm.grantor,
      grantee: insertForm.grantee,
      placeholderMissing: insertForm.placeholderMissing,
      placeholderPassthrough: insertForm.placeholderPassthrough,
      remarks: insertForm.remarks,
    });
    if (!success) {
      setError(useWorkspaceStore.getState().lastError || 'Insert missing link failed');
      return;
    }
    onClose();
  };

  const handleResolve = () => {
    setError(null);
    const success = resolveMissingLink(node.id, {
      instrument: resolveForm.instrument,
      date: resolveForm.date,
      fileDate: resolveForm.fileDate,
      grantor: resolveForm.grantor,
      grantee: resolveForm.grantee,
      vol: resolveForm.vol,
      page: resolveForm.page,
      docNo: resolveForm.docNo,
    });
    if (!success) {
      setError(useWorkspaceStore.getState().lastError || 'Resolve missing link failed');
      return;
    }
    onClose();
  };

  if (mode === 'resolve') {
    return (
      <Modal open onClose={onClose} title="Resolve Missing Link — Promote to Recorded">
        <div className="space-y-4">
          <div className="rounded-md border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-800">
            You are promoting this <span className="font-semibold">Missing Link</span> to a
            recorded node. Enter the real instrument now that the link is proven. The
            High "Missing link" title issue closes and the branch below resumes payout.
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-light">
              Recorded Instrument
            </legend>
            <div className="grid grid-cols-2 gap-2">
              <InstrumentSelect value={resolveForm.instrument} onChange={(v) => setResolve('instrument', v)} />
              <FormField label="Doc #" value={resolveForm.docNo} onChange={(v) => setResolve('docNo', v)} />
              <FormField label="Grantor" value={resolveForm.grantor} onChange={(v) => setResolve('grantor', v)} />
              <FormField label="Grantee" value={resolveForm.grantee} onChange={(v) => setResolve('grantee', v)} />
              <FormField label="Vol." value={resolveForm.vol} onChange={(v) => setResolve('vol', v)} />
              <FormField label="Page" value={resolveForm.page} onChange={(v) => setResolve('page', v)} />
              <FormField label="File Date" value={resolveForm.fileDate} onChange={(v) => setResolve('fileDate', v)} type="date" />
              <FormField label="Inst. Date" value={resolveForm.date} onChange={(v) => setResolve('date', v)} type="date" />
            </div>
          </fieldset>

          {error && (
            <div className="rounded-md border border-seal/30 bg-seal/10 p-3 text-sm text-seal">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-ledger-line pt-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleResolve}>Promote to Recorded</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title={`Insert Missing Link above ${node.grantee || 'Unknown'}`}>
      <div className="space-y-4">
        <div className="rounded-md border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-800">
          A <span className="font-semibold">Missing Link</span> marks an UNPROVEN gap in the
          chain — an heirship or deed you cannot yet establish. It renders distinctly and is
          never mistaken for real title. No fraction is entered: the engine never fabricates
          an interest below an unproven link.
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-light">
            Known Parties
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Known Grantor (optional)"
              value={insertForm.grantor}
              onChange={(v) => setInsert('grantor', v)}
            />
            <FormField
              label="Known Grantee (optional)"
              value={insertForm.grantee}
              onChange={(v) => setInsert('grantee', v)}
            />
          </div>
          <p className="text-[10px] text-ink-light">
            Leave a party blank if it is unknown — the card shows "??? — missing link".
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-light">
            What's Missing
          </legend>
          <div className="flex flex-col gap-1">
            {MISSING_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="missing-link-missing"
                  value={option.value}
                  checked={insertForm.placeholderMissing === option.value}
                  onChange={() => setInsert('placeholderMissing', option.value)}
                  className="accent-amber-600"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-light">
            Interest Below the Link
          </legend>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="missing-link-passthrough"
              value="indeterminate"
              checked={insertForm.placeholderPassthrough === 'indeterminate'}
              onChange={() => setInsert('placeholderPassthrough', 'indeterminate')}
              className="mt-0.5 accent-amber-600"
            />
            <span>
              <span className="font-semibold">Indeterminate</span> (default) — nothing is
              computed past the link; the branch below shows "pending" and is held from payout.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="radio"
              name="missing-link-passthrough"
              value="assume"
              checked={insertForm.placeholderPassthrough === 'assume'}
              onChange={() => setInsert('placeholderPassthrough', 'assume')}
              className="mt-0.5 accent-amber-600"
            />
            <span>
              <span className="font-semibold">Assume pass-through</span> — working estimate:
              compute and show the numbers below, but every figure stays flagged "subject to
              unproven link" and is still held from payout.
            </span>
          </label>
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-xs font-semibold uppercase tracking-wider text-ink-light">
            Note (optional)
          </legend>
          <textarea
            value={insertForm.remarks}
            onChange={(e) => setInsert('remarks', e.target.value)}
            rows={2}
            placeholder="e.g. heirship presumed; locating the probate / deed"
            className="w-full rounded-md border border-ledger-line bg-parchment px-3 py-2 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather"
          />
        </fieldset>

        {error && (
          <div className="rounded-md border border-seal/30 bg-seal/10 p-3 text-sm text-seal">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-ledger-line pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleInsert}>Insert Missing Link</Button>
        </div>
      </div>
    </Modal>
  );
}
