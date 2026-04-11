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
import { getInterestClass, type OwnershipNode } from '../../types/node';

interface NodeEditModalProps {
  node: OwnershipNode;
  onViewPdf?: (nodeId: string) => void;
  linkedOwnerName?: string | null;
  leaseStatusText?: string | null;
  onManageOwner?: (nodeId: string) => void;
  onManageLease?: (nodeId: string) => void;
  onManageNpri?: (nodeId: string) => void;
  onClose: () => void;
}

export default function NodeEditModal({
  node,
  onClose,
  onViewPdf,
  linkedOwnerName,
  leaseStatusText,
  onManageOwner,
  onManageLease,
  onManageNpri,
}: NodeEditModalProps) {
  const updateNode = useWorkspaceStore((s) => s.updateNode);
  const rebalance = useWorkspaceStore((s) => s.rebalance);
  const nodes = useWorkspaceStore((s) => s.nodes);
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
    royaltyKind: node.royaltyKind,
    fixedRoyaltyBasis:
      node.fixedRoyaltyBasis ?? (node.royaltyKind === 'fixed' ? 'burdened_branch' : null),
    isDeceased: node.isDeceased,
    obituary: node.obituary,
    graveyardLink: node.graveyardLink,
  });

  const [error, setError] = useState<string | null>(null);

  const initialChanged = form.initialFraction !== node.initialFraction;
  const previewFrac = formatAsFraction(d(form.initialFraction));
  const oldFrac = formatAsFraction(d(node.initialFraction));
  const canManageOwner = node.type !== 'related' || Boolean(node.linkedOwnerId);
  const interestClass = getInterestClass(node);
  const canManageLease =
    node.type !== 'related' &&
    interestClass === 'mineral' &&
    d(node.fraction).greaterThan(0);
  const canManageNpri =
    node.type !== 'related' &&
    interestClass === 'mineral' &&
    d(node.fraction).greaterThan(0);
  const trackedShareLabel =
    interestClass === 'npri'
      ? form.royaltyKind === 'floating'
        ? 'Share of Lease Royalty'
        : form.fixedRoyaltyBasis === 'whole_tract'
          ? 'Fixed Share of Whole Tract'
          : 'Fixed Share of Burdened Branch'
      : 'Interest of Whole Tract';
  const remainingLabel =
    interestClass === 'npri' ? 'Unconveyed Balance' : 'Remaining';
  const parentNode = node.parentId
    ? nodes.find((candidate) => candidate.id === node.parentId) ?? null
    : null;
  const editedInitialFraction = d(form.initialFraction);
  const npriExceedsFullShare =
    interestClass === 'npri' && editedInitialFraction.greaterThan(1);
  const fixedWholeTractExceedsBranch =
    interestClass === 'npri'
    && form.royaltyKind === 'fixed'
    && form.fixedRoyaltyBasis === 'whole_tract'
    && Boolean(parentNode && editedInitialFraction.greaterThan(d(parentNode.initialFraction)));

  const set = (field: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSave = () => {
    setError(null);

    const normalizedNpriFields = interestClass === 'npri'
      ? {
          royaltyKind: form.royaltyKind,
          fixedRoyaltyBasis:
            form.royaltyKind === 'fixed'
              ? (form.fixedRoyaltyBasis ?? 'burdened_branch')
              : null,
        }
      : {};
    if (initialChanged) {
      const { initialFraction, ...otherFields } = form;
      const success = rebalance(node.id, initialFraction, {
        ...otherFields,
        ...normalizedNpriFields,
      });
      if (!success) {
        setError(useWorkspaceStore.getState().lastError || 'Rebalance failed');
        return;
      }
    } else {
      updateNode(node.id, {
        ...form,
        ...normalizedNpriFields,
      });
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
            {interestClass === 'npri' ? 'Royalty Interest' : 'Ownership Interest'}
          </legend>

          <div className="bg-ledger rounded-lg p-3 space-y-2">
            {interestClass === 'npri' && (
              <>
                <div className="space-y-1.5">
                  <div className="text-[10px] text-ink-light uppercase tracking-wider">
                    NPRI Kind
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['fixed', 'Fixed NPRI'],
                      ['floating', 'Floating NPRI'],
                    ] as const).map(([kind, label]) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            royaltyKind: kind,
                            fixedRoyaltyBasis:
                              kind === 'fixed'
                                ? (current.fixedRoyaltyBasis ?? 'burdened_branch')
                                : null,
                          }))
                        }
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
                </div>

                {form.royaltyKind === 'fixed' && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-ink-light uppercase tracking-wider">
                      Fixed Deed Basis
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ['burdened_branch', 'Of burdened branch'],
                        ['whole_tract', 'Of whole tract'],
                      ] as const).map(([basis, label]) => (
                        <button
                          key={basis}
                          type="button"
                          onClick={() => set('fixedRoyaltyBasis', basis)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            form.fixedRoyaltyBasis === basis
                              ? 'bg-leather text-parchment'
                              : 'text-ink hover:bg-parchment-dark border border-ledger-line'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="text-[10px] text-ink-light">
                      Use whole-tract basis when the fixed fraction is already
                      stated against production from the land, not merely against
                      the grantor branch.
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                {trackedShareLabel}
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

            {(npriExceedsFullShare || fixedWholeTractExceedsBranch) && (
              <div className="rounded-lg border border-seal/30 bg-seal/10 px-3 py-2 text-xs leading-5 text-seal">
                <span className="font-semibold">Title discrepancy allowed.</span>{' '}
                LANDroid will save this NPRI and highlight the affected Desk Map branch in red.
                {npriExceedsFullShare && ' The entered NPRI is greater than 100%.'}
                {fixedWholeTractExceedsBranch && parentNode
                  ? ` The fixed whole-tract burden exceeds the burdened branch share of ${formatAsFraction(d(parentNode.initialFraction))}.`
                  : ''}
              </div>
            )}

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
              <span className="uppercase tracking-wider">{remainingLabel}: </span>
              <span className="font-mono font-semibold">
                {formatAsFraction(d(node.fraction))}
              </span>
              <span className="ml-2 text-ink-light/60">
                {interestClass === 'npri'
                  ? '(calculated from NPRI branch conveyances)'
                  : '(calculated, not editable)'}
              </span>
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

        {canManageOwner && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
              Owner Record
            </legend>
            <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">
                  {linkedOwnerName || 'No owner record linked yet'}
                </div>
                <div className="text-xs text-ink-light">
                  {node.type === 'related'
                    ? 'Open the linked owner record for this lease-related node.'
                    : 'Open the linked owner record or create one from this node.'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onManageOwner?.(node.id)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
              >
                {linkedOwnerName ? 'Open Owner' : 'Create Owner'}
              </button>
            </div>
          </fieldset>
        )}

        {canManageLease && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
              Lease / Lessee Node
            </legend>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-emerald-950">
                  {leaseStatusText || 'No lease node linked yet'}
                </div>
                <div className="text-xs text-emerald-900/75">
                  Create or open the terminal lessee node without changing mineral ownership.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onManageLease?.(node.id)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-emerald-900 hover:bg-emerald-100 border border-emerald-300 transition-colors"
              >
                {leaseStatusText ? 'Open Lease' : 'Create Lease'}
              </button>
            </div>
          </fieldset>
        )}

        {canManageNpri && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
              Royalty Burdens
            </legend>
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-amber-950">
                  Add a fixed or floating NPRI without reducing the mineral total.
                </div>
                <div className="text-xs text-amber-900/75">
                  Desk Map tracks the NPRI branch separately. Royalty payout math can come later on the lessee side.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onManageNpri?.(node.id)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-100 border border-amber-300 transition-colors"
              >
                Add NPRI
              </button>
            </div>
          </fieldset>
        )}

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
