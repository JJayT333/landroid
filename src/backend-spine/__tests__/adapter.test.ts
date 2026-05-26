import { describe, expect, it, vi } from 'vitest';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  ProjectRecordSchema,
} from '../contracts';
import {
  createHostedBackendSpineAdapter,
  createLocalOnlyBackendSpineAdapter,
  createMockBackendSpineAdapter,
} from '../adapter';

const now = '2026-05-25T12:00:00.000Z';

function projectRecord() {
  return ProjectRecordSchema.parse({
    recordId: 'project-1',
    recordType: 'project',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    schemaVersion: BACKEND_SPINE_CONTRACT_VERSION,
    lastModified: now,
    revision: 0,
    source: 'local',
    syncState: 'local_only',
    name: 'Vulcan Mesa',
    createdAt: now,
    updatedAt: now,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('backend spine adapters', () => {
  it('keeps local-only mode offline and unauthenticated', async () => {
    const adapter = createLocalOnlyBackendSpineAdapter();

    await expect(adapter.health()).resolves.toMatchObject({
      ok: true,
      mode: 'local-only',
      contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
    });
    await expect(adapter.session()).resolves.toMatchObject({
      authenticated: false,
      userSub: null,
    });
    await expect(adapter.validateRecords([projectRecord()])).resolves.toMatchObject({
      valid: true,
      acceptedCount: 1,
    });
  });

  it('provides a deterministic mock mode for non-network contract checks', async () => {
    const adapter = createMockBackendSpineAdapter('mock-sub');

    await expect(adapter.session()).resolves.toMatchObject({
      mode: 'mock',
      authenticated: true,
      userSub: 'mock-sub',
    });
  });

  it('attaches Cognito bearer tokens on hosted session and validation calls', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/session')) {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer id-token');
        return jsonResponse({
          ok: true,
          service: 'landroid-backend-spine',
          contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
          mode: 'hosted',
          serverTime: now,
          authenticated: true,
          userSub: 'cognito-sub',
        });
      }
      if (url.endsWith('/validate-records')) {
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer id-token');
        expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
        return jsonResponse({
          ok: true,
          service: 'landroid-backend-spine',
          contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
          mode: 'hosted',
          serverTime: now,
          valid: true,
          acceptedCount: 1,
          issues: [],
        });
      }
      return jsonResponse({ error: { message: 'unexpected route' } }, 404);
    });
    const adapter = createHostedBackendSpineAdapter({
      baseUrl: '/api/spine',
      getToken: async () => 'id-token',
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(adapter.session()).resolves.toMatchObject({ userSub: 'cognito-sub' });
    await expect(adapter.validateRecords([projectRecord()])).resolves.toMatchObject({
      valid: true,
      acceptedCount: 1,
    });
  });

  it('fails hosted calls before fetch when no ID token is available', async () => {
    const fetchMock = vi.fn();
    const adapter = createHostedBackendSpineAdapter({
      getToken: async () => null,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });

    await expect(adapter.session()).rejects.toThrow(/missing a Cognito ID token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
