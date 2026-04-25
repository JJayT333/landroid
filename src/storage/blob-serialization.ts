export interface SerializedBlob {
  mimeType: string;
  base64: string;
}

/**
 * Audit M3: per-blob size cap for .landroid imports.
 *
 * A malicious or just corrupt .landroid can inline hundreds of megabytes into
 * one owner-doc or PDF and exhaust browser memory during decode. Even under
 * the overall LANDROID file-size cap (50MB), one gzipped blob can balloon
 * on decode. Cap individual decoded blob size to 25 MB — the same ceiling we
 * enforce on live PDF uploads — so a single bad record can't wedge the tab.
 */
export const MAX_DESERIALIZED_BLOB_BYTES = 25 * 1024 * 1024;

function estimateDecodedByteLength(base64: string): number {
  // Base64 expands 3 bytes -> 4 chars, so decoded length ≈ base64.length * 3 / 4,
  // minus padding. This is an upper bound suitable for a pre-decode guard.
  return Math.ceil((base64.length * 3) / 4);
}

function toBase64(bytes: Uint8Array) {
  const BufferCtor = (
    globalThis as {
      Buffer?: {
        from: (input: Uint8Array) => { toString: (encoding: string) => string };
      };
    }
  ).Buffer;
  if (BufferCtor) {
    return BufferCtor.from(bytes).toString('base64');
  }

  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function fromBase64(base64: string) {
  const BufferCtor = (
    globalThis as {
      Buffer?: {
        from: (
          input: string,
          encoding: string
        ) => { [index: number]: number; length: number };
      };
    }
  ).Buffer;
  if (BufferCtor) {
    return new Uint8Array(BufferCtor.from(base64, 'base64'));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function serializeBlob(blob: Blob): Promise<SerializedBlob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    mimeType: blob.type || 'application/octet-stream',
    base64: toBase64(bytes),
  };
}

export function deserializeBlob(serialized: SerializedBlob): Blob {
  const estimated = estimateDecodedByteLength(serialized.base64);
  if (estimated > MAX_DESERIALIZED_BLOB_BYTES) {
    throw new Error(
      `Serialized blob too large to deserialize (~${(estimated / (1024 * 1024)).toFixed(1)} MB; limit is ${(MAX_DESERIALIZED_BLOB_BYTES / (1024 * 1024)).toFixed(0)} MB).`
    );
  }
  return new Blob([fromBase64(serialized.base64)], {
    type: serialized.mimeType || 'application/octet-stream',
  });
}
