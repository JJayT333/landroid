import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceId } from '../workspace-id';

describe('createWorkspaceId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '11111111-2222-4333-8444-555555555555',
    });

    expect(createWorkspaceId()).toBe('ws-11111111-2222-4333-8444-555555555555');
  });

  it('keeps a fallback for runtimes without randomUUID', () => {
    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(12345);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(createWorkspaceId()).toBe('ws-12345-i');
  });
});
