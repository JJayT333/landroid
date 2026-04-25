/**
 * Cognito (OIDC) auth provider for hosted LANDroid.
 *
 * Uses Cognito Hosted UI + authorization_code + PKCE via oidc-client-ts.
 * Keeps the current ID token synced to `session.ts` so the AI client can
 * attach it to `/api/ai/*` requests without importing React context.
 *
 * Only active in hosted mode — local dev bypasses this entirely.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UserManager, type User } from 'oidc-client-ts';
import { setIdToken, setUnauthorizedHandler } from './session';
import { setActiveUserSub } from '../storage/active-workspace-key';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readConfig() {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI ?? window.location.origin + '/';
  if (!domain || !clientId) {
    throw new Error(
      'Missing Cognito config. Set VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID in the hosted build.'
    );
  }
  return {
    authority: `https://${domain}`,
    client_id: clientId,
    redirect_uri: redirectUri,
    post_logout_redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email',
    metadata: {
      authorization_endpoint: `https://${domain}/oauth2/authorize`,
      token_endpoint: `https://${domain}/oauth2/token`,
      userinfo_endpoint: `https://${domain}/oauth2/userInfo`,
      end_session_endpoint: `https://${domain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
        redirectUri
      )}`,
      issuer: `https://${domain}`,
      jwks_uri: `https://${domain}/.well-known/jwks.json`,
    },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const manager = useMemo(() => {
    try {
      return new UserManager(readConfig());
    } catch (err) {
      console.error('[auth] config error', err);
      return null;
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!manager) {
      setError('Auth is not configured.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const syncUser = (next: User | null) => {
      if (cancelled) return;
      setUser(next);
      setIdToken(next?.id_token ?? null);
      // Audit M-1: namespace IndexedDB on the Cognito sub claim. Setting
      // the value (even null) flips the workspace-key ready promise so
      // bootstrap can run; signed-out hosted users wait at LoginGate but
      // the autosave subscription stays correctly scoped to whatever sub
      // is current.
      const sub = typeof next?.profile?.sub === 'string' ? next.profile.sub : null;
      setActiveUserSub(sub);
    };

    (async () => {
      try {
        if (window.location.search.includes('code=')) {
          const signedIn = await manager.signinRedirectCallback();
          window.history.replaceState({}, document.title, window.location.pathname);
          syncUser(signedIn);
        } else {
          const existing = await manager.getUser();
          if (existing && !existing.expired) {
            syncUser(existing);
          } else if (existing) {
            try {
              const refreshed = await manager.signinSilent();
              syncUser(refreshed);
            } catch {
              syncUser(null);
            }
          } else {
            syncUser(null);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        syncUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const onUserLoaded = (u: User) => syncUser(u);
    const onUserUnloaded = () => syncUser(null);
    // When the access/ID token expires mid-session, drop the user so the
    // LoginGate re-mounts and prompts for re-auth. Iframe-based silent renew
    // does not work with Cognito (X-Frame-Options: DENY), so a full redirect
    // is the correct recovery path for POC.
    const onTokenExpired = () => {
      void manager.removeUser();
    };
    manager.events.addUserLoaded(onUserLoaded);
    manager.events.addUserUnloaded(onUserUnloaded);
    manager.events.addAccessTokenExpired(onTokenExpired);

    // If any authenticated fetch (e.g. the AI proxy) returns 401, treat it
    // as session expiry even if the token claims are still unexpired locally.
    setUnauthorizedHandler(() => {
      void manager.removeUser();
    });

    return () => {
      cancelled = true;
      manager.events.removeUserLoaded(onUserLoaded);
      manager.events.removeUserUnloaded(onUserUnloaded);
      manager.events.removeAccessTokenExpired(onTokenExpired);
      setUnauthorizedHandler(null);
    };
  }, [manager]);

  const value: AuthContextValue = {
    user,
    isLoading,
    error,
    signIn: () => {
      manager?.signinRedirect().catch((err) => setError(err.message));
    },
    signOut: () => {
      manager?.signoutRedirect().catch((err) => setError(err.message));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
