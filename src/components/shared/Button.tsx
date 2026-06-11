/**
 * The one Button — "19.10-G1 Frosted Parchment" kit (locked, design handoff
 * 2026-06-11). Letterpress glass: the primary is a stamped chip — frosted
 * parchment fill, 1.5px ink border, a hard 2px offset shadow — that physically
 * presses in on hover/press. Secondary is a quiet glass hairline; ghosts are
 * bare text with a tinted wash. Kit rules: the stamp/backdrop-blur treatment
 * belongs to command-bar and card-level primaries ONLY (GPU cost) — never
 * per-row table buttons; tabs, filter chips, and pagination keep solid saddle
 * and are deliberately not this component.
 *
 * `destructive` extends the kit's anatomy to a seal-colored stamp so
 * typed-confirm modals keep their danger weight; `destructive-ghost` is the
 * spec's danger ghost. `glass` aliases secondary (legacy canvas-chrome call
 * sites — Undo/Redo/Fit are command-bar level).
 */
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'destructive-ghost'
  | 'glass';
export type ButtonSize = 'xs' | 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg whitespace-nowrap select-none '
  + 'transition-all duration-150 ease-out outline-none '
  + 'focus-visible:ring-2 focus-visible:ring-leather/40 focus-visible:ring-offset-1 focus-visible:ring-offset-parchment '
  + 'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0';

/* The letterpress stamp press: at rest the chip floats on its hard offset;
   hover/press moves it INTO the page and the offset shrinks to match. */
const STAMP_REST =
  'shadow-[2px_2px_0_var(--color-ink),0_6px_14px_rgba(45,33,20,0.18),inset_0_1px_0_rgba(255,255,255,0.75)]';
const STAMP_PRESS =
  'hover:translate-x-px hover:translate-y-px '
  + 'hover:shadow-[1px_1px_0_var(--color-ink),0_3px_8px_rgba(45,33,20,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] '
  + 'active:translate-x-[2px] active:translate-y-[2px] '
  + 'active:shadow-[0_0_0_var(--color-ink),0_2px_5px_rgba(45,33,20,0.14),inset_0_1px_0_rgba(255,255,255,0.85)]';

const DANGER_STAMP_REST =
  'shadow-[2px_2px_0_var(--color-seal),0_6px_14px_rgba(164,52,44,0.18),inset_0_1px_0_rgba(255,255,255,0.75)]';
const DANGER_STAMP_PRESS =
  'hover:translate-x-px hover:translate-y-px '
  + 'hover:shadow-[1px_1px_0_var(--color-seal),0_3px_8px_rgba(164,52,44,0.16),inset_0_1px_0_rgba(255,255,255,0.85)] '
  + 'active:translate-x-[2px] active:translate-y-[2px] '
  + 'active:shadow-[0_0_0_var(--color-seal),0_2px_5px_rgba(164,52,44,0.14),inset_0_1px_0_rgba(255,255,255,0.85)]';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'font-bold text-ink border-[1.5px] border-ink bg-[rgba(243,229,217,0.55)] backdrop-blur-[10px] '
    + `${STAMP_REST} ${STAMP_PRESS} hover:bg-[rgba(243,229,217,0.78)] `
    + 'disabled:hover:bg-[rgba(243,229,217,0.55)]',
  secondary:
    'font-semibold text-ink border border-line-strong bg-[rgba(255,252,246,0.45)] backdrop-blur-[6px] '
    + 'hover:bg-[rgba(243,229,217,0.7)] active:bg-parchment-dark disabled:hover:bg-[rgba(255,252,246,0.45)]',
  ghost:
    'font-semibold text-ink-light hover:text-ink hover:bg-[rgba(243,229,217,0.6)] '
    + 'active:bg-parchment-dark/80 disabled:hover:bg-transparent disabled:hover:text-ink-light',
  destructive:
    'font-bold text-seal border-[1.5px] border-seal bg-[rgba(247,233,228,0.55)] backdrop-blur-[10px] '
    + `${DANGER_STAMP_REST} ${DANGER_STAMP_PRESS} hover:bg-[rgba(247,233,228,0.78)] `
    + 'disabled:hover:bg-[rgba(247,233,228,0.55)]',
  'destructive-ghost':
    'font-semibold text-seal hover:bg-[rgba(247,233,228,0.8)] active:bg-[#f2ddd7] disabled:hover:bg-transparent',
  glass:
    'font-semibold text-ink border border-line-strong bg-[rgba(255,252,246,0.45)] backdrop-blur-[6px] '
    + 'hover:bg-[rgba(243,229,217,0.7)] active:bg-parchment-dark disabled:hover:bg-[rgba(255,252,246,0.45)]',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-[11px]',
  sm: 'px-3 py-[5px] text-xs',
  md: 'px-3.5 py-1.5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
