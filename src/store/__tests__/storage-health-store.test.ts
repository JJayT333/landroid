import { beforeEach, describe, expect, it } from 'vitest';
import { useStorageHealthStore } from '../storage-health-store';

describe('storage health store', () => {
  beforeEach(() => {
    useStorageHealthStore.setState({
      browserStorageEstimate: null,
      lastExportedAt: null,
      lastSavedAt: null,
      persistentStorage: null,
    });
  });

  it('records last saved and last exported timestamps', () => {
    useStorageHealthStore
      .getState()
      .recordWorkspaceSaved('2026-06-05T12:00:00.000Z');
    useStorageHealthStore
      .getState()
      .recordWorkspaceExported('2026-06-05T12:05:00.000Z');

    expect(useStorageHealthStore.getState().lastSavedAt).toBe(
      '2026-06-05T12:00:00.000Z'
    );
    expect(useStorageHealthStore.getState().lastExportedAt).toBe(
      '2026-06-05T12:05:00.000Z'
    );
  });

  it('records browser storage request and estimate results', () => {
    useStorageHealthStore.getState().setPersistentStorageResult({
      status: 'persisted',
      alreadyPersisted: true,
    });
    useStorageHealthStore.getState().setBrowserStorageEstimate({
      supported: true,
      usage: 1024,
      quota: 2048,
    });

    expect(useStorageHealthStore.getState().persistentStorage).toEqual({
      status: 'persisted',
      alreadyPersisted: true,
    });
    expect(useStorageHealthStore.getState().browserStorageEstimate).toEqual({
      supported: true,
      usage: 1024,
      quota: 2048,
    });
  });
});
