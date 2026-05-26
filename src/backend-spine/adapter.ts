import {
  BACKEND_SPINE_CONTRACT_VERSION,
  BackendSpineHealthResponseSchema,
  BackendSpineRecordValidationResponseSchema,
  BackendSpineSessionResponseSchema,
  type BackendSpineCoreRecord,
  type BackendSpineHealthResponse,
  type BackendSpineRecordValidationResponse,
  type BackendSpineSessionResponse,
} from './contracts';

export type BackendSpineMode = 'local-only' | 'mock' | 'hosted';

export interface BackendSpineAdapter {
  mode: BackendSpineMode;
  health(): Promise<BackendSpineHealthResponse>;
  session(): Promise<BackendSpineSessionResponse>;
  validateRecords(records: BackendSpineCoreRecord[]): Promise<BackendSpineRecordValidationResponse>;
}

export interface HostedBackendSpineAdapterOptions {
  baseUrl?: string;
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

function nowIso(): string {
  return new Date().toISOString();
}

function localHealth(mode: BackendSpineMode): BackendSpineHealthResponse {
  return {
    ok: true,
    service: 'landroid-backend-spine',
    contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
    mode,
    serverTime: nowIso(),
  };
}

export function createLocalOnlyBackendSpineAdapter(): BackendSpineAdapter {
  return {
    mode: 'local-only',
    async health() {
      return BackendSpineHealthResponseSchema.parse(localHealth('local-only'));
    },
    async session() {
      return BackendSpineSessionResponseSchema.parse({
        ...localHealth('local-only'),
        authenticated: false,
        userSub: null,
      });
    },
    async validateRecords(records) {
      return BackendSpineRecordValidationResponseSchema.parse({
        ...localHealth('local-only'),
        valid: true,
        acceptedCount: records.length,
        issues: [],
      });
    },
  };
}

export function createMockBackendSpineAdapter(
  userSub = 'mock-user'
): BackendSpineAdapter {
  return {
    mode: 'mock',
    async health() {
      return BackendSpineHealthResponseSchema.parse(localHealth('mock'));
    },
    async session() {
      return BackendSpineSessionResponseSchema.parse({
        ...localHealth('mock'),
        authenticated: true,
        userSub,
      });
    },
    async validateRecords(records) {
      return BackendSpineRecordValidationResponseSchema.parse({
        ...localHealth('mock'),
        valid: true,
        acceptedCount: records.length,
        issues: [],
      });
    },
  };
}

export function createHostedBackendSpineAdapter(
  options: HostedBackendSpineAdapterOptions
): BackendSpineAdapter {
  const baseUrl = (options.baseUrl ?? '/api/spine').replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;

  async function requestJson<T>(
    path: string,
    init: RequestInit,
    parse: (value: unknown) => T
  ): Promise<T> {
    const token = await options.getToken();
    if (!token) {
      throw new Error('Hosted backend spine request is missing a Cognito ID token.');
    }
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = readErrorMessage(payload) ?? `Backend spine request failed (${response.status}).`;
      throw new Error(message);
    }
    return parse(payload);
  }

  return {
    mode: 'hosted',
    async health() {
      const response = await fetchImpl(`${baseUrl}/health`, { method: 'GET' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`Backend spine health check failed (${response.status}).`);
      }
      return BackendSpineHealthResponseSchema.parse(payload);
    },
    async session() {
      return requestJson('/session', { method: 'GET' }, (payload) =>
        BackendSpineSessionResponseSchema.parse(payload)
      );
    },
    async validateRecords(records) {
      return requestJson(
        '/validate-records',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ records }),
        },
        (payload) => BackendSpineRecordValidationResponseSchema.parse(payload)
      );
    },
  };
}

function readErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const error = 'error' in payload ? payload.error : null;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    return typeof message === 'string' ? message : null;
  }
  if ('message' in payload) {
    const message = payload.message;
    return typeof message === 'string' ? message : null;
  }
  return null;
}
