/**
 * Conveyance modal — create a new conveyance from a parent node.
 *
 * The user enters the grantee, instrument info, and the conveyance amount.
 * Supports three modes: fraction of parent's interest, fixed amount, or all remaining.
 */
import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { useWorkspaceStore } from '../../store/workspace-store';
import { calculateShare } from '../../engine/math-engine';
import { formatAsFraction } from '../../engine/fraction-display';
import { d, serialize } from '../../engine/decimal';
import {
  getInterestClass,
  type OwnershipNode,
  type ConveyanceMode,
  type SplitBasis,
} from '../../types/node';

interface ConveyModalProps {
  parentNode: OwnershipNode;
  onClose: () => void;
}

export default function ConveyModal({ parentNode, onClose }: ConveyModalProps) {
  const convey = useWorkspaceStore((s) => s.convey);
  const interestClass = getInterestClass(parentNode);
  const isNpriParent = interestClass === 'npri';

  const [form, setForm] = useState({
    instrument: isNpriParent ? 'Royalty Deed' : '',
    date: '',
    fileDate: '',
    grantor: parentNode.grantee,
    grantee: '',
    vol: '',
    page: '',
    docNo: '',
    landDesc: parentNode.landDesc,
    remarks: '',
    conveyanceMode: 'fraction' as ConveyanceMode,
    splitBasis: 'initial' as SplitBasis,
    numerator: '1',
    denominator: '2',
    manualAmount: '0',
  });

  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const previewShare = calculateShare({
    conveyanceMode: form.conveyanceMode,
    splitBasis: form.splitBasis,
    numerator: form.numerator,
    denominator: form.denominator,
    manualAmount: form.manualAmount,
    parentFraction: parentNode.fraction,
    parentInitialFraction: parentNode.initialFraction,
  });
  const previewFrac = formatAsFraction(previewShare);
  const parentRemaining = formatAsFraction(d(parentNode.fraction));
  const fixedNpriLabel =
    parentNode.fixedRoyaltyBasis === 'whole_tract'
      ? 'Grantor remaining whole-tract fixed burden'
      : 'Grantor remaining branch-based fixed burden';
  const parentRemainingLabel = isNpriParent
    ? parentNode.royaltyKind === 'floating'
      ? 'Grantor remaining lease royalty'
      : fixedNpriLabel
    : 'Grantor remaining';

  const handleSave = () => {
    setError(null);

    if (!form.grantee.trim()) {
      setError('Grantee is required');
      return;
    }

    const share = serialize(previewShare);
    const newNodeId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const success = convey(parentNode.id, newNodeId, share, {
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
      conveyanceMode: form.conveyanceMode,
      splitBasis: form.splitBasis,
      numerator: form.numerator,
      denominator: form.denominator,
      manualAmount: form.manualAmount,
    });

    if (!success) {
      setError(useWorkspaceStore.getState().lastError || 'Conveyance failed');
      return;
    }

    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${isNpriParent ? 'Convey NPRI from' : 'Convey from'} ${parentNode.grantee || 'Unknown'}`}
      wide
    >
      <div className="space-y-4">
        {/* Parent info */}
        <div className="bg-ledger rounded-lg p-3 text-xs text-ink-light">
          <span className="uppercase tracking-wider">{parentRemainingLabel}: </span>
          <span className="font-mono font-semibold text-ink">{parentRemaining}</span>
        </div>

        {/* Parties & Document */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Parties & Document
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Grantor" value={form.grantor} onChange={(v) => set('grantor', v)} />
            <FormField label="Grantee" value={form.grantee} onChange={(v) => set('grantee', v)} />
            <InstrumentSelect value={form.instrument} onChange={(v) => set('instrument', v)} />
            <FormField label="Doc #" value={form.docNo} onChange={(v) => set('docNo', v)} />
            <FormField label="File Date" value={form.fileDate} onChange={(v) => set('fileDate', v)} type="date" />
            <FormField label="Inst. Date" value={form.date} onChange={(v) => set('date', v)} type="date" />
            <FormField label="Volume" value={form.vol} onChange={(v) => set('vol', v)} />
            <FormField label="Page" value={form.page} onChange={(v) => set('page', v)} />
          </div>
        </fieldset>

        {/* Conveyance amount */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Conveyance Amount
          </legend>

          <div className="flex gap-2">
            {([
              ['fraction', 'Fraction'],
              ['fixed', 'Fixed Amount'],
              ['all', 'All Remaining'],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => set('conveyanceMode', mode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  form.conveyanceMode === mode
                    ? 'bg-leather text-parchment'
                    : 'text-ink-light hover:bg-parchment-dark border border-ledger-line'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.conveyanceMode === 'fraction' && (
            <>
              <div className="flex gap-2 items-center">
                <span className="text-[10px] text-ink-light uppercase tracking-wider">Of:</span>
                {([
                  ['initial', "Grantor's Full Interest"],
                  ['remaining', "Grantor's Remaining"],
                  ['whole', 'Whole Tract'],
                ] as const).map(([basis, label]) => (
                  <button
                    key={basis}
                    onClick={() => set('splitBasis', basis)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      form.splitBasis === basis
                        ? 'bg-leather/20 text-leather font-semibold'
                        : 'text-ink-light hover:bg-parchment-dark'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={form.numerator}
                  onChange={(e) => set('numerator', e.target.value)}
                  className="w-20 px-3 py-1.5 rounded-lg border border-ledger-line bg-parchment text-ink font-mono text-sm text-center focus:ring-2 focus:ring-leather outline-none"
                />
                <span className="text-ink-light text-lg">/</span>
                <input
                  type="text"
                  value={form.denominator}
                  onChange={(e) => set('denominator', e.target.value)}
                  className="w-20 px-3 py-1.5 rounded-lg border border-ledger-line bg-parchment text-ink font-mono text-sm text-center focus:ring-2 focus:ring-leather outline-none"
                />
              </div>
            </>
          )}

          {form.conveyanceMode === 'fixed' && (
            <FormField label="Fixed Amount (decimal)" value={form.manualAmount} onChange={(v) => set('manualAmount', v)} />
          )}

          <div className="bg-ledger rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-ink-light uppercase tracking-wider">
                {isNpriParent
                  ? parentNode.royaltyKind === 'floating'
                    ? 'Royalty share to convey'
                    : 'Fixed burden to convey'
                  : 'Amount to convey'}
              </span>
              <span className="font-mono font-semibold text-leather text-sm">
                {previewFrac}
              </span>
            </div>
          </div>
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
            {isNpriParent ? 'Convey NPRI' : 'Convey'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
