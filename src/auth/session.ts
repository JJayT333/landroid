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

export function setIdToken(token: string | null): void {
  currentIdToken = token;
}

export async function getIdToken(): Promise<string | null> {
  return currentIdToken;
}
