import { useCallback, useEffect, useState } from 'react';
import {
  createAndOpenSavedProject,
  deleteSavedProject,
  duplicateSavedProject,
  openSavedProject,
  renameSavedProject,
} from '../../app/project-workspace-lifecycle';
import {
  listSavedProjects,
  normalizeSavedProjectName,
  type SavedProjectSummary,
} from '../../storage/saved-project-index';
import { useWorkspaceStore } from '../../store/workspace-store';
import Button from '../shared/Button';
import { useConfirmation } from '../shared/ConfirmationProvider';

interface ProjectPickerLandingProps {
  open: boolean;
  onClose: () => void;
}

type EditorMode = 'rename' | 'duplicate';

type EditorState = {
  mode: EditorMode;
  project: SavedProjectSummary;
  draft: string;
} | null;

function formatProjectDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not saved yet';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function defaultDuplicateName(projectName: string): string {
  const trimmed = normalizeSavedProjectName(projectName);
  return trimmed.endsWith(' Copy') ? `${trimmed} 2` : `${trimmed} Copy`;
}

export default function ProjectPickerLanding({
  open,
  onClose,
}: ProjectPickerLandingProps) {
  const { alert: showAlert, confirm: requestConfirmation } = useConfirmation();
  const activeWorkspaceId = useWorkspaceStore((state) => state.workspaceId);
  const activeProjectName = useWorkspaceStore((state) => state.projectName);
  const activeWorkspaceHasContent = useWorkspaceStore((state) =>
    state.nodes.length > 0
    || state.leaseholdAssignments.length > 0
    || state.leaseholdOrris.length > 0
    || state.leaseholdTransferOrderEntries.length > 0
  );
  const workspaceHydrated = useWorkspaceStore((state) => state._hydrated);
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [newProjectName, setNewProjectName] = useState('New LANDroid Project');
  const [editor, setEditor] = useState<EditorState>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listSavedProjects();
    setProjects(rows);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh().catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    });
  }, [open, refresh]);

  const runAction = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await action();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      await showAlert({ title: 'Project Action Failed', message });
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = async () => {
    await runAction('create', async () => {
      const activeProjectSaved = projects.some(
        (project) => project.workspaceId === activeWorkspaceId
      );
      await createAndOpenSavedProject(newProjectName, {
        flushCurrent: activeProjectSaved || activeWorkspaceHasContent,
      });
      await refresh();
      onClose();
    });
  };

  const handleOpen = async (project: SavedProjectSummary) => {
    await runAction(project.workspaceId, async () => {
      await openSavedProject(project);
      await refresh();
      onClose();
    });
  };

  const beginRename = (project: SavedProjectSummary) => {
    setEditor({ mode: 'rename', project, draft: project.projectName });
  };

  const beginDuplicate = (project: SavedProjectSummary) => {
    setEditor({
      mode: 'duplicate',
      project,
      draft: defaultDuplicateName(project.projectName),
    });
  };

  const commitEditor = async () => {
    if (!editor) return;
    const name = normalizeSavedProjectName(editor.draft);
    await runAction(editor.mode, async () => {
      if (editor.mode === 'rename') {
        await renameSavedProject(editor.project, name);
      } else {
        await duplicateSavedProject(editor.project, name);
      }
      setEditor(null);
      await refresh();
    });
  };

  const handleDelete = async (project: SavedProjectSummary) => {
    const confirmed = await requestConfirmation({
      title: `Delete ${project.projectName}?`,
      message:
        'This removes the saved local project, including its workspace, canvas, documents, side-store rows, and local title-ledger rows. Export a .landroid backup first if you need a permanent copy.',
      confirmLabel: 'Delete Project',
      tone: 'danger',
      requiredConfirmationText: project.projectName,
      typedConfirmationHelp:
        'Deletion is local to this browser profile and cannot be undone from the project picker.',
    });
    if (!confirmed) return;
    await runAction(`delete-${project.workspaceId}`, async () => {
      await deleteSavedProject(project);
      await refresh();
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-parchment text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-6">
        <header className="flex flex-col gap-4 border-b border-ledger-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-leather">
              Project Picker
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-ink">
              LANDroid Projects
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-light">
              Local browser projects
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {workspaceHydrated && (
              <Button onClick={onClose}>
                Return to {activeProjectName}
              </Button>
            )}
          </div>
        </header>

        <section className="grid gap-3 border-b border-ledger-line pb-5 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-widest text-ink-light">
              New Project Name
            </span>
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreate();
                }
              }}
              className="mt-1 w-full rounded-md border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather/20"
            />
          </label>
          <Button className="self-end" onClick={handleCreate} disabled={Boolean(busy)}>
            Create Project
          </Button>
        </section>

        {error && (
          <div className="rounded-md border border-seal/30 bg-seal/5 px-4 py-3 text-sm text-seal">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.length === 0 ? (
            <div className="rounded-md border border-dashed border-ledger-line bg-ledger px-4 py-6 text-sm text-ink-light">
              No saved projects yet.
            </div>
          ) : (
            projects.map((project) => {
              const active = project.workspaceId === activeWorkspaceId;
              const disabled = Boolean(busy);
              return (
                <article
                  key={project.workspaceId}
                  className="flex min-h-44 flex-col justify-between rounded-md border border-ledger-line bg-white p-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words text-base font-semibold text-ink">
                        {project.projectName}
                      </h3>
                      {active && (
                        <span className="shrink-0 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-leather">
                          Open
                        </span>
                      )}
                    </div>
                    <dl className="mt-3 space-y-1 text-xs text-ink-light">
                      <div className="flex justify-between gap-3">
                        <dt>Updated</dt>
                        <dd className="text-right">{formatProjectDate(project.updatedAt)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt>Last opened</dt>
                        <dd className="text-right">{formatProjectDate(project.lastOpenedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpen(project)}
                      disabled={disabled || active}
                      className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-parchment hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => beginRename(project)}
                      disabled={disabled}
                      className="rounded-md border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light hover:bg-ledger disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => beginDuplicate(project)}
                      disabled={disabled}
                      className="rounded-md border border-ledger-line px-3 py-2 text-xs font-semibold text-ink-light hover:bg-ledger disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(project)}
                      disabled={disabled}
                      className="rounded-md border border-seal/30 px-3 py-2 text-xs font-semibold text-seal hover:bg-seal/5 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-4">
          <div className="w-full max-w-md rounded-md border border-ledger-line bg-parchment p-5 shadow-xl">
            <h3 className="font-display text-xl font-bold text-ink">
              {editor.mode === 'rename' ? 'Rename Project' : 'Duplicate Project'}
            </h3>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-widest text-ink-light">
                Project Name
              </span>
              <input
                autoFocus
                value={editor.draft}
                onChange={(event) => setEditor({ ...editor, draft: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void commitEditor();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setEditor(null);
                  }
                }}
                className="mt-1 w-full rounded-md border border-ledger-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-leather focus:ring-2 focus:ring-leather/20"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button onClick={commitEditor} disabled={Boolean(busy)}>
                {editor.mode === 'rename' ? 'Rename' : 'Duplicate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
