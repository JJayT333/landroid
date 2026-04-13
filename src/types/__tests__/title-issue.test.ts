import { describe, expect, it } from 'vitest';
import {
  createBlankTitleIssue,
  normalizeTitleIssue,
  normalizeTitleIssues,
} from '../title-issue';

describe('title issue normalization', () => {
  it('creates a workspace-scoped title issue with curative defaults', () => {
    const issue = createBlankTitleIssue('ws-1', {
      id: 'issue-1',
      title: 'Missing affidavit of heirship',
    });

    expect(issue).toEqual(
      expect.objectContaining({
        id: 'issue-1',
        workspaceId: 'ws-1',
        title: 'Missing affidavit of heirship',
        issueType: 'Title opinion requirement',
        priority: 'Medium',
        status: 'Open',
        affectedDeskMapId: null,
        affectedNodeId: null,
        affectedOwnerId: null,
        affectedLeaseId: null,
      })
    );
  });

  it('coerces junk imported options back to safe landman-review defaults', () => {
    const issue = normalizeTitleIssue(
      {
        id: 'issue-legacy',
        workspaceId: 'ws-old',
        title: 42 as unknown as string,
        issueType: 'bad-type' as never,
        priority: 'urgent' as never,
        status: 'blocked' as never,
        affectedDeskMapId: '',
        affectedNodeId: 123 as unknown as string,
      },
      { workspaceId: 'ws-fallback' }
    );

    expect(issue.title).toBe('');
    expect(issue.issueType).toBe('Title opinion requirement');
    expect(issue.priority).toBe('Medium');
    expect(issue.status).toBe('Open');
    expect(issue.affectedDeskMapId).toBeNull();
    expect(issue.affectedNodeId).toBeNull();
  });

  it('trims imported Curative link ids before matching them to records', () => {
    const issue = normalizeTitleIssue({
      id: 'issue-linked',
      workspaceId: 'ws-1',
      affectedDeskMapId: ' dm-1 ',
      affectedNodeId: ' node-1 ',
      affectedOwnerId: ' owner-1 ',
      affectedLeaseId: ' lease-1 ',
    });

    expect(issue).toEqual(
      expect.objectContaining({
        affectedDeskMapId: 'dm-1',
        affectedNodeId: 'node-1',
        affectedOwnerId: 'owner-1',
        affectedLeaseId: 'lease-1',
      })
    );
  });

  it('filters malformed imported issue rows', () => {
    const issues = normalizeTitleIssues(
      [
        { id: 'issue-1', workspaceId: 'ws-1', title: 'Good issue' },
        { title: 'Missing id' },
        null,
      ],
      { workspaceId: 'ws-1' }
    );

    expect(issues).toHaveLength(1);
    expect(issues[0]?.title).toBe('Good issue');
  });
});
