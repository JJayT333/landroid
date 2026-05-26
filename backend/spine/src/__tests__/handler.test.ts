import { describe, expect, it, vi } from 'vitest';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  type BackendSpineRecordValidationResponse,
  type BackendSpineSessionResponse,
} from '../../../../src/backend-spine/contracts';
import {
  MAX_BACKEND_SPINE_REQUEST_BODY_BYTES,
  createBackendSpineHandler,
  type BackendSpineHttpEvent,
} from '../handler';

const now = new Date('2026-05-25T12:00:00.000Z');

function event(
  method: string,
  path: string,
  body?: unknown,
  token = 'good-token'
): BackendSpineHttpEvent {
  return {
    requestContext: { http: { method, path } },
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

function projectRecord(schemaVersion = BACKEND_SPINE_CONTRACT_VERSION) {
  return {
    recordId: 'project-1',
    recordType: 'project',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    schemaVersion,
    lastModified: now.toISOString(),
    revision: 0,
    source: 'local',
    syncState: 'local_only',
    name: 'Vulcan Mesa',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function parseBody<T>(body: string): T {
  return JSON.parse(body) as T;
}

function createTestHandler(options: Parameters<typeof createBackendSpineHandler>[0]) {
  return createBackendSpineHandler({
    now: () => now,
    logEvent: vi.fn(),
    ...options,
  });
}

describe('backend spine handler', () => {
  it('serves unauthenticated health without project storage', async () => {
    const verifyToken = vi.fn();
    const handler = createTestHandler({ verifyToken });

    const response = await handler(event('GET', '/api/spine/health', undefined, ''));

    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body)).toMatchObject({
      ok: true,
      service: 'landroid-backend-spine',
      contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
      mode: 'hosted',
      serverTime: now.toISOString(),
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('rejects session requests with no bearer token', async () => {
    const handler = createTestHandler({
      verifyToken: vi.fn(async () => ({ sub: 'unused' })),
    });

    const response = await handler(event('GET', '/api/spine/session', undefined, ''));

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain('Missing Authorization bearer token');
  });

  it('returns the verified Cognito sub instead of trusting client identity', async () => {
    const verifyToken = vi.fn(async () => ({ sub: 'verified-sub' }));
    const handler = createTestHandler({ verifyToken });

    const response = await handler({
      ...event('GET', '/api/spine/session'),
      body: JSON.stringify({ userSub: 'spoofed-sub' }),
    });
    const body = parseBody<BackendSpineSessionResponse>(response.body);

    expect(response.statusCode).toBe(200);
    expect(verifyToken).toHaveBeenCalledWith('good-token');
    expect(body).toMatchObject({
      authenticated: true,
      userSub: 'verified-sub',
      contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
    });
  });

  it('rejects oversized validation bodies before schema parsing', async () => {
    const verifyToken = vi.fn(async () => ({ sub: 'verified-sub' }));
    const handler = createTestHandler({ verifyToken });
    const response = await handler({
      requestContext: { http: { method: 'POST', path: '/api/spine/validate-records' } },
      headers: { authorization: 'Bearer good-token' },
      body: 'x'.repeat(MAX_BACKEND_SPINE_REQUEST_BODY_BYTES + 1),
    });

    expect(response.statusCode).toBe(413);
    expect(response.body).toContain('Request body is too large');
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('validates backend-shaped records', async () => {
    const handler = createTestHandler({
      verifyToken: vi.fn(async () => ({ sub: 'verified-sub' })),
    });

    const response = await handler(
      event('POST', '/api/spine/validate-records', {
        records: [projectRecord()],
      })
    );
    const body = parseBody<BackendSpineRecordValidationResponse>(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      valid: true,
      acceptedCount: 1,
      issues: [],
    });
  });

  it('rejects future schema versions safely', async () => {
    const handler = createTestHandler({
      verifyToken: vi.fn(async () => ({ sub: 'verified-sub' })),
    });

    const response = await handler(
      event('POST', '/api/spine/validate-records', {
        records: [projectRecord(BACKEND_SPINE_CONTRACT_VERSION + 1)],
      })
    );
    const body = parseBody<BackendSpineRecordValidationResponse>(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.acceptedCount).toBe(0);
    expect(body.issues.map((issue) => issue.path.join('.')).join('\n')).toContain(
      'records.0.schemaVersion'
    );
  });

  it('rejects client-supplied identity fields in validation requests', async () => {
    const handler = createTestHandler({
      verifyToken: vi.fn(async () => ({ sub: 'verified-sub' })),
    });

    const response = await handler(
      event('POST', '/api/spine/validate-records', {
        userSub: 'spoofed-sub',
        records: [projectRecord()],
      })
    );
    const body = parseBody<BackendSpineRecordValidationResponse>(response.body);

    expect(response.statusCode).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.issues.map((issue) => issue.path.join('.')).join('\n')).toContain(
      'userSub'
    );
  });

  it('emits structured logs without request bodies or record payloads', async () => {
    const logEvent = vi.fn();
    const handler = createBackendSpineHandler({
      verifyToken: vi.fn(async () => ({ sub: 'verified-sub' })),
      logEvent,
      now: () => now,
    });

    const response = await handler(
      event('POST', '/api/spine/validate-records', {
        records: [projectRecord()],
      })
    );

    expect(response.statusCode).toBe(200);
    expect(logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        evt: 'request',
        route: 'validate-records',
        user: 'verified-sub',
        acceptedCount: 1,
        status: 200,
      })
    );
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain('Vulcan Mesa');
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain('recordId');
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain('project-1');
  });
});
