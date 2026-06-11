/**
 * Shared form field — text or date input with label.
 */
import { useId } from 'react';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date';
  className?: string;
  id?: string;
  disabled?: boolean;
  /**
   * Optional datalist suggestions (e.g. lessees already used in the project).
   * Shown on focus, filtered as the user types; never blocks free typing of a
   * new value.
   */
  suggestions?: string[];
}

export default function FormField({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
  id,
  disabled = false,
  suggestions,
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = suggestions && suggestions.length > 0
    ? `${inputId}-suggestions`
    : undefined;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="text-[10px] text-ink-light uppercase tracking-wider block mb-1"
      >
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        disabled={disabled}
        list={listId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-sm border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      {listId && (
        <datalist id={listId}>
          {suggestions?.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </div>
  );
}
