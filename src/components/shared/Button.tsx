/**
 * The one Button — "Ledger Refined" kit (design handoff 2026-06-11).
 * Small, quiet, precise: 600-weight type, 8px radius, saddle primary with a
 * near-invisible top-light gradient and pressed compression, hairline
 * secondary, ghost washes, and a liquid-glass variant for chrome that floats
 * over the canvas. Nav rows, pills, and tabs are different concepts and
 * deliberately not this component.
 *
 * `destructive` is the SOLID seal treatment (typed-confirm modals, real
 * deletes); `destructive-ghost` is the quiet inline form (Clear, card-row
 * DELETE) so destructive actions read as dangerous only when they are.
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
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap select-none '
  + 'transition-all duration-150 ease-out outline-none '
  + 'focus-visible:ring-2 focus-visible:ring-leather/40 focus-visible:ring-offset-1 focus-visible:ring-offset-parchment '
  + 'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0';

/* Raised variants share the lift choreography: inset top highlight at rest,
   a touch more air on hover, compressed flat on press. */
const RAISED_REST = 'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(45,33,20,0.18)]';
const RAISED_HOVER = 'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_6px_rgba(45,33,20,0.22)]';
const RAISED_PRESS = 'active:translate-y-px active:shadow-[inset_0_1px_1px_rgba(45,33,20,0.25)]';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    `bg-leather bg-[linear-gradient(180deg,#96532f,#8a4b2d_55%)] text-[#fff6ec] ${RAISED_REST} `
    + `hover:bg-[linear-gradient(180deg,#a25c39,#9c5836_55%)] ${RAISED_HOVER} `
    + `active:bg-leather-dark active:bg-none ${RAISED_PRESS} `
    + 'disabled:hover:bg-[linear-gradient(180deg,#96532f,#8a4b2d_55%)]',
  secondary:
    'border border-line-strong bg-parchment-light text-ink shadow-[0_1px_2px_rgba(45,33,20,0.05)] '
    + 'hover:bg-parchment-dark active:bg-parchment-dark active:shadow-none disabled:hover:bg-parchment-light',
  ghost:
    'text-ink-soft hover:text-ink hover:bg-parchment-dark active:bg-parchment-dark/80 disabled:hover:bg-transparent disabled:hover:text-ink-soft',
  destructive:
    `bg-seal bg-[linear-gradient(180deg,#b23e35,#a4342c_55%)] text-[#fff6ec] ${RAISED_REST} `
    + `hover:bg-[linear-gradient(180deg,#bd4b42,#b03b32_55%)] ${RAISED_HOVER} `
    + `active:bg-[#8e2d26] active:bg-none ${RAISED_PRESS} `
    + 'disabled:hover:bg-[linear-gradient(180deg,#b23e35,#a4342c_55%)]',
  'destructive-ghost':
    'text-seal hover:bg-[#f7e9e4] active:bg-[#f2ddd7] disabled:hover:bg-transparent',
  glass:
    'border border-ledger-line bg-parchment-light/70 text-ink backdrop-blur-md backdrop-saturate-150 '
    + 'shadow-[0_2px_8px_rgba(45,33,20,0.07)] hover:bg-parchment-dark/80 active:bg-parchment-dark '
    + 'disabled:hover:bg-parchment-light/70',
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
