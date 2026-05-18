/**
 * Navbar chip shown only in hosted mode: signed-in email + sign-out.
 *
 * Must be rendered inside `<AuthProvider>` — `Navbar` guards that with
 * `isHostedMode()` before importing this module at runtime.
 */
import { useEffect, useRef, useState } from 'react';
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
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-parchment/70 hover:text-parchment hover:bg-ink-light/30 transition-colors"
      >
        {label} ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-leather bg-ink shadow-xl"
        >
          <div className="px-3 py-2 text-[11px] text-parchment/50 font-mono truncate">
            {email}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
