/**
 * Pill — the interactive segmented selector (deep audit §5, pill/tab standard).
 * One component for the filter/view pill rows that were copy-pasted across
 * Documents, Runsheet, and the Owner database with four different paddings and
 * two near-identical active treatments. Active state is the locked standard:
 * `bg-leather text-parchment`.
 *
 * This is the interactive sibling of Chip (static badge): Pill is a <button>
 * with an active state; callers map their options and pass `active`. Underline
 * "real" tabs (OwnerDetailPanel) and the bespoke desk-map tract tabs stay as-is.
 */
import type { ButtonHTMLAttributes } from 'react';

export type PillSize = 'sm' | 'md';

const BASE =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border transition-colors';

const SIZES: Record<PillSize, string> = {
  sm: 'px-2.5 py-[3px] text-[10.5px] font-bold',
  md: 'px-3 py-1 text-[11.5px] font-semibold',
};

const ACTIVE = 'border-leather bg-leather text-parchment';
const INACTIVE = 'border-ledger-line text-ink-light hover:bg-parchment-dark hover:text-ink';

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: PillSize;
}

export default function Pill({
  active = false,
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}: PillProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={`${BASE} ${SIZES[size]} ${active ? ACTIVE : INACTIVE} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
