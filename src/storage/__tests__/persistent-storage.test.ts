import { describe, expect, it, vi } from 'vitest';
import {
  estimateBrowserStorage,
  requestPersistentStorage,
} from '../persistent-storage';

describe('requestPersistentStorage', () => {
  it('reports unsupported when the Storage API is absent', async () => {
    await expect(requestPersistentStorage({ storage: undefined })).resolves.toEqual({
      status: 'unsupported',
      alreadyPersisted: false,
    });

    await expect(requestPersistentStorage({ storage: {} })).resolves.toEqual({
      status: 'unsupported',
      alreadyPersisted: false,
    });
  });

  it('skips the request when storage is already persistent', async () => {
    const persist = vi.fn(async () => true);
    const result = await requestPersistentStorage({
      storage: { persisted: async () => true, persist },
    });

    expect(result).toEqual({ status: 'persisted', alreadyPersisted: true });
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports persisted when the browser grants the request', async () => {
    const result = await requestPersistentStorage({
      storage: { persisted: async () => false, persist: async () => true },
    });

    expect(result).toEqual({ status: 'persisted', alreadyPersisted: false });
  });

  it('reports denied when the browser declines', async () => {
    const result = await requestPersistentStorage({
      storage: { persisted: async () => false, persist: async () => false },
    });

    expect(result).toEqual({ status: 'denied', alreadyPersisted: false });
  });

  it('requests directly when persisted() is unavailable', async () => {
    const result = await requestPersistentStorage({
      storage: { persist: async () => true },
    });

    expect(result).toEqual({ status: 'persisted', alreadyPersisted: false });
  });

  it('reports error when the request throws', async () => {
    const result = await requestPersistentStorage({
      storage: {
        persisted: async () => false,
        persist: async () => {
          throw new Error('quota probe failed');
        },
      },
    });

    expect(result).toEqual({
      status: 'error',
      alreadyPersisted: false,
      error: 'quota probe failed',
    });
  });
});

describe('estimateBrowserStorage', () => {
  it('reports unsupported when estimate() is absent', async () => {
    await expect(estimateBrowserStorage({ storage: undefined })).resolves.toEqual({
      supported: false,
      usage: null,
      quota: null,
    });

    await expect(estimateBrowserStorage({ storage: {} })).resolves.toEqual({
      supported: false,
      usage: null,
      quota: null,
    });
  });

  it('normalizes browser storage usage and quota', async () => {
    await expect(
      estimateBrowserStorage({
        storage: {
          estimate: async () => ({ usage: 1024, quota: 2048 }),
        },
      })
    ).resolves.toEqual({
      supported: true,
      usage: 1024,
      quota: 2048,
    });
  });

  it('keeps estimate failures diagnostic-only', async () => {
    await expect(
      estimateBrowserStorage({
        storage: {
          estimate: async () => {
            throw new Error('estimate failed');
          },
        },
      })
    ).resolves.toEqual({
      supported: true,
      usage: null,
      quota: null,
      error: 'estimate failed',
    });
  });
});
