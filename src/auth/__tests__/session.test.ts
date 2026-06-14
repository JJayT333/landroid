import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getIdToken,
  setIdToken,
  setUnauthorizedHandler,
  triggerUnauthorized,
} from '../session';

afterEach(() => {
  setIdToken(null);
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
});

function stubWindowSessionStorage() {
  const items = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      get length() {
        return items.size;
      },
      key: (index: number) => Array.from(items.keys())[index] ?? null,
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    },
  });
}

describe('auth/session', () => {
  describe('id token holder', () => {
    it('returns null before any token is set (local dev path)', async () => {
      await expect(getIdToken()).resolves.toBeNull();
    });
    it('round-trips a token through set/get', async () => {
      setIdToken('jwt.header.body.sig');
      await expect(getIdToken()).resolves.toBe('jwt.header.body.sig');
    });
    it('clears the token when set to null (sign-out)', async () => {
      setIdToken('jwt');
      setIdToken(null);
      await expect(getIdToken()).resolves.toBeNull();
    });
    it('falls back to oidc-client sessionStorage when the in-memory bridge is empty', async () => {
      stubWindowSessionStorage();
      window.sessionStorage.setItem(
        'oidc.user:https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pool:client',
        JSON.stringify({ id_token: 'stored.id.token', expired: false })
      );
      await expect(getIdToken()).resolves.toBe('stored.id.token');
    });
    it('ignores expired oidc-client sessionStorage users', async () => {
      stubWindowSessionStorage();
      window.sessionStorage.setItem(
        'oidc.user:https://cognito-idp.us-east-1.amazonaws.com/us-east-1_pool:client',
        JSON.stringify({ id_token: 'expired.id.token', expired: true })
      );
      await expect(getIdToken()).resolves.toBeNull();
    });
  });

  describe('unauthorized handler', () => {
    it('is a no-op when nothing is registered', () => {
      expect(() => triggerUnauthorized()).not.toThrow();
    });
    it('invokes the registered handler exactly once per trigger', () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      triggerUnauthorized();
      expect(handler).toHaveBeenCalledTimes(1);
      triggerUnauthorized();
      expect(handler).toHaveBeenCalledTimes(2);
    });
    it('replaces the previous handler on re-registration', () => {
      const first = vi.fn();
      const second = vi.fn();
      setUnauthorizedHandler(first);
      setUnauthorizedHandler(second);
      triggerUnauthorized();
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
    it('stops calling the handler after it is cleared', () => {
      const handler = vi.fn();
      setUnauthorizedHandler(handler);
      setUnauthorizedHandler(null);
      triggerUnauthorized();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
