import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiBaseUrl, isHostedMode } from '../deploy-env';

function mockLocation(hostname: string, protocol = 'https:'): void {
  vi.stubGlobal('window', {
    location: { hostname, protocol },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('deploy-env', () => {
  describe('isHostedMode', () => {
    it('returns false for localhost', () => {
      mockLocation('localhost');
      expect(isHostedMode()).toBe(false);
    });
    it('returns false for 127.0.0.1', () => {
      mockLocation('127.0.0.1');
      expect(isHostedMode()).toBe(false);
    });
    it('returns false for 0.0.0.0', () => {
      mockLocation('0.0.0.0');
      expect(isHostedMode()).toBe(false);
    });
    it('returns false for empty hostname', () => {
      mockLocation('');
      expect(isHostedMode()).toBe(false);
    });
    it('returns false when loaded from file:// (launcher)', () => {
      mockLocation('', 'file:');
      expect(isHostedMode()).toBe(false);
    });
    it('returns true for the production hostname', () => {
      mockLocation('landroid.abstractmapping.com');
      expect(isHostedMode()).toBe(true);
    });
    it('returns true for the Amplify default preview domain', () => {
      mockLocation('main.abc123xyz.amplifyapp.com');
      expect(isHostedMode()).toBe(true);
    });
  });

  describe('apiBaseUrl', () => {
    it('is a relative /api prefix so the Amplify rewrite takes over', () => {
      expect(apiBaseUrl()).toBe('/api');
    });
  });
});
