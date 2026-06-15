import { beforeEach, describe, expect, it } from 'vitest';
import {
  useStorageHealthStore,
  withQuotaErrorReporting,
} from '../storage-health-store';

describe('storage health store', () => {
  beforeEach(() => {
    useStorageHealthStore.setState({
      browserStorageEstimate: null,
      lastExportedAt: null,
      lastSavedAt: null,
      persistentStorage: null,
      rollingAutoExport: {
        directoryName: null,
        enabled: false,
        isWriting: false,
        lastAutoExportedAt: null,
        lastAutoExportError: null,
        lastAutoExportFileName: null,
        pendingExportDueAt: null,
        permission: 'unknown',
        support: 'checking',
        warning: null,
      },
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

  it('tracks rolling auto-export configuration and snapshots', () => {
    useStorageHealthStore.getState().setRollingAutoExportSupported();
    useStorageHealthStore.getState().configureRollingAutoExportDirectory({
      directoryName: 'LANDroid Backups',
      permission: 'granted',
    });
    useStorageHealthStore
      .getState()
      .recordRollingAutoExportScheduled('2026-06-05T12:05:00.000Z');
    useStorageHealthStore.getState().recordRollingAutoExportStarted();
    useStorageHealthStore.getState().recordRollingAutoExported({
      exportedAt: '2026-06-05T12:01:00.000Z',
      fileName: 'Raven Forest-2026-06-05T12-01-00-000Z.landroid',
    });

    expect(useStorageHealthStore.getState().rollingAutoExport).toMatchObject({
      directoryName: 'LANDroid Backups',
      enabled: true,
      isWriting: false,
      lastAutoExportedAt: '2026-06-05T12:01:00.000Z',
      lastAutoExportFileName: 'Raven Forest-2026-06-05T12-01-00-000Z.landroid',
      pendingExportDueAt: null,
      permission: 'granted',
      support: 'supported',
      warning: null,
    });
  });

  it('marks rolling auto-export as manual fallback when unsupported or denied', () => {
    useStorageHealthStore.getState().setRollingAutoExportUnsupported();

    expect(useStorageHealthStore.getState().rollingAutoExport).toMatchObject({
      enabled: false,
      support: 'unsupported',
      warning:
        'Rolling auto-export needs browser folder access. Use Backup Now for manual .landroid backups.',
    });

    useStorageHealthStore.getState().setRollingAutoExportSupported();
    useStorageHealthStore.getState().configureRollingAutoExportDirectory({
      directoryName: 'LANDroid Backups',
      permission: 'granted',
    });
    useStorageHealthStore.getState().recordRollingAutoExportError(
      'Auto-export folder permission is unavailable. Use Backup Now or choose the folder again.',
      'denied'
    );

    expect(useStorageHealthStore.getState().rollingAutoExport).toMatchObject({
      enabled: true,
      permission: 'denied',
      warning:
        'Auto-export folder permission is unavailable. Use Backup Now or choose the folder again.',
    });
  });
});

describe('storage-quota surfacing (DA-M11)', () => {
  beforeEach(() => {
    useStorageHealthStore.getState().clearPersistenceError();
  });

  const quotaError = () =>
    new DOMException('The quota has been exceeded.', 'QuotaExceededError');

  it('records a quota failure on the health store and rethrows', async () => {
    await expect(
      withQuotaErrorReporting('Workspace save', async () => {
        throw quotaError();
      })
    ).rejects.toBeInstanceOf(DOMException);

    expect(
      useStorageHealthStore.getState().lastPersistenceError?.message
    ).toMatch(/storage is full/i);
  });

  it('does not record non-quota errors but still rethrows', async () => {
    await expect(
      withQuotaErrorReporting('Workspace save', async () => {
        throw new Error('unrelated failure');
      })
    ).rejects.toThrow('unrelated failure');

    expect(useStorageHealthStore.getState().lastPersistenceError).toBeNull();
  });

  it('returns the value on success', async () => {
    const value = await withQuotaErrorReporting('Workspace save', async () => 42);
    expect(value).toBe(42);
  });

  it('clears the quota warning on the next successful workspace save', () => {
    useStorageHealthStore.getState().recordPersistenceError('full');
    expect(useStorageHealthStore.getState().lastPersistenceError).not.toBeNull();

    useStorageHealthStore.getState().recordWorkspaceSaved();
    expect(useStorageHealthStore.getState().lastPersistenceError).toBeNull();
  });
});
