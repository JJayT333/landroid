export interface SerializedBlob {
  mimeType: string;
  base64: string;
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
  return new Blob([fromBase64(serialized.base64)], {
    type: serialized.mimeType || 'application/octet-stream',
  });
}
