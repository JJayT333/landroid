/**
 * Unit tests for the in-memory title undo stack (pure state mechanics; the
 * journaled-restore integration lives in title-action-log.test.ts).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import {
  clearTitleUndoStack,
  peekTitleUndoEntry,
  popTitleUndoEntry,
  pushTitleUndoEntry,
  TITLE_UNDO_STACK_LIMIT,
  titleUndoLabel,
  useTitleUndoStack,
} from '../title-undo-stack';

function blankWorkspace(id: string): WorkspaceData {
  return {
    workspaceId: id,
    projectName: 'Stack Test',
    nodes: [],
    deskMaps: [],
    activeDeskMapId: null,
    activeUnitCode: null,
    instrumentTypes: [],
  };
}

function entry(mutation: string, id: string) {
  return {
    mutation,
    label: titleUndoLabel(mutation),
    beforeWorkspace: blankWorkspace(id),
    cascadeRestore: Promise.resolve(null),
  };
}

beforeEach(() => {
  clearTitleUndoStack();
});

describe('title undo stack', () => {
  it('pushes and pops in LIFO order', () => {
    pushTitleUndoEntry(entry('convey', 'ws-a'));
    pushTitleUndoEntry(entry('deleteNode', 'ws-b'));

    expect(peekTitleUndoEntry()?.label).toBe('delete branch');
    expect(popTitleUndoEntry()?.beforeWorkspace.workspaceId).toBe('ws-b');
    expect(popTitleUndoEntry()?.beforeWorkspace.workspaceId).toBe('ws-a');
    expect(popTitleUndoEntry()).toBeNull();
  });

  it('caps the stack at the limit, dropping the oldest entries', () => {
    for (let i = 0; i < TITLE_UNDO_STACK_LIMIT + 5; i += 1) {
      pushTitleUndoEntry(entry('update', `ws-${i}`));
    }
    const { entries } = useTitleUndoStack.getState();
    expect(entries).toHaveLength(TITLE_UNDO_STACK_LIMIT);
    expect(entries[0]?.beforeWorkspace.workspaceId).toBe('ws-5');
    expect(entries.at(-1)?.beforeWorkspace.workspaceId).toBe(
      `ws-${TITLE_UNDO_STACK_LIMIT + 4}`
    );
  });

  it('clears entirely', () => {
    pushTitleUndoEntry(entry('convey', 'ws-a'));
    clearTitleUndoStack();
    expect(peekTitleUndoEntry()).toBeNull();
  });

  it('labels every title mutation kind, with a generic fallback', () => {
    expect(titleUndoLabel('deleteNode')).toBe('delete branch');
    expect(titleUndoLabel('createNpri')).toBe('create NPRI');
    expect(titleUndoLabel('somethingNew')).toBe('edit');
  });
});
