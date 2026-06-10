/**
 * Top navigation bar — view switcher, workspace name, save/load.
 */
import { useEffect, useRef, useState } from 'react';
import { useUIStore, type ViewMode } from '../../store/ui-store';
import { useOwnerStore } from '../../store/owner-store';
import { useTitleUndoCount, useTitleUndoPeekLabel } from '../../store/title-undo-stack';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useStorageHealthStore } from '../../store/storage-health-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../../store/write-lease-store';
import {
  hydrateTitleActionLogFromImportedLedger,
} from '../../store/title-action-log';
import { buildCurrentLandroidExport } from '../../app/current-landroid-export';
import { importAndOpenWorkspace } from '../../app/project-workspace-lifecycle';
import {
  downloadLandroidFile,
  importLandroidFile,
  type LandroidFileData,
  type WorkspaceData,
} from '../../storage/workspace-persistence';
import {
  chooseRollingAutoExportDirectory,
  disableRollingAutoExport,
} from '../../storage/rolling-auto-export-runtime';
import { importCSV } from '../../storage/csv-io';
import { assertFileSize, FILE_SIZE_LIMITS } from '../../utils/file-validation';
import { seedCombinatorialData } from '../../storage/seed-test-data';
import { seedVulcanMesaData } from '../../storage/seed-vulcan-mesa';
import { isHostedMode } from '../../utils/deploy-env';
import HostedUserMenu from '../../auth/HostedUserMenu';
import { useConfirmation } from './ConfirmationProvider';
import { shouldShowDemoDataMenu } from './navbar-policy';
import { StorageHealthIndicator } from './StorageHealthIndicator';

const landroidLogoUrl = new URL('../../assets/branding/landroid-logo.png', import.meta.url).href;
const ravenForestBackdropUrl = new URL('../../assets/branding/raven-forest-backdrop.png', import.meta.url).href;

const views: { id: ViewMode; label: string }[] = [
  { id: 'chart', label: 'Desk Map' },
  { id: 'leasehold', label: 'Leasehold' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'master', label: 'Runsheet' },
  { id: 'documents', label: 'Documents' },
  { id: 'owners', label: 'Owners' },
  { id: 'curative', label: 'Curative' },
  { id: 'maps', label: 'Maps' },
  { id: 'pitch', label: 'Sales Deck' },
  { id: 'federalLeasing', label: 'Federal Leasing' },
  { id: 'research', label: 'Research' },
];

const LOAD_DEMO_CONFIRMATION_TEXT = 'LOAD DEMO';
const LOAD_WORKSPACE_CONFIRMATION_TEXT = 'LOAD WORKSPACE';

function readTitleOwnerData() {
  const owner = useOwnerStore.getState();
  return { owners: owner.owners, leases: owner.leases };
}

async function mirrorLoadedTitleLedger(
  data: WorkspaceData & Pick<LandroidFileData, 'actionLedger'>
): Promise<void> {
  await hydrateTitleActionLogFromImportedLedger(
    data,
    data.actionLedger,
    readTitleOwnerData()
  ).catch((err) => {
    console.warn('[landroid] title ledger import hydration failed:', err);
  });
}

interface NavbarProps {
  onOpenProjectPicker?: () => void;
}

export default function Navbar({ onOpenProjectPicker }: NavbarProps) {
  const readOnly = useWorkspaceReadOnly();
  const hostedMode = isHostedMode();
  const showDemoDataMenu = shouldShowDemoDataMenu();
  const { alert: showAlert, confirm: requestConfirmation } = useConfirmation();
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const setProjectName = useWorkspaceStore((s) => s.setProjectName);
  const undoLastTitleMutation = useWorkspaceStore((s) => s.undoLastTitleMutation);
  const undoCount = useTitleUndoCount();
  const undoPeekLabel = useTitleUndoPeekLabel();
  const [undoing, setUndoing] = useState(false);
  const canUndo = undoCount > 0 && !readOnly && !undoing;
  const handleUndo = async () => {
    if (!canUndo) return;
    setUndoing(true);
    try {
      await undoLastTitleMutation();
    } finally {
      setUndoing(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const demoMenuRef = useRef<HTMLDivElement>(null);

  const [seedLoading, setSeedLoading] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);

  // Close dropdowns when clicking outside.
  useEffect(() => {
    if (!fileMenuOpen && !demoMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fileMenuOpen && fileMenuRef.current && !fileMenuRef.current.contains(target)) {
        setFileMenuOpen(false);
      }
      if (demoMenuOpen && demoMenuRef.current && !demoMenuRef.current.contains(target)) {
        setDemoMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [fileMenuOpen, demoMenuOpen]);

  // Keep the draft in sync when the store name changes externally (e.g. Load).
  useEffect(() => {
    if (!isEditingName) setNameDraft(projectName);
  }, [projectName, isEditingName]);

  useEffect(() => {
    if (readOnly && isEditingName) {
      setNameDraft(projectName);
      setIsEditingName(false);
    }
  }, [isEditingName, projectName, readOnly]);

  const beginEditingName = () => {
    if (readOnly) return;
    setNameDraft(projectName);
    setIsEditingName(true);
  };

  const commitName = () => {
    if (readOnly) {
      setNameDraft(projectName);
      setIsEditingName(false);
      return;
    }
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== projectName) {
      setProjectName(trimmed);
    } else {
      setNameDraft(projectName);
    }
    setIsEditingName(false);
  };

  const cancelNameEdit = () => {
    setNameDraft(projectName);
    setIsEditingName(false);
  };

  const handleCombinatorial = async () => {
    setDemoMenuOpen(false);
    if (readOnly) return;
    const confirmed = await requestConfirmation({
      title: 'Load Combinatorial Demo?',
      message:
        'This replaces the current workspace with the Raven Forest demo fixture. Save first if you need to keep the current workspace.',
      confirmLabel: 'Load Demo Data',
      tone: 'danger',
      requiredConfirmationText: LOAD_DEMO_CONFIRMATION_TEXT,
      typedConfirmationHelp:
        'The demo loader overwrites the active local workspace in this browser session.',
    });
    if (!confirmed) return;

    setSeedLoading(true);
    try {
      const { nodeCount, pdfCount } = await seedCombinatorialData();
      await mirrorLoadedTitleLedger(useWorkspaceStore.getState());
      console.log(
        `[combinatorial] Loaded ${nodeCount} nodes, attached ${pdfCount} PDFs`
      );
    } catch (err) {
      console.error('[combinatorial] Failed:', err);
    }
    setSeedLoading(false);
  };

  const handleVulcanMesa = async () => {
    setDemoMenuOpen(false);
    if (readOnly) return;
    const confirmed = await requestConfirmation({
      title: 'Load Vulcan Mesa Demo?',
      message:
        'This replaces the current workspace with the Vulcan Mesa demo fixture. Save first if you need to keep the current workspace.',
      confirmLabel: 'Load Demo Data',
      tone: 'danger',
      requiredConfirmationText: LOAD_DEMO_CONFIRMATION_TEXT,
      typedConfirmationHelp:
        'The demo loader overwrites the active local workspace in this browser session.',
    });
    if (!confirmed) return;

    setSeedLoading(true);
    try {
      const { nodeCount, pdfCount } = await seedVulcanMesaData();
      await mirrorLoadedTitleLedger(useWorkspaceStore.getState());
      console.log(
        `[vulcan-mesa] Loaded ${nodeCount} nodes, attached ${pdfCount} PDFs`
      );
    } catch (err) {
      console.error('[vulcan-mesa] Failed:', err);
    }
    setSeedLoading(false);
  };

  // Dr. Elmore #1 Unit sample: a de-identified, bundled `.landroid` (fake
  // addresses, every embedded PDF replaced with a blank Producers 88). Loaded
  // from a static asset, then through the same import path as a picked file.
  const handleSpringhill = async () => {
    setDemoMenuOpen(false);
    if (readOnly) return;
    const confirmed = await requestConfirmation({
      title: 'Load Dr. Elmore #1 Unit Sample?',
      message:
        'This replaces the current workspace with the Dr. Elmore #1 Unit sample (a de-identified 7-tract title example). Save first if you need to keep the current workspace.',
      confirmLabel: 'Load Demo Data',
      tone: 'danger',
      requiredConfirmationText: LOAD_DEMO_CONFIRMATION_TEXT,
      typedConfirmationHelp:
        'The demo loader overwrites the active local workspace in this browser session.',
    });
    if (!confirmed) return;

    setSeedLoading(true);
    try {
      const url = `${import.meta.env.BASE_URL}samples/springhill-dr-elmore.landroid`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Sample fetch failed (${response.status})`);
      }
      const blob = await response.blob();
      const file = new File([blob], 'springhill-dr-elmore.landroid', {
        type: 'application/json',
      });
      assertFileSize(file, FILE_SIZE_LIMITS.LANDROID, '.landroid file');

      const data = await importLandroidFile(file);
      // Demo loader: always replace any prior Dr. Elmore project with a pristine
      // copy from the current bundled sample, so testing after a merge starts
      // fresh every time. importAndOpenWorkspace hydrates the title ledger
      // itself (DA-H2), unlike the direct seed loaders below.
      await importAndOpenWorkspace(data, { replaceExisting: true });
      console.log(`[springhill-sample] Loaded ${data.nodes.length} nodes`);
    } catch (err) {
      console.error('[springhill-sample] Failed:', err);
      await showAlert({
        title: 'Sample Load Failed',
        message: `Sample load failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
    setSeedLoading(false);
  };

  const exportCurrentWorkspace = async () => {
    const currentExport = await buildCurrentLandroidExport();
    await downloadLandroidFile(currentExport.data, currentExport.options);
    useStorageHealthStore.getState().recordWorkspaceExported();
  };

  const handleSave = async () => {
    setFileMenuOpen(false);
    await exportCurrentWorkspace();
  };

  const handleBackupNow = async () => {
    setFileMenuOpen(false);
    setDemoMenuOpen(false);
    await exportCurrentWorkspace();
  };

  const handleConfigureAutoExport = async () => {
    setFileMenuOpen(false);
    setDemoMenuOpen(false);
    try {
      const status = await chooseRollingAutoExportDirectory();
      if (status === 'unsupported') {
        await showAlert({
          title: 'Auto Export Unsupported',
          message:
            'This browser does not support choosing a local folder for rolling exports. Use Backup Now for manual .landroid backups.',
        });
      }
    } catch (err) {
      await showAlert({
        title: 'Auto Export Failed',
        message: `Auto export setup failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  };

  const handleDisableAutoExport = async () => {
    setFileMenuOpen(false);
    setDemoMenuOpen(false);
    await disableRollingAutoExport();
  };

  const handleLoad = () => {
    setFileMenuOpen(false);
    if (readOnly) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    if (readOnly) {
      input.value = '';
      return;
    }
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.landroid')) {
        assertFileSize(file, FILE_SIZE_LIMITS.LANDROID, '.landroid file');
        const confirmed = await requestConfirmation({
          title: `Load ${file.name}?`,
          message:
            'This replaces the current workspace with the selected .landroid file. Save first if you need to keep the current workspace.',
          confirmLabel: 'Replace Workspace',
          tone: 'danger',
          requiredConfirmationText: LOAD_WORKSPACE_CONFIRMATION_TEXT,
          typedConfirmationHelp:
            'The selected .landroid file will replace the active workspace in this browser session.',
        });
        if (!confirmed) return;

        const data = await importLandroidFile(file);
        // DA-H2: importAndOpenWorkspace hydrates the title ledger itself now.
        await importAndOpenWorkspace(data);
      } else if (file.name.endsWith('.csv')) {
        assertFileSize(file, FILE_SIZE_LIMITS.SPREADSHEET, 'CSV file');
        const confirmed = await requestConfirmation({
          title: `Load ${file.name}?`,
          message:
            'This imports the CSV into a fresh LANDroid workspace. Save first if you need to keep the current workspace.',
          confirmLabel: 'Replace Workspace',
          tone: 'danger',
          requiredConfirmationText: LOAD_WORKSPACE_CONFIRMATION_TEXT,
          typedConfirmationHelp:
            'The selected CSV will replace the active workspace in this browser session.',
        });
        if (!confirmed) return;

        const text = await file.text();
        const result = importCSV(text);
        // DA-H2: importAndOpenWorkspace hydrates the title ledger itself now.
        await importAndOpenWorkspace(result);
      } else {
        await showAlert({
          title: 'Unsupported File Type',
          message: 'Unsupported file type. Use .landroid or .csv files.',
        });
      }
    } catch (err) {
      await showAlert({
        title: 'Import Failed',
        message: `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      input.value = '';
    }
  };

  return (
    <nav
      aria-label="Primary"
      className="no-print flex items-center justify-between px-4 py-2 bg-ink text-parchment border-b border-leather"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-parchment/15 bg-parchment/5 px-1.5 shadow-lg">
          <img
            src={landroidLogoUrl}
            alt="LANDroid logo"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-display font-bold tracking-wide">LANDroid</h1>
          {isEditingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelNameEdit();
                }
              }}
              aria-label="Project name"
              className="block w-48 truncate rounded border border-parchment/30 bg-ink-light/40 px-1 text-xs text-parchment font-mono focus:outline-none focus:border-gold"
            />
          ) : (
            <button
              type="button"
              disabled={readOnly}
              onClick={beginEditingName}
              title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : 'Click to rename project'}
              aria-label={`Project name: ${projectName}. Click to rename.`}
              className="block max-w-[12rem] truncate rounded px-0.5 text-left text-xs text-parchment/60 font-mono hover:text-parchment hover:bg-ink-light/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {projectName}
            </button>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 gap-1 overflow-x-auto">
          <div className="flex items-center pr-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-parchment/15 bg-parchment/10 p-1 shadow-md">
              <img
                src={ravenForestBackdropUrl}
                alt="Prospect mark"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <div className="mr-1 flex items-center border-r border-parchment/15 pr-1">
            <button
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              aria-label={canUndo ? `Undo ${undoPeekLabel}` : 'Undo (nothing to undo)'}
              title={
                canUndo
                  ? `Undo: ${undoPeekLabel} (${navigator.platform.includes('Mac') ? 'Cmd' : 'Ctrl'}+Z)`
                  : readOnly
                    ? READ_ONLY_WORKSPACE_EDIT_TITLE
                    : 'Nothing to undo'
              }
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-parchment/70 hover:text-parchment hover:bg-ink-light/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Undo
            </button>
          </div>
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? 'page' : undefined}
              className={`
                shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${view === v.id
                  ? 'bg-leather text-parchment'
                  : 'text-parchment/70 hover:text-parchment hover:bg-ink-light/30'}
              `}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border-l border-parchment/20 pl-3">
          <StorageHealthIndicator
            onBackupNow={handleBackupNow}
            onConfigureAutoExport={handleConfigureAutoExport}
            onDisableAutoExport={handleDisableAutoExport}
          />

          {onOpenProjectPicker && (
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen(false);
                setDemoMenuOpen(false);
                onOpenProjectPicker();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-parchment/70 hover:text-parchment hover:bg-ink-light/30 transition-colors"
            >
              Projects
            </button>
          )}
          <div ref={fileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setFileMenuOpen((open) => !open);
                setDemoMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={fileMenuOpen}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-parchment/70 hover:text-parchment hover:bg-ink-light/30 transition-colors"
            >
              File ▾
            </button>
            {fileMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-leather bg-ink shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSave}
                  className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment"
                >
                  Save workspace
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={readOnly}
                  onClick={handleLoad}
                  title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                  className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Load workspace
                </button>
              </div>
            )}
          </div>

          {hostedMode && <HostedUserMenu />}

          {showDemoDataMenu && (
            <div ref={demoMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (readOnly) return;
                  setDemoMenuOpen((open) => !open);
                  setFileMenuOpen(false);
                }}
                disabled={readOnly || seedLoading}
                title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                aria-haspopup="menu"
                aria-expanded={demoMenuOpen}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gold/80 hover:text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
              >
                {seedLoading ? 'Loading…' : 'Demo Data ▾'}
              </button>
              {demoMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-leather bg-ink shadow-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleCombinatorial}
                    disabled={readOnly || seedLoading}
                    title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                    className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Combinatorial — Raven Forest
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleVulcanMesa}
                    disabled={readOnly || seedLoading}
                    title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                    className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Vulcan Mesa — Demo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSpringhill}
                    disabled={readOnly || seedLoading}
                    title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : undefined}
                    className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Dr. Elmore #1 Unit — Sample
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".landroid,.csv"
        disabled={readOnly}
        className="hidden"
        onChange={handleFileChange}
      />
    </nav>
  );
}
