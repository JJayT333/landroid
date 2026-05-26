import { describe, expect, it, vi } from 'vitest';
import {
  createBackendSpineAdapterForApp,
  createBackendSpineContractProbeRecord,
  runBackendSpineContractCheck,
} from '../app-contract-check';
import { BACKEND_SPINE_CONTRACT_VERSION } from '../contracts';

const now = new Date('2026-05-26T12:00:00.000Z');

function healthBody() {
  return {
    ok: true,
    service: 'landroid-backend-spine',
    contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
    mode: 'hosted',
    serverTime: now.toISOString(),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('backend spine app contract check', () => {
  it('uses local-only mode in local app contexts without fetching', async () => {
    const fetchMock = vi.fn();

    const result = await runBackendSpineContractCheck({
      fetchImpl: fetchMock as unknown as typeof fetch,
      isHosted: () => false,
      now: () => now,
    });

    expect(result).toMatchObject({
      status: 'passed',
      mode: 'local-only',
      checkedAt: now.toISOString(),
      contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
      authenticated: false,
      userSub: null,
      acceptedCount: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds a hosted adapter with the app API spine base URL', () => {
    const adapter = createBackendSpineAdapterForApp({
      isHosted: () => true,
      getToken: async () => 'id-token',
    });

    expect(adapter.mode).toBe('hosted');
  });

  it('checks hosted health, session, and synthetic record validation without project data', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/spine/health') {
        expect(new Headers(init?.headers).get('authorization')).toBeNull();
        return jsonResponse(healthBody());
      }
      if (url === '/api/spine/session') {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer id-token');
        return jsonResponse({
          ...healthBody(),
          authenticated: true,
          userSub: 'cognito-sub',
        });
      }
      if (url === '/api/spine/validate-records') {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer id-token');
        expect(init?.body).toBe(
          JSON.stringify({ records: [createBackendSpineContractProbeRecord(now.toISOString())] })
        );
        return jsonResponse({
          ...healthBody(),
          valid: true,
          acceptedCount: 1,
          issues: [],
        });
      }
      return jsonResponse({ error: { message: 'unexpected route' } }, 404);
    });

    const result = await runBackendSpineContractCheck({
      fetchImpl: fetchMock as unknown as typeof fetch,
      getToken: async () => 'id-token',
      isHosted: () => true,
      now: () => now,
    });

    expect(result).toMatchObject({
      status: 'passed',
      mode: 'hosted',
      checkedAt: now.toISOString(),
      contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
      authenticated: true,
      userSub: 'cognito-sub',
      acceptedCount: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns a failed internal result instead of throwing when hosted auth is missing', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(healthBody()));
    const logger = { info: vi.fn(), warn: vi.fn() };

    const result = await runBackendSpineContractCheck({
      fetchImpl: fetchMock as unknown as typeof fetch,
      getToken: async () => null,
      isHosted: () => true,
      logger,
      now: () => now,
    });

    expect(result).toMatchObject({
      status: 'failed',
      mode: 'hosted',
      checkedAt: now.toISOString(),
    });
    expect(result.error).toMatch(/missing a Cognito ID token/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('backend spine contract check failed (hosted)')
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('fails the hidden check when record validation rejects the empty probe', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/health')) return jsonResponse(healthBody());
      if (url.endsWith('/session')) {
        return jsonResponse({
          ...healthBody(),
          authenticated: true,
          userSub: 'cognito-sub',
        });
      }
      return jsonResponse({
        ...healthBody(),
        valid: false,
        acceptedCount: 0,
        issues: [{ index: 0, path: [], message: 'rejected' }],
      });
    });
    const logger = { warn: vi.fn() };

    const result = await runBackendSpineContractCheck({
      fetchImpl: fetchMock as unknown as typeof fetch,
      getToken: async () => 'id-token',
      isHosted: () => true,
      logger,
      now: () => now,
    });

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/rejected the synthetic contract probe/);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
