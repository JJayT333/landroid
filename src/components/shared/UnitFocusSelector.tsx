/**
 * Compact unit-focus control for command bars (Ledger Refined): a quiet
 * select + "+ Add Unit" toggle; the add form opens as a small popover so the
 * bar stays one row tall.
 */
import { useMemo, useState } from 'react';
import Button from './Button';
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
  label = 'Unit focus',
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
    <div className="relative flex items-center gap-2">
      <select
        value={selectedUnitCode}
        aria-label={label}
        disabled={unitOptions.length === 0}
        onChange={(event) => setActiveUnitCode(event.target.value || null)}
        className="rounded-lg border border-ledger-line bg-white px-2.5 py-[5px] text-xs font-semibold text-ink outline-none transition-colors focus:border-leather disabled:bg-ledger disabled:text-ink-light"
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
      <Button variant="ghost" size="xs" onClick={() => setAdding((current) => !current)}>
        {adding ? 'Cancel' : '+ Add Unit'}
      </Button>

      {adding && (
        <div className="absolute left-0 top-9 z-40 w-72 rounded-[10px] border border-ledger-line bg-parchment-light p-3 shadow-[0_12px_30px_rgba(45,33,20,0.16)]">
          <div className="grid gap-2">
            <label>
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-light">
                Unit Name
              </span>
              <input
                value={unitNameDraft}
                onChange={(event) => setUnitNameDraft(event.target.value)}
                placeholder="Raven Forest Unit C"
                className="mt-1 w-full rounded-lg border border-ledger-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-leather"
              />
            </label>
            <label>
              <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-light">
                Code
              </span>
              <input
                value={unitCodeDraft}
                onChange={(event) => setUnitCodeDraft(event.target.value)}
                placeholder="C"
                className="mt-1 w-full rounded-lg border border-ledger-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-leather"
              />
            </label>
            <div className="flex justify-end">
              <Button size="sm" disabled={!unitNameDraft.trim()} onClick={handleCreateUnit}>
                Create
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
