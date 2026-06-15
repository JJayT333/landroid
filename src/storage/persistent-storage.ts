/**
 * Request persistent browser storage (Phase 0.5 durability).
 *
 * Where the Storage API is available, ask the browser to mark this origin's
 * storage as persistent so IndexedDB is not silently evicted under storage
 * pressure — important for PWA / iPad local-first use. The result is recorded
 * for diagnostics; a refusal is a durability signal, never a reason to block
 * local-first editing. A user-facing storage-health indicator is a later
 * product lane, so this slice only requests and records.
 */
export type PersistentStorageStatus =
  | 'persisted' // granted now, or already persistent
  | 'denied' // the browser declined the request
  | 'unsupported' // Storage API / persist() not available
  | 'error'; // the request threw

export interface PersistentStorageResult {
  status: PersistentStorageStatus;
  alreadyPersisted: boolean;
  error?: string;
}

export interface BrowserStorageEstimateResult {
  supported: boolean;
  usage: number | null;
  quota: number | null;
  error?: string;
}

interface StorageManagerLike {
  estimate?: () => Promise<StorageEstimate>;
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export interface PersistentStorageEnv {
  storage?: StorageManagerLike;
}

/**
 * Detect an IndexedDB storage-quota failure (DA-M11). Browsers throw a
 * `DOMException` named `'QuotaExceededError'` (legacy code 22) when a write
 * would exceed the origin's storage budget.
 */
export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException
    && (error.name === 'QuotaExceededError' || error.code === 22)
  );
}

function resolveStorage(env?: PersistentStorageEnv): StorageManagerLike | undefined {
  if (env) return env.storage;
  if (typeof navigator !== 'undefined') {
    return (navigator as Navigator & { storage?: StorageManagerLike }).storage;
  }
  return undefined;
}

export async function requestPersistentStorage(
  env?: PersistentStorageEnv
): Promise<PersistentStorageResult> {
  const storage = resolveStorage(env);
  if (!storage || typeof storage.persist !== 'function') {
    return { status: 'unsupported', alreadyPersisted: false };
  }

  try {
    const alreadyPersisted =
      typeof storage.persisted === 'function' ? await storage.persisted() : false;
    if (alreadyPersisted) {
      return { status: 'persisted', alreadyPersisted: true };
    }

    const granted = await storage.persist();
    return {
      status: granted ? 'persisted' : 'denied',
      alreadyPersisted: false,
    };
  } catch (error) {
    return {
      status: 'error',
      alreadyPersisted: false,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}

export async function estimateBrowserStorage(
  env?: PersistentStorageEnv
): Promise<BrowserStorageEstimateResult> {
  const storage = resolveStorage(env);
  if (!storage || typeof storage.estimate !== 'function') {
    return {
      supported: false,
      usage: null,
      quota: null,
    };
  }

  try {
    const estimate = await storage.estimate();
    return {
      supported: true,
      usage: typeof estimate.usage === 'number' ? estimate.usage : null,
      quota: typeof estimate.quota === 'number' ? estimate.quota : null,
    };
  } catch (error) {
    return {
      supported: true,
      usage: null,
      quota: null,
      error: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
