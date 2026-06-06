import { describe, expect, it } from 'vitest';
import { createBlankWorkspaceData } from './project-workspace-lifecycle';

describe('project workspace lifecycle helpers', () => {
  it('creates blank project data without Desk Maps or title rows', () => {
    const workspace = createBlankWorkspaceData('  New Lease Review  ');

    expect(workspace.projectName).toBe('New Lease Review');
    expect(workspace.workspaceId).toMatch(/^ws-/);
    expect(workspace.nodes).toEqual([]);
    expect(workspace.deskMaps).toEqual([]);
    expect(workspace.activeDeskMapId).toBeNull();
    expect(workspace.instrumentTypes).toEqual([]);
  });
});
