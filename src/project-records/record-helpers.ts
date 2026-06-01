import {
  BACKEND_SPINE_CONTRACT_VERSION,
  type BackendSpineRecordSource,
  type BackendSpineRecordType,
  type BackendSpineSyncState,
} from '../backend-spine/contracts';

export interface RecordBuildContext {
  workspaceId: string;
  projectId: string;
  generatedAt: string;
  revision: number;
  source: BackendSpineRecordSource;
  syncState?: BackendSpineSyncState;
}

export const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/;

export function cleanRecordText(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function fallbackRecordText(
  value: string | null | undefined,
  fallback: string
): string {
  return cleanRecordText(value) || fallback;
}

export function hashStableText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function slugRecordText(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72)
    || 'record'
  );
}

export function stableRecordId(...parts: string[]): string {
  const raw = parts.map((part) => cleanRecordText(part) || 'unknown').join(':');
  if (raw.length <= 150) return raw;
  return `${raw.slice(0, 120)}:${hashStableText(raw)}`;
}

export function dateOnlyRecordValue(
  value: string | null | undefined
): string | undefined {
  const candidate = cleanRecordText(value);
  if (!candidate) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  const parsed = new Date(candidate);
  if (!Number.isFinite(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export function dateTimeRecordValue(
  value: string | null | undefined,
  fallback: string
): string {
  const candidate = cleanRecordText(value);
  if (!candidate) return fallback;
  const parsed = new Date(candidate);
  if (!Number.isFinite(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

export function requireContentHash(value: string, label: string): string {
  const candidate = cleanRecordText(value).toLowerCase();
  if (CONTENT_HASH_PATTERN.test(candidate)) return candidate;
  throw new Error(`${label} is missing a valid sha-256 contentHash.`);
}

export function baseRecordEnvelope(
  recordType: BackendSpineRecordType,
  recordId: string,
  context: RecordBuildContext
) {
  return {
    recordId,
    recordType,
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: context.generatedAt,
    revision: context.revision,
    source: context.source,
    syncState: context.syncState,
  };
}

export async function sha256HexOfText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  const out: string[] = new Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) {
    out[index] = bytes[index].toString(16).padStart(2, '0');
  }
  return out.join('');
}
