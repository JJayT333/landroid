/**
 * Combo-box for instrument types — dropdown of existing types + custom entry.
 *
 * Reads/writes the instrument type list from the workspace store so
 * user-added types persist and appear in future uses.
 */
import { useState, useRef, useEffect, useId } from 'react';
import Button from './Button';
import { useWorkspaceStore } from '../../store/workspace-store';

interface InstrumentSelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  label?: string;
}

export default function InstrumentSelect({
  value,
  onChange,
  disabled = false,
  label = 'Instrument',
}: InstrumentSelectProps) {
  const instrumentTypes = useWorkspaceStore((s) => s.instrumentTypes);
  const addInstrumentType = useWorkspaceStore((s) => s.addInstrumentType);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const menuId = useId();
  const filterInputId = useId();
  const customInputId = useId();

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomMode(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = instrumentTypes.filter((t) =>
    t.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSelect = (type: string) => {
    if (disabled) return;
    onChange(type);
    setOpen(false);
    setFilter('');
  };

  const handleAddCustom = () => {
    if (disabled) return;
    const trimmed = customValue.trim();
    if (!trimmed) return;
    addInstrumentType(trimmed);
    onChange(trimmed);
    setCustomMode(false);
    setCustomValue('');
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label
        htmlFor={buttonId}
        className="text-[10px] text-ink-light uppercase tracking-wider block mb-1"
      >
        {label}
      </label>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        onClick={() => { setOpen(!open); setFilter(''); }}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="w-full px-3 py-1.5 rounded-lg border border-ledger-line bg-parchment text-ink text-sm text-left focus:ring-2 focus:ring-leather focus:border-leather outline-none flex items-center justify-between disabled:bg-leather/10 disabled:opacity-70"
      >
        <span className={value ? 'text-ink' : 'text-ink-light'}>{value || 'Select...'}</span>
        <span className="text-ink-light text-xs">&#9662;</span>
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute z-50 mt-1 w-full bg-parchment border border-ledger-line rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          {/* Search filter */}
          <div className="p-2 border-b border-ledger-line">
            <label htmlFor={filterInputId} className="sr-only">
              Search instrument types
            </label>
            <input
              id={filterInputId}
              type="text"
              placeholder="Search..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-2 py-1 rounded border border-ledger-line bg-parchment text-sm text-ink focus:ring-1 focus:ring-leather outline-none"
              autoFocus
            />
          </div>

          {/* Options */}
          {filtered.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleSelect(type)}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-parchment-dark transition-colors ${
                value === type ? 'bg-leather/10 font-semibold text-leather' : 'text-ink'
              }`}
            >
              {type}
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-ink-light">No matches</div>
          )}

          {/* Custom entry */}
          <div className="border-t border-ledger-line p-2">
            {customMode ? (
              <div className="flex gap-1">
                <label htmlFor={customInputId} className="sr-only">
                  New instrument type
                </label>
                <input
                  id={customInputId}
                  type="text"
                  placeholder="New type..."
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                  className="flex-1 px-2 py-1 rounded border border-ledger-line bg-parchment text-sm text-ink focus:ring-1 focus:ring-leather outline-none"
                  autoFocus
                />
                <Button size="sm" onClick={handleAddCustom}>
                  Add
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className="w-full text-left text-xs text-leather font-semibold hover:bg-leather/10 px-2 py-1 rounded transition-colors"
              >
                + Custom type...
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
