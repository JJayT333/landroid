import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StorageHealthIndicatorContent } from '../StorageHealthIndicator';

describe('StorageHealthIndicator', () => {
  it('renders pending storage health before save/export signals arrive', () => {
    const html = renderToStaticMarkup(
      <StorageHealthIndicatorContent
        lastSavedAt={null}
        lastExportedAt={null}
        persistentStorage={null}
        browserStorageEstimate={null}
        onBackupNow={vi.fn()}
      />
    );

    expect(html).toContain('Storage health');
    expect(html).toContain('Saved');
    expect(html).toContain('Backup');
    expect(html).toContain('none');
    expect(html).toContain('pending');
    expect(html).toContain('Backup Now');
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
        onBackupNow={vi.fn()}
      />
    );

    expect(html).toContain('persistent 50.0%');
    expect(html).toContain('1.0 KB used of 2.0 KB');
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
        onBackupNow={vi.fn()}
      />
    );

    expect(html).toContain('best effort');
    expect(html).toContain('Storage estimate unavailable');
  });
});
