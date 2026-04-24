import { describe, expect, it } from 'vitest';
import {
  MAX_DESERIALIZED_BLOB_BYTES,
  deserializeBlob,
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
});
