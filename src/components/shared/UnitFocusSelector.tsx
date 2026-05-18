import { useMemo, useState } from 'react';
import { useWorkspaceStore } from '../../store/workspace-store';
import {
  generateUniqueUnitCode,
  getDeskMapUnitOptions,
  makeUnitOptionLabel,
} from '../../utils/desk-map-units';

interface UnitFocusSelectorProps {
  label?: string;
}

export default function UnitFocusSelector({
  label = 'Unit Focus',
}: UnitFocusSelectorProps) {
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const activeUnitCode = useWorkspaceStore((state) => state.activeUnitCode);
  const setActiveUnitCode = useWorkspaceStore((state) => state.setActiveUnitCode);
  const createDeskMap = useWorkspaceStore((state) => state.createDeskMap);
  const [adding, setAdding] = useState(false);
  const [unitNameDraft, setUnitNameDraft] = useState('');
  const [unitCodeDraft, setUnitCodeDraft] = useState('');

  const unitOptions = useMemo(() => getDeskMapUnitOptions(deskMaps), [deskMaps]);
  const selectedUnitCode = activeUnitCode ?? unitOptions[0]?.unitCode ?? '';
  const selectedUnit = unitOptions.find((option) => option.unitCode === selectedUnitCode) ?? null;

  const resetDrafts = () => {
    setUnitNameDraft('');
    setUnitCodeDraft('');
    setAdding(false);
  };

  const handleCreateUnit = () => {
    const unitName = unitNameDraft.trim();
    if (!unitName) {
      return;
    }

    const existingCodes = unitOptions.map((option) => option.unitCode);
    const requestedCode =
      unitCodeDraft.trim()
      || generateUniqueUnitCode(unitName, existingCodes);
    const unitCode = existingCodes.includes(requestedCode)
      ? generateUniqueUnitCode(unitName, existingCodes)
      : requestedCode;
    const tractNumber = deskMaps.length + 1;
    createDeskMap(`Tract ${tractNumber}`, `T${tractNumber}`, [], {
      unitName,
      unitCode,
    });
    setActiveUnitCode(unitCode);
    resetDrafts();
  };

  return (
    <div className="rounded-xl border border-ledger-line bg-parchment px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[14rem] flex-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-light">
            {label}
          </span>
          <select
            value={selectedUnitCode}
            disabled={unitOptions.length === 0}
            onChange={(event) => setActiveUnitCode(event.target.value || null)}
            className="mt-1.5 w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather disabled:bg-ledger disabled:text-ink-light"
          >
            {unitOptions.length === 0 ? (
              <option value="">No units yet</option>
            ) : (
              unitOptions.map((option) => (
                <option key={option.unitCode} value={option.unitCode}>
                  {makeUnitOptionLabel(option)}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="rounded-lg border border-ledger-line bg-white px-3 py-2 text-xs text-ink-light">
          {selectedUnit
            ? `${selectedUnit.tractCount} tract${selectedUnit.tractCount === 1 ? '' : 's'}`
            : `${deskMaps.length} tract${deskMaps.length === 1 ? '' : 's'}`}
        </div>

        <button
          type="button"
          onClick={() => setAdding((current) => !current)}
          className="rounded-lg border border-leather/30 px-3 py-2 text-xs font-semibold text-leather transition-colors hover:bg-leather/10"
        >
          {adding ? 'Cancel' : '+ Add Unit'}
        </button>
      </div>

      {adding && (
        <div className="mt-3 grid gap-2 border-t border-ledger-line pt-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
              Unit Name
            </span>
            <input
              value={unitNameDraft}
              onChange={(event) => setUnitNameDraft(event.target.value)}
              placeholder="Raven Forest Unit C"
              className="mt-1 w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            />
          </label>
          <label>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-light">
              Code
            </span>
            <input
              value={unitCodeDraft}
              onChange={(event) => setUnitCodeDraft(event.target.value)}
              placeholder="C"
              className="mt-1 w-full rounded-lg border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-leather"
            />
          </label>
          <button
            type="button"
            disabled={!unitNameDraft.trim()}
            onClick={handleCreateUnit}
            className="self-end rounded-lg bg-leather px-4 py-2 text-sm font-semibold text-parchment transition-colors hover:bg-leather-light disabled:opacity-50"
          >
            Create
          </button>
        </div>
      )}
    </div>
  );
}
