import { beforeEach, describe, expect, it } from 'vitest';
import { isWorkspaceReadOnly, useWriteLeaseStore } from '../write-lease-store';

describe('write-lease-store', () => {
  beforeEach(() => {
    useWriteLeaseStore.setState({ role: 'idle', workspaceId: null });
  });

  it('treats only the reader role as read-only', () => {
    expect(isWorkspaceReadOnly('reader')).toBe(true);
    expect(isWorkspaceReadOnly('writer')).toBe(false);
    expect(isWorkspaceReadOnly('idle')).toBe(false);
  });

  it('records the latest role transition', () => {
    useWriteLeaseStore.getState().setRole('writer', 'ws-1');
    expect(useWriteLeaseStore.getState()).toMatchObject({
      role: 'writer',
      workspaceId: 'ws-1',
    });

    useWriteLeaseStore.getState().setRole('reader', 'ws-1');
    expect(useWriteLeaseStore.getState().role).toBe('reader');
  });
});
