import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKEND_SPINE_CONTRACT_VERSION,
  type BackendSpineSessionResponse,
} from '../../../../src/backend-spine/contracts';
import type { BackendSpineHttpEvent, BackendSpineHttpResponse } from '../handler';

const verifyToken = vi.fn<(token: string) => Promise<{ sub: string }>>();
const createVerifier = vi.fn(() => ({
  verify: verifyToken,
}));

async function loadLambda(): Promise<{
  handler: (event: BackendSpineHttpEvent) => Promise<BackendSpineHttpResponse>;
}> {
  vi.resetModules();
  vi.stubEnv('COGNITO_USER_POOL_ID', 'us-east-1_test');
  vi.stubEnv('COGNITO_CLIENT_ID', 'client-123');
  vi.doMock('aws-jwt-verify', () => ({
    CognitoJwtVerifier: {
      create: createVerifier,
    },
  }));

  return import('../lambda');
}

function event(method: string, path: string, token = 'good-token'): BackendSpineHttpEvent {
  return {
    requestContext: { http: { method, path } },
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function parseBody<T>(body: string): T {
  return JSON.parse(body) as T;
}

describe('backend spine lambda wrapper', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    verifyToken.mockReset();
    createVerifier.mockClear();
    vi.doUnmock('aws-jwt-verify');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('serves health without verifying a Cognito token', async () => {
    const { handler } = await loadLambda();

    const response = await handler(event('GET', '/api/spine/health', ''));

    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body)).toMatchObject({
      ok: true,
      service: 'landroid-backend-spine',
      contractVersion: BACKEND_SPINE_CONTRACT_VERSION,
      mode: 'hosted',
    });
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('returns the verified Cognito sub for hosted sessions', async () => {
    verifyToken.mockResolvedValue({ sub: 'verified-sub' });
    const { handler } = await loadLambda();

    const response = await handler(event('GET', '/api/spine/session'));
    const body = parseBody<BackendSpineSessionResponse>(response.body);

    expect(response.statusCode).toBe(200);
    expect(verifyToken).toHaveBeenCalledWith('good-token');
    expect(body).toMatchObject({
      authenticated: true,
      userSub: 'verified-sub',
    });
    expect(createVerifier).toHaveBeenCalledWith({
      userPoolId: 'us-east-1_test',
      tokenUse: 'id',
      clientId: 'client-123',
    });
  });

  it('rejects invalid Cognito tokens before returning a session', async () => {
    verifyToken.mockRejectedValue(new Error('bad token'));
    const { handler } = await loadLambda();

    const response = await handler(event('GET', '/api/spine/session', 'bad-token'));

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain('Invalid or expired token');
  });

  it('fails fast when Cognito environment is missing', async () => {
    vi.resetModules();
    vi.stubEnv('COGNITO_USER_POOL_ID', '');
    vi.stubEnv('COGNITO_CLIENT_ID', 'client-123');
    vi.doMock('aws-jwt-verify', () => ({
      CognitoJwtVerifier: {
        create: createVerifier,
      },
    }));

    await expect(import('../lambda')).rejects.toThrow(/COGNITO_USER_POOL_ID/);
  });
});
