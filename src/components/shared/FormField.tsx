/**
 * Shared form field — text or date input with label.
 */

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'date';
  className?: string;
}

export default function FormField({
  label,
  value,
  onChange,
  type = 'text',
  className = '',
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg border border-ledger-line bg-parchment text-ink text-sm focus:ring-2 focus:ring-leather focus:border-leather outline-none"
      />
    </div>
  );
}
