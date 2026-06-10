/**
 * The one Button (audit §5 item 2). Every primary/secondary/ghost/destructive
 * action shares this treatment so the app stops shipping ~20 hand-rolled
 * stylings of the same concept. Lean professional: no icon library, no
 * animation beyond color transitions. Nav tabs and pills are a different
 * concept and deliberately not this component.
 */
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors '
  + 'focus-visible:ring-2 focus-visible:ring-leather/40 focus-visible:ring-offset-1 focus-visible:ring-offset-parchment outline-none '
  + 'disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-leather text-parchment hover:bg-leather-dark active:bg-leather-dark/90 disabled:hover:bg-leather',
  secondary:
    'border border-ledger-line bg-parchment text-ink hover:bg-parchment-dark active:bg-parchment-dark/80 disabled:hover:bg-parchment',
  ghost:
    'text-ink-light hover:text-ink hover:bg-parchment-dark/60 disabled:hover:bg-transparent',
  destructive:
    'bg-seal text-parchment hover:bg-seal/85 active:bg-seal/75 disabled:hover:bg-seal',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3.5 py-2 text-sm',
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
