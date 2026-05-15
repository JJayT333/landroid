/**
 * Audit M-1: per-user IndexedDB namespacing.
 *
 * In LOCAL mode, persistence keys are constants — one user per browser
 * profile, no auth, the original local-first contract.
 *
 * In HOSTED mode, the key is derived from the Cognito ID token's `sub`
 * claim so two distinct invited users on the same browser profile cannot
 * read or write each other's IndexedDB rows. The hosted bootstrap defers
 * until AuthProvider calls `setActiveUserSub` so the first read uses the
 * correct namespaced key. Hosted signed-out state must never fall back to the
 * local default row; persistence remains unavailable until a real `sub` exists.
 */
import { isHostedMode } from '../utils/deploy-env';

const DEFAULT_WORKSPACE_KEY = 'default';
const DEFAULT_CANVAS_KEY = 'active-canvas';

let activeUserSub: string | null = null;

let resolveReady: () => void = () => {};
const readyPromise = new Promise<void>((resolve) => {
  resolveReady = resolve;
});
let resolved = false;

// Local mode is "ready" the moment this module loads — there is no auth
// step to wait on. Hosted mode flips ready only once a real Cognito `sub`
// exists, so signed-out users cannot accidentally touch the local default row.
if (!isHostedMode()) {
  resolved = true;
  resolveReady();
}

export function setActiveUserSub(sub: string | null): void {
  activeUserSub = sub;
  if (!resolved && (!isHostedMode() || Boolean(sub))) {
    resolved = true;
    resolveReady();
  }
}

export function getActiveUserSub(): string | null {
  return activeUserSub;
}

/**
 * Resolves once the active workspace key is known. In local mode this is
 * already resolved at module load; in hosted mode it resolves when
 * AuthProvider has called setActiveUserSub for the first time.
 */
export function awaitWorkspaceKeyReady(): Promise<void> {
  return readyPromise;
}

function requireHostedUserSub(): string {
  if (activeUserSub) return activeUserSub;
  throw new Error(
    'Hosted persistence is unavailable until the authenticated user sub is set.'
  );
}

export function getWorkspaceDbKey(): string {
  if (isHostedMode()) return `user-${requireHostedUserSub()}`;
  return DEFAULT_WORKSPACE_KEY;
}

export function getCanvasDbKey(): string {
  if (isHostedMode()) return `user-${requireHostedUserSub()}-canvas`;
  return DEFAULT_CANVAS_KEY;
}
