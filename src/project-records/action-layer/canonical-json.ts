/**
 * Deterministic JSON serialization — the hashing substrate for the action
 * layer's audit chain and any content-addressed action record.
 *
 * Properties that the audit hash chain depends on:
 * - Object keys are emitted in code-unit (not locale) order, so the same
 *   logical record always serializes identically across environments.
 * - `undefined` object values are omitted (matching how Zod `.parse` drops
 *   absent optionals), so `{ a: 1 }` and `{ a: 1, b: undefined }` hash equal.
 * - Arrays preserve order; `undefined`/function array slots serialize as `null`
 *   (mirrors `JSON.stringify`).
 *
 * This is intentionally dependency-free and does not rely on `JSON.stringify`'s
 * key order, which follows insertion order and would make hashes order-sensitive.
 */

function serialize(value: unknown): string {
  if (value === undefined || value === null) return 'null';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }
  if (typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    return JSON.stringify(value.toString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => serialize(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${serialize(entryValue)}`)
      .join(',')}}`;
  }
  // functions, symbols — not expected in record data; serialize as null.
  return 'null';
}

/** Stable, key-sorted JSON string for hashing / content addressing. */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}
