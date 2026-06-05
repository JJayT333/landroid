import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StorageHealthIndicatorContent } from '../StorageHealthIndicator';
import type { RollingAutoExportState } from '../../../store/storage-health-store';

const rollingAutoExportOff: RollingAutoExportState = {
  directoryName: null,
  enabled: false,
  isWriting: false,
  lastAutoExportedAt: null,
  lastAutoExportError: null,
  lastAutoExportFileName: null,
  pendingExportDueAt: null,
  permission: 'unknown',
  support: 'supported',
  warning: null,
};

const noop = vi.fn();

describe('StorageHealthIndicator', () => {
  it('renders pending storage health before save/export signals arrive', () => {
    const html = renderToStaticMarkup(
      <StorageHealthIndicatorContent
        lastSavedAt={null}
        lastExportedAt={null}
        persistentStorage={null}
        browserStorageEstimate={null}
        rollingAutoExport={rollingAutoExportOff}
        onBackupNow={noop}
        onConfigureAutoExport={noop}
        onDisableAutoExport={noop}
      />
    );

    expect(html).toContain('Storage health');
    expect(html).toContain('Saved');
    expect(html).toContain('Backup');
    expect(html).toContain('Auto');
    expect(html).toContain('none');
    expect(html).toContain('pending');
    expect(html).toContain('off');
    expect(html).toContain('Backup Now');
    expect(html).toContain('Auto Export');
  });

  it('surfaces saved, exported, persisted, and estimate state', () => {
    const html = renderToStaticMarkup(
      <StorageHealthIndicatorContent
        lastSavedAt="2026-06-05T12:00:00.000Z"
        lastExportedAt="2026-06-05T12:05:00.000Z"
        persistentStorage={{
          status: 'persisted',
          alreadyPersisted: true,
        }}
        browserStorageEstimate={{
          supported: true,
          usage: 1024,
          quota: 2048,
        }}
        rollingAutoExport={{
          ...rollingAutoExportOff,
          directoryName: 'LANDroid Backups',
          enabled: true,
          lastAutoExportedAt: '2026-06-05T12:04:00.000Z',
          lastAutoExportFileName:
            'Raven Forest-2026-06-05T12-04-00-000Z.landroid',
          permission: 'granted',
        }}
        onBackupNow={noop}
        onConfigureAutoExport={noop}
        onDisableAutoExport={noop}
      />
    );

    expect(html).toContain('persistent 50.0%');
    expect(html).toContain('1.0 KB used of 2.0 KB');
    expect(html).toContain('LANDroid Backups');
    expect(html).toContain('Change Folder');
    expect(html).toContain('Off');
    expect(html).not.toContain('Storage estimate pending');
  });

  it('surfaces best-effort browser storage when persistence is denied', () => {
    const html = renderToStaticMarkup(
      <StorageHealthIndicatorContent
        lastSavedAt={null}
        lastExportedAt={null}
        persistentStorage={{
          status: 'denied',
          alreadyPersisted: false,
        }}
        browserStorageEstimate={{
          supported: false,
          usage: null,
          quota: null,
        }}
        rollingAutoExport={{
          ...rollingAutoExportOff,
          support: 'unsupported',
          warning:
            'Rolling auto-export needs browser folder access. Use Backup Now for manual .landroid backups.',
        }}
        onBackupNow={noop}
        onConfigureAutoExport={noop}
        onDisableAutoExport={noop}
      />
    );

    expect(html).toContain('best effort');
    expect(html).toContain('Storage estimate unavailable');
    expect(html).toContain('manual only');
    expect(html).toContain('disabled');
  });

  it('surfaces queued and overdue rolling auto-export states', () => {
    const queued = renderToStaticMarkup(
      <StorageHealthIndicatorContent
        lastSavedAt={null}
        lastExportedAt={null}
        persistentStorage={null}
        browserStorageEstimate={null}
        rollingAutoExport={{
          ...rollingAutoExportOff,
          directoryName: 'Backups',
          enabled: true,
          pendingExportDueAt: '2026-06-05T12:05:00.000Z',
          permission: 'granted',
        }}
        onBackupNow={noop}
        onConfigureAutoExport={noop}
        onDisableAutoExport={noop}
      />
    );
    const overdue = renderToStaticMarkup(
      <StorageHealthIndicatorContent
        lastSavedAt={null}
        lastExportedAt={null}
        persistentStorage={null}
        browserStorageEstimate={null}
        rollingAutoExport={{
          ...rollingAutoExportOff,
          directoryName: 'Backups',
          enabled: true,
          permission: 'granted',
          warning:
            'Rolling auto-export is overdue. Use Backup Now or choose the folder again.',
        }}
        onBackupNow={noop}
        onConfigureAutoExport={noop}
        onDisableAutoExport={noop}
      />
    );

    expect(queued).toContain('queued');
    expect(overdue).toContain('overdue');
    expect(overdue).toContain('Rolling auto-export is overdue');
  });
});
