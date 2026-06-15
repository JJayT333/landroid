import { describe, expect, it } from 'vitest';
import {
  MAX_DESERIALIZED_BLOB_BYTES,
  deserializeBlob,
  deserializePdfBlob,
  serializeBlob,
} from '../blob-serialization';

describe('blob-serialization (audit M3 per-blob cap)', () => {
  it('roundtrips small blobs', async () => {
    const source = new Blob([new Uint8Array([1, 2, 3, 4, 5])], {
      type: 'application/octet-stream',
    });
    const serialized = await serializeBlob(source);
    const restored = deserializeBlob(serialized);
    expect(restored.size).toBe(5);
    expect(restored.type).toBe('application/octet-stream');
  });

  it('encodes via the chunked browser fallback identically to the Buffer path (DA-L7)', async () => {
    // >64KB so the fallback spans multiple 0x8000 chunks.
    const bytes = new Uint8Array(0x8000 * 2 + 123);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 31 + 7) & 0xff;
    }
    const reference = Buffer.from(bytes).toString('base64');

    const originalBuffer = (globalThis as { Buffer?: unknown }).Buffer;
    try {
      // Force the no-Buffer browser path.
      (globalThis as { Buffer?: unknown }).Buffer = undefined;
      const serialized = await serializeBlob(
        new Blob([bytes], { type: 'application/octet-stream' })
      );
      expect(serialized.base64).toBe(reference);
    } finally {
      (globalThis as { Buffer?: unknown }).Buffer = originalBuffer;
    }

    const restored = deserializeBlob({
      mimeType: 'application/octet-stream',
      base64: reference,
    });
    const restoredBytes = new Uint8Array(await restored.arrayBuffer());
    expect(Array.from(restoredBytes)).toEqual(Array.from(bytes));
  });

  it('rejects a blob whose encoded size blows the cap', () => {
    // Base64 encodes 3 bytes -> 4 chars, so we need a little over
    // MAX_DESERIALIZED_BLOB_BYTES * 4 / 3 characters to trip the guard.
    const oversizedChars = Math.ceil(MAX_DESERIALIZED_BLOB_BYTES * (4 / 3)) + 16;
    const base64 = 'A'.repeat(oversizedChars);
    expect(() =>
      deserializeBlob({ mimeType: 'application/pdf', base64 })
    ).toThrow(/too large to deserialize/i);
  });

  it('accepts a blob whose decoded size fits under the cap', () => {
    // Roughly 1 MB of payload
    const bytes = new Uint8Array(1024 * 1024);
    const base64 = Buffer.from(bytes).toString('base64');
    expect(() =>
      deserializeBlob({ mimeType: 'application/octet-stream', base64 })
    ).not.toThrow();
  });

  it('normalizes serialized PDF blobs to application/pdf after magic-byte validation', () => {
    const base64 = Buffer.from('%PDF-1.7\n% test fixture').toString('base64');
    const restored = deserializePdfBlob({
      mimeType: 'text/html',
      base64,
    });
    expect(restored.type).toBe('application/pdf');
    expect(restored.size).toBeGreaterThan(0);
  });

  it('rejects serialized PDF blobs without a PDF header even when MIME claims PDF', () => {
    const base64 = Buffer.from('<script>alert(1)</script>').toString('base64');
    expect(() =>
      deserializePdfBlob({ mimeType: 'application/pdf', base64 }, 'Imported PDF')
    ).toThrow(/valid PDF file/i);
  });
});
