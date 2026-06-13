/**
 * Resolves canvas image-asset content hashes to object URLs, with a
 * module-level cache so a given asset is loaded and URL-ified once. The print
 * renderer reads the cache synchronously — it works because the on-screen
 * image nodes mount first and populate it.
 */
import { useEffect, useState } from 'react';
import { getCanvasAssetBlob } from '../../storage/canvas-assets';
import { useWorkspaceStore } from '../../store/workspace-store';

const urlCache = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

/** Synchronous lookup for an already-resolved asset URL (used by print). */
export function peekAssetUrl(contentHash: string): string | null {
  return urlCache.get(contentHash) ?? null;
}

async function loadAssetUrl(
  contentHash: string,
  workspaceId: string
): Promise<string | null> {
  const cached = urlCache.get(contentHash);
  if (cached) return cached;
  const pending = inflight.get(contentHash);
  if (pending) return pending;

  const promise = (async () => {
    const blob = await getCanvasAssetBlob(contentHash, workspaceId);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(contentHash, url);
    return url;
  })();
  inflight.set(contentHash, promise);
  const result = await promise;
  inflight.delete(contentHash);
  return result;
}

/**
 * Hook: returns the object URL for an asset hash (or null while loading /
 * missing). URLs are intentionally NOT revoked on unmount — they are cached and
 * reused across nodes and the print overlay for the session.
 */
export function useCanvasAssetUrl(contentHash: string | undefined): string | null {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const [url, setUrl] = useState<string | null>(() =>
    contentHash ? peekAssetUrl(contentHash) : null
  );

  useEffect(() => {
    if (!contentHash) {
      setUrl(null);
      return;
    }
    let active = true;
    const cached = peekAssetUrl(contentHash);
    if (cached) {
      setUrl(cached);
      return;
    }
    void loadAssetUrl(contentHash, workspaceId).then((resolved) => {
      if (active) setUrl(resolved);
    });
    return () => {
      active = false;
    };
  }, [contentHash, workspaceId]);

  return url;
}
