/**
 * Full-screen login wall for hosted mode.
 *
 * Renders nothing until auth state resolves, then either:
 *  - the children (user signed in), or
 *  - a simple sign-in screen that redirects to Cognito Hosted UI.
 */
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

export default function LoginGate({ children }: { children: ReactNode }) {
  const { user, isLoading, error, signIn } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment text-ink">
        <div className="text-sm text-ink-light">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-parchment">
        <div className="w-full max-w-sm space-y-6 rounded-2xl border border-leather/30 bg-parchment/80 p-8 shadow-lg">
          <div className="space-y-1 text-center">
            <h1 className="font-display text-3xl font-bold text-ink">LANDroid</h1>
            <p className="text-sm text-ink-light">Sign in to continue</p>
          </div>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={signIn}
            className="w-full rounded-lg bg-leather px-4 py-2 text-sm font-semibold text-parchment shadow-sm hover:bg-leather-dark"
          >
            Sign in
          </button>
          <div className="text-center text-[11px] text-ink-light">
            Access is by invitation only.
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
