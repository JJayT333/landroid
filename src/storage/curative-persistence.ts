import db from './db';
import {
  normalizeTitleIssue,
  type TitleIssue,
} from '../types/title-issue';

export interface CurativeWorkspaceData {
  titleIssues: TitleIssue[];
}

function sortTitleIssues(issues: TitleIssue[]) {
  return [...issues].sort((left, right) => {
    const statusOrder = titleIssueIsClosed(left) === titleIssueIsClosed(right)
      ? 0
      : titleIssueIsClosed(left)
        ? 1
        : -1;
    if (statusOrder !== 0) {
      return statusOrder;
    }
    const dueDateOrder = (left.dueDate || '9999-12-31').localeCompare(
      right.dueDate || '9999-12-31'
    );
    if (dueDateOrder !== 0) {
      return dueDateOrder;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

function titleIssueIsClosed(issue: TitleIssue) {
  return issue.status === 'Resolved' || issue.status === 'Deferred';
}

export async function loadCurativeWorkspaceData(
  workspaceId: string
): Promise<CurativeWorkspaceData> {
  const titleIssues = await db.titleIssues
    .where('workspaceId')
    .equals(workspaceId)
    .toArray();

  return {
    titleIssues: sortTitleIssues(
      titleIssues.map((issue) => normalizeTitleIssue(issue, { workspaceId }))
    ),
  };
}

export async function replaceCurativeWorkspaceData(
  workspaceId: string,
  data: CurativeWorkspaceData
): Promise<void> {
  await db.transaction('rw', db.titleIssues, async () => {
    await db.titleIssues.where('workspaceId').equals(workspaceId).delete();

    if (data.titleIssues.length > 0) {
      await db.titleIssues.bulkPut(
        data.titleIssues.map((issue) =>
          normalizeTitleIssue({ ...issue, workspaceId }, { workspaceId })
        )
      );
    }
  });
}

export function saveTitleIssue(issue: TitleIssue) {
  return db.titleIssues.put(
    normalizeTitleIssue(issue, { workspaceId: issue.workspaceId })
  );
}

export function deleteTitleIssue(id: string) {
  return db.titleIssues.delete(id);
}
