/**
 * Inline component showing "0.500000000 | 1/2" dual display.
 */
import { dualDisplay } from '../../engine/fraction-display';

interface FractionDisplayProps {
  value: string;
  className?: string;
}

export default function FractionDisplay({ value, className = '' }: FractionDisplayProps) {
  const display = dualDisplay(value);
  const [decimal, fraction] = display.split(' | ');

  return (
    <span className={`font-mono ${className}`}>
      <span>{decimal}</span>
      <span className="text-ink-light mx-1">|</span>
      <span className="font-semibold">{fraction}</span>
    </span>
  );
}
