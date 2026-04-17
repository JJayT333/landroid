import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankTitleIssue } from '../../types/title-issue';

const mocks = vi.hoisted(() => ({
  loadCurativeWorkspaceData: vi.fn(),
  replaceCurativeWorkspaceData: vi.fn(),
  saveTitleIssue: vi.fn(),
  deleteTitleIssue: vi.fn(),
}));

vi.mock('../../storage/curative-persistence', () => ({
  loadCurativeWorkspaceData: mocks.loadCurativeWorkspaceData,
  replaceCurativeWorkspaceData: mocks.replaceCurativeWorkspaceData,
  saveTitleIssue: mocks.saveTitleIssue,
  deleteTitleIssue: mocks.deleteTitleIssue,
}));

import { useCurativeStore } from '../curative-store';

describe('curative-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCurativeStore.setState({
      workspaceId: null,
      titleIssues: [],
      selectedIssueId: null,
      _hydrated: false,
    });
  });

  it('loads title issues for the active workspace', async () => {
    const issue = createBlankTitleIssue('ws-a', {
      id: 'issue-1',
      title: 'Missing probate',
    });
    mocks.loadCurativeWorkspaceData.mockResolvedValue({
      titleIssues: [issue],
    });

    await useCurativeStore.getState().setWorkspace('ws-a');

    expect(useCurativeStore.getState().workspaceId).toBe('ws-a');
    expect(useCurativeStore.getState().titleIssues).toEqual([issue]);
    expect(useCurativeStore.getState().selectedIssueId).toBeNull();
  });

  it('adds issues into the active workspace and selects them', async () => {
    const issue = createBlankTitleIssue('wrong-ws', {
      id: 'issue-1',
      title: 'NPRI discrepancy',
      issueType: 'NPRI discrepancy',
    });
    mocks.saveTitleIssue.mockResolvedValue(undefined);
    useCurativeStore.setState({ workspaceId: 'ws-active' });

    await useCurativeStore.getState().addIssue(issue);

    expect(mocks.saveTitleIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'issue-1',
        workspaceId: 'ws-active',
      })
    );
    expect(useCurativeStore.getState().selectedIssueId).toBe('issue-1');
  });

  it('clears linked record references without deleting the issue', () => {
    const issue = createBlankTitleIssue('ws-a', {
      id: 'issue-1',
      title: 'Missing lease ratification',
      affectedDeskMapId: 'dm-1',
      affectedNodeId: 'node-1',
      affectedOwnerId: 'owner-1',
      affectedLeaseId: 'lease-1',
    });
    mocks.saveTitleIssue.mockResolvedValue(undefined);
    useCurativeStore.setState({
      workspaceId: 'ws-a',
      titleIssues: [issue],
      selectedIssueId: issue.id,
    });

    useCurativeStore.getState().unlinkDeskMap('dm-1');
    useCurativeStore.getState().unlinkOwner('owner-1');
    useCurativeStore.getState().unlinkLease('lease-1');

    expect(useCurativeStore.getState().titleIssues[0]).toEqual(
      expect.objectContaining({
        id: 'issue-1',
        affectedDeskMapId: null,
        affectedNodeId: null,
        affectedOwnerId: null,
        affectedLeaseId: null,
      })
    );
    expect(mocks.saveTitleIssue).toHaveBeenCalled();
  });
});
