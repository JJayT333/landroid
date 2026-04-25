import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Each test re-imports the module after mocking isHostedMode so we can
// observe the local- vs hosted-mode initialisation paths in isolation.
async function loadModule(hosted: boolean) {
  vi.resetModules();
  vi.doMock('../../utils/deploy-env', () => ({
    isHostedMode: () => hosted,
  }));
  return await import('../active-workspace-key');
}

describe('active-workspace-key (audit M-1)', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock('../../utils/deploy-env');
    vi.resetModules();
  });

  it('local mode: ready immediately, returns the legacy default key', async () => {
    const mod = await loadModule(false);
    await expect(mod.awaitWorkspaceKeyReady()).resolves.toBeUndefined();
    expect(mod.getWorkspaceDbKey()).toBe('default');
    expect(mod.getCanvasDbKey()).toBe('active-canvas');
    expect(mod.getActiveUserSub()).toBeNull();
  });

  it('local mode: ignores any sub set on it (no namespacing in local mode)', async () => {
    const mod = await loadModule(false);
    mod.setActiveUserSub('whoever');
    expect(mod.getWorkspaceDbKey()).toBe('default');
    expect(mod.getCanvasDbKey()).toBe('active-canvas');
  });

  it('hosted mode: ready promise blocks until setActiveUserSub fires', async () => {
    const mod = await loadModule(true);

    let resolvedFlag = false;
    void mod.awaitWorkspaceKeyReady().then(() => {
      resolvedFlag = true;
    });

    // Microtask queue flush — should still be unresolved.
    await Promise.resolve();
    expect(resolvedFlag).toBe(false);

    mod.setActiveUserSub('user-abc');
    await mod.awaitWorkspaceKeyReady();
    expect(resolvedFlag).toBe(true);

    expect(mod.getActiveUserSub()).toBe('user-abc');
    expect(mod.getWorkspaceDbKey()).toBe('user-user-abc');
    expect(mod.getCanvasDbKey()).toBe('user-user-abc-canvas');
  });

  it('hosted mode: a null sub still flips ready (signed-out users wait at LoginGate)', async () => {
    const mod = await loadModule(true);

    mod.setActiveUserSub(null);
    await expect(mod.awaitWorkspaceKeyReady()).resolves.toBeUndefined();
    // Without a sub, fall back to the legacy key — the row exists for
    // backward-compat with pre-namespacing data; the user will be at the
    // sign-in wall anyway.
    expect(mod.getWorkspaceDbKey()).toBe('default');
    expect(mod.getCanvasDbKey()).toBe('active-canvas');
  });

  it('hosted mode: distinct subs map to distinct keys (multi-user isolation)', async () => {
    const mod = await loadModule(true);
    mod.setActiveUserSub('alice');
    expect(mod.getWorkspaceDbKey()).toBe('user-alice');
    mod.setActiveUserSub('bob');
    expect(mod.getWorkspaceDbKey()).toBe('user-bob');
    expect(mod.getCanvasDbKey()).toBe('user-bob-canvas');
  });
});
