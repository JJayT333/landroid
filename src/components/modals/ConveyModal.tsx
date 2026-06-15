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
  type DoubleFractionBasis,
  type DoubleFractionClause,
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
    // Van Dyke double-fraction capture (off by default).
    isDoubleFraction: false,
    dfClauseText: '',
    dfOuterNum: '1',
    dfOuterDenom: '2',
    dfInnerNum: '1',
    dfInnerDenom: '8',
    dfBasis: 'presumption' as DoubleFractionBasis,
  });

  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  // Van Dyke: build the double-fraction clause from the entered outer/inner
  // fractions. The presumption reading is the OUTER fraction (of the estate);
  // the arithmetic reading is outer x inner. The engine never auto-multiplies —
  // it applies only the reading the operator selects below.
  const doubleFractionOuter = (() => {
    const denom = d(form.dfOuterDenom);
    return denom.isZero() || !denom.isFinite() ? null : d(form.dfOuterNum).div(denom);
  })();
  const doubleFractionInner = (() => {
    const denom = d(form.dfInnerDenom);
    return denom.isZero() || !denom.isFinite() ? null : d(form.dfInnerNum).div(denom);
  })();
  const doubleFractionClause: DoubleFractionClause | undefined =
    form.isDoubleFraction && doubleFractionOuter && doubleFractionInner
      ? {
          clauseText: form.dfClauseText,
          presumptionReading: serialize(doubleFractionOuter),
          arithmeticReading: serialize(doubleFractionOuter.times(doubleFractionInner)),
          chosenBasis: form.dfBasis,
        }
      : undefined;

  const previewShare = calculateShare({
    conveyanceMode: form.conveyanceMode,
    splitBasis: form.splitBasis,
    numerator: form.numerator,
    denominator: form.denominator,
    manualAmount: form.manualAmount,
    parentFraction: parentNode.fraction,
    parentInitialFraction: parentNode.initialFraction,
    doubleFractionClause,
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

    // DA-M1: an over-conveyance is NOT blocked. The engine books the grantor's
    // remainder, captures the deed's stated amount verbatim on the new node, and
    // the store raises an Over-conveyance title issue. Saving proceeds.
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
      ...(doubleFractionClause ? { doubleFractionClause } : {}),
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

          <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={form.isDoubleFraction}
              onChange={(e) => set('isDoubleFraction', e.target.checked)}
              className="accent-leather"
            />
            Antique double fraction (e.g. &ldquo;1/2 of 1/8&rdquo;)
          </label>

          {!form.isDoubleFraction && (
            <>
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
            </>
          )}

          {form.isDoubleFraction && (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-3">
              <FormField
                label="Verbatim clause (e.g. an undivided 1/2 of the 1/8 royalty)"
                value={form.dfClauseText}
                onChange={(v) => set('dfClauseText', v)}
              />
              <div className="flex items-end gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">Outer</span>
                  <div className="flex items-center gap-1">
                    <input type="text" value={form.dfOuterNum} onChange={(e) => set('dfOuterNum', e.target.value)}
                      className="w-14 px-2 py-1 rounded border border-ledger-line bg-parchment font-mono text-center" />
                    <span className="text-ink-light">/</span>
                    <input type="text" value={form.dfOuterDenom} onChange={(e) => set('dfOuterDenom', e.target.value)}
                      className="w-14 px-2 py-1 rounded border border-ledger-line bg-parchment font-mono text-center" />
                  </div>
                </div>
                <span className="pb-1.5 text-ink-light">of</span>
                <div>
                  <span className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">Inner</span>
                  <div className="flex items-center gap-1">
                    <input type="text" value={form.dfInnerNum} onChange={(e) => set('dfInnerNum', e.target.value)}
                      className="w-14 px-2 py-1 rounded border border-ledger-line bg-parchment font-mono text-center" />
                    <span className="text-ink-light">/</span>
                    <input type="text" value={form.dfInnerDenom} onChange={(e) => set('dfInnerDenom', e.target.value)}
                      className="w-14 px-2 py-1 rounded border border-ledger-line bg-parchment font-mono text-center" />
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-ink-light">
                Van Dyke v. Navigator (Tex. 2023): an antique &ldquo;1/8&rdquo; is presumptively the
                royalty itself, so the clause is read as the OUTER fraction of the estate, not the
                product. LANDroid never auto-multiplies — choose the reading of record.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['presumption', 'Presumption', doubleFractionOuter],
                  ['arithmetic', 'Arithmetic', doubleFractionOuter && doubleFractionInner ? doubleFractionOuter.times(doubleFractionInner) : null],
                ] as const).map(([basis, label, value]) => (
                  <button
                    key={basis}
                    type="button"
                    onClick={() => set('dfBasis', basis)}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      form.dfBasis === basis
                        ? 'border-leather bg-leather/10'
                        : 'border-ledger-line hover:bg-parchment-dark'
                    }`}
                  >
                    <span className="block text-[10px] uppercase tracking-wider text-ink-light">{label}</span>
                    <span className="block font-mono text-sm font-semibold text-ink">
                      {value ? formatAsFraction(value) : '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
            <p className="mt-1 text-xs">
              Saving will book the remainder (
              <span className="font-mono font-semibold">{parentRemaining}</span>), record the
              stated <span className="font-mono font-semibold">{previewFrac}</span> on the deed, and
              flag an over-conveyance title issue for review.
            </p>
            <button
              type="button"
              onClick={handleConveyRemainder}
              className="mt-2 rounded border border-tint-amber-line bg-white/60 px-2 py-1 text-xs font-semibold hover:bg-white"
            >
              Convey remainder ({parentRemaining}) exactly instead
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
