/**
 * Conveyance modal — create a new conveyance from a parent node.
 *
 * The user enters the grantee, instrument info, and the conveyance amount.
 * Supports three modes: fraction of parent's interest, fixed amount, or all remaining.
 */
import { useState } from 'react';
import Button from '../shared/Button';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import InstrumentSelect from '../shared/InstrumentSelect';
import { useWorkspaceStore } from '../../store/workspace-store';
import { calculateShare } from '../../engine/math-engine';
import { formatAsFraction } from '../../engine/fraction-display';
import { d, serialize, Decimal } from '../../engine/decimal';
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

/**
 * DA-M1: detect over-conveyance. `calculateShare` no longer silently caps the
 * requested share at the grantor's remaining fraction, so the modal decides
 * whether the (uncapped) share exceeds what the grantor actually holds. A small
 * epsilon tolerates 9-decimal rounding so an exact-remainder conveyance does not
 * trip the warning.
 */
export function isOverConveyance(share: Decimal, parentFraction: string): boolean {
  return share.greaterThan(d(parentFraction).plus('1e-9'));
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
  // DA-M1: the engine no longer silently caps the share at the grantor's
  // remainder. Detect over-conveyance up front so the operator sees it (rather
  // than a generic engine rejection on save) and can convey the remainder.
  const overConveys = isOverConveyance(previewShare, parentNode.fraction);
  const fixedNpriLabel =
    parentNode.fixedRoyaltyBasis === 'whole_tract'
      ? 'Grantor remaining whole-tract fixed burden'
      : 'Grantor remaining branch-based fixed burden';
  const parentRemainingLabel = isNpriParent
    ? parentNode.royaltyKind === 'floating'
      ? 'Grantor remaining lease royalty'
      : fixedNpriLabel
    : 'Grantor remaining';

  // DA-M1: "Convey remainder instead" — switch to All Remaining mode, which
  // conveys exactly the grantor's remaining fraction.
  const handleConveyRemainder = () => {
    setForm((f) => ({ ...f, conveyanceMode: 'all' }));
  };

  const handleSave = () => {
    setError(null);

    if (!form.grantee.trim()) {
      setError('Grantee is required');
      return;
    }

    if (overConveys) {
      setError(
        `Requested ${previewFrac} exceeds ${parentRemainingLabel.toLowerCase()} of ${parentRemaining}. ` +
          'Reduce the amount or use "Convey remainder instead".'
      );
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
        <div className="bg-ledger rounded-md p-3 text-xs text-ink-light">
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
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
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
                  className="w-20 px-3 py-1.5 rounded-md border border-ledger-line bg-parchment text-ink font-mono text-sm text-center focus:ring-2 focus:ring-leather outline-none"
                />
                <span className="text-ink-light text-lg">/</span>
                <input
                  type="text"
                  value={form.denominator}
                  onChange={(e) => set('denominator', e.target.value)}
                  className="w-20 px-3 py-1.5 rounded-md border border-ledger-line bg-parchment text-ink font-mono text-sm text-center focus:ring-2 focus:ring-leather outline-none"
                />
              </div>
            </>
          )}

          {form.conveyanceMode === 'fixed' && (
            <FormField label="Fixed Amount (decimal)" value={form.manualAmount} onChange={(v) => set('manualAmount', v)} />
          )}

          <div className="bg-ledger rounded-md p-3">
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

        {overConveys && (
          <div
            className="border border-tint-amber-line bg-tint-amber rounded-md p-3 text-sm text-tint-amber-ink"
            role="alert"
          >
            <p>
              Requested <span className="font-mono font-semibold">{previewFrac}</span> exceeds{' '}
              {parentRemainingLabel.toLowerCase()} of{' '}
              <span className="font-mono font-semibold">{parentRemaining}</span>.
            </p>
            <button
              type="button"
              onClick={handleConveyRemainder}
              className="mt-2 rounded border border-tint-amber-line bg-white/60 px-2 py-1 text-xs font-semibold hover:bg-white"
            >
              Convey remainder ({parentRemaining}) instead
            </button>
          </div>
        )}

        {error && (
          <div className="bg-seal/10 border border-seal/30 rounded-md p-3 text-sm text-seal">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isNpriParent ? 'Convey NPRI' : 'Convey'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
