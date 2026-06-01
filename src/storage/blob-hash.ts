/**
 * sha-256 helper used by the document-store migration and (later) dedup
 * surfaces. Kept tiny and dependency-free so the rest of the storage layer
 * does not need to know about Web Crypto.
 *
 * The hash is recorded on every `DocumentRecord` so future dedup logic can
 * land without a schema migration. Today no caller reads it for de-duping.
 */

/**
 * Compute the sha-256 of a `Blob` and return a lowercase hex digest.
 * Throws if the runtime does not expose `crypto.subtle` (e.g. an old
 * Node runtime); all supported browsers and Node 16+ provide it.
 */
export async function sha256HexOfBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return toHex(new Uint8Array(digest));
}

/**
 * Compute the sha-256 of raw bytes and return a lowercase hex digest. Same
 * digest as {@link sha256HexOfBlob} for the same byte content; used by packet
 * packaging to verify native files against their recorded `contentHash`.
 */
export async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer-backed view: digests exactly these bytes
  // (never a wider/shared backing buffer) and satisfies BufferSource typing.
  const copy = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  const out: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i].toString(16).padStart(2, '0');
  }
  return out.join('');
}
