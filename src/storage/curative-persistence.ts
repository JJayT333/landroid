import db from './db';
import {
  activeStorageScopedId,
  activeWorkspaceScope,
  stampActiveDbKeyWithStorageId,
  stripDbKeyAndStorageId,
} from './db-key-scope';
import {
  normalizeTitleIssue,
  type TitleIssue,
} from '../types/title-issue';

export interface CurativeWorkspaceData {
  titleIssues: TitleIssue[];
}

function stripStoredId<T extends { id: string; dbKey?: string }>(
  row: T
): Omit<T, 'dbKey'> {
  return stripDbKeyAndStorageId(row, 'id');
}

async function getTitleIssueRow(id: string) {
  return (
    (await db.titleIssues.get(activeStorageScopedId(id)))
    ?? db.titleIssues.get(id)
  );
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
    .where('[dbKey+workspaceId]')
    .equals(activeWorkspaceScope(workspaceId))
    .toArray();

  return {
    titleIssues: sortTitleIssues(
      titleIssues.map((issue) => normalizeTitleIssue(stripStoredId(issue), { workspaceId }))
    ),
  };
}

export async function replaceCurativeWorkspaceData(
  workspaceId: string,
  data: CurativeWorkspaceData
): Promise<void> {
  await db.transaction('rw', db.titleIssues, async () => {
    await db.titleIssues
      .where('[dbKey+workspaceId]')
      .equals(activeWorkspaceScope(workspaceId))
      .delete();

    if (data.titleIssues.length > 0) {
      await db.titleIssues.bulkPut(
        data.titleIssues.map((issue) =>
          stampActiveDbKeyWithStorageId(
            normalizeTitleIssue({ ...issue, workspaceId }, { workspaceId }),
            'id'
          )
        )
      );
    }
  });
}

export function saveTitleIssue(issue: TitleIssue) {
  return db.titleIssues.put(
    stampActiveDbKeyWithStorageId(
      normalizeTitleIssue(issue, { workspaceId: issue.workspaceId }),
      'id'
    )
  );
}

export function deleteTitleIssue(id: string) {
  return db.transaction('rw', db.titleIssues, async () => {
    const issue = await getTitleIssueRow(id);
    if (!issue || issue.dbKey !== activeWorkspaceScope(issue.workspaceId)[0]) return;
    await db.titleIssues.delete(issue.id);
  });
}
