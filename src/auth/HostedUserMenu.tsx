/**
 * Account row shown only in hosted mode: signed-in email + sign-out. Lives in
 * the sidebar's ⋯ ProjectMenu since the shell redesign.
 *
 * Must be rendered inside `<AuthProvider>` — callers guard with
 * `isHostedMode()` before rendering.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon } from '../components/shell/icons';
import { useAuth } from './AuthProvider';

export default function HostedUserMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (!user) return null;

  const email =
    (user.profile?.email as string | undefined) ??
    (user.profile?.['cognito:username'] as string | undefined) ??
    'Signed in';
  const label = email.length > 24 ? `${email.slice(0, 21)}…` : email;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={email}
        className="flex w-full items-center justify-between rounded-[7px] px-2.5 py-1.5 text-left text-[12.5px] text-ink transition-colors hover:bg-parchment-dark"
      >
        <span className="truncate">{label}</span>
        <span className="flex shrink-0 text-ink-light">
          <ChevronDownIcon size={12} />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-[7px] border border-ledger-line bg-parchment-light shadow-[0_12px_30px_rgba(45,33,20,0.16)]"
        >
          <div className="truncate px-2.5 py-2 font-mono text-[10.5px] text-ink-light">
            {email}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="block w-full px-2.5 py-1.5 text-left text-[12.5px] text-ink transition-colors hover:bg-parchment-dark"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
