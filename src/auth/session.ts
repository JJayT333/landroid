/**
 * Authenticated session accessor.
 *
 * Local dev: always returns null (no auth gate, direct provider calls).
 * Hosted:    returns the Cognito ID token from the AuthProvider state.
 *
 * Populated at runtime by src/auth/AuthProvider.tsx once Cognito login completes.
 * Kept as a module-level holder so non-React callers (AI client) can read it
 * without wiring React context through every SDK boundary.
 */

let currentIdToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setIdToken(token: string | null): void {
  currentIdToken = token;
}

export async function getIdToken(): Promise<string | null> {
  if (currentIdToken) return currentIdToken;
  return readStoredOidcIdToken();
}

function readStoredOidcIdToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith('oidc.user:')) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { id_token?: unknown; expired?: unknown };
      if (parsed.expired === true) continue;
      if (typeof parsed.id_token === 'string' && parsed.id_token.trim()) {
        currentIdToken = parsed.id_token;
        return currentIdToken;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Register a callback to invoke when a downstream request returns 401.
 * AuthProvider wires this to `UserManager.removeUser()`, which flips
 * `LoginGate` back to the sign-in screen so the user can re-authenticate.
 *
 * Passing `null` removes the handler (AuthProvider cleanup on unmount).
 */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

/**
 * Invoked by fetch wrappers (e.g. AI client) when the server rejects
 * the current token. Safe to call with no handler registered.
 */
export function triggerUnauthorized(): void {
  unauthorizedHandler?.();
}
