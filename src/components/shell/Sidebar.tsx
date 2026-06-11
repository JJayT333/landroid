/**
 * Collapsible left sidebar — the app shell from the Ledger Refined design
 * handoff (replaces the old top Navbar; every control it carried lives here
 * or in the ⋯ ProjectMenu). Expanded = 248px icon+label nav with the project
 * row up top and the save/storage status block pinned at the bottom; collapsed
 * = 58px icon rail with tooltips. Nav grouping is the locked decision: seven
 * main views, then Curative/Maps/Sales Deck/Federal Leasing under
 * "Prospect Tools".
 */
import { useEffect, useRef, useState } from 'react';
import { useUIStore, type ViewMode } from '../../store/ui-store';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useStorageHealthStore } from '../../store/storage-health-store';
import {
  READ_ONLY_WORKSPACE_EDIT_TITLE,
  useWorkspaceReadOnly,
} from '../../store/write-lease-store';
import { hydrateTitleActionLogFromImportedLedger } from '../../store/title-action-log';
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
import { useConfirmation } from '../shared/ConfirmationProvider';
import { shouldShowDemoDataMenu } from '../shared/navbar-policy';
import { LedgerStatusChip } from '../shared/TitleLedgerStatusBanner';
import ProjectMenu from './ProjectMenu';
import { CollapseIcon, DotsIcon, ExpandIcon, ShellIcon, type ShellIconName } from './icons';

const MAIN_NAV: { id: ViewMode; label: string; icon: ShellIconName }[] = [
  { id: 'chart', label: 'Desk Map', icon: 'deskMap' },
  { id: 'leasehold', label: 'Leasehold', icon: 'leasehold' },
  { id: 'flowchart', label: 'Flowchart', icon: 'flowchart' },
  { id: 'master', label: 'Runsheet', icon: 'runsheet' },
  { id: 'documents', label: 'Documents', icon: 'documents' },
  { id: 'owners', label: 'Owners', icon: 'owners' },
  { id: 'research', label: 'Research', icon: 'research' },
];

const PROSPECT_NAV: { id: ViewMode; label: string; icon: ShellIconName }[] = [
  { id: 'curative', label: 'Curative', icon: 'curative' },
  { id: 'maps', label: 'Maps', icon: 'maps' },
  { id: 'pitch', label: 'Sales Deck', icon: 'salesDeck' },
  { id: 'federalLeasing', label: 'Federal Leasing', icon: 'federalLeasing' },
];

const LOAD_DEMO_CONFIRMATION_TEXT = 'LOAD DEMO';
const LOAD_WORKSPACE_CONFIRMATION_TEXT = 'LOAD WORKSPACE';
const SIDEBAR_COLLAPSED_KEY = 'landroid.shell.sidebarCollapsed';

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

function formatSavedAt(value: string | null): string {
  if (!value) return 'Not saved yet';
  const stamp = new Date(value);
  if (Number.isNaN(stamp.getTime())) return 'Not saved yet';
  return `Saved ${stamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

interface SidebarProps {
  onOpenProjectPicker?: () => void;
}

export default function Sidebar({ onOpenProjectPicker }: SidebarProps) {
  const readOnly = useWorkspaceReadOnly();
  const showDemoDataMenu = shouldShowDemoDataMenu();
  const { alert: showAlert, confirm: requestConfirmation } = useConfirmation();
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const setProjectName = useWorkspaceStore((s) => s.setProjectName);
  const lastSavedAt = useStorageHealthStore((s) => s.lastSavedAt);
  const persistentStorage = useStorageHealthStore((s) => s.persistentStorage);
  const rollingAutoExport = useStorageHealthStore((s) => s.rollingAutoExport);

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  );
  const toggleCollapsed = () => {
    setMenuOpen(false);
    setCollapsed((value) => {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '0' : '1');
      return !value;
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(projectName);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

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

  /* ── File / demo handlers (ported verbatim from the old Navbar) ── */

  const exportCurrentWorkspace = async () => {
    const currentExport = await buildCurrentLandroidExport();
    await downloadLandroidFile(currentExport.data, currentExport.options);
    useStorageHealthStore.getState().recordWorkspaceExported();
  };

  const handleConfigureAutoExport = async () => {
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

  const handleCombinatorial = async () => {
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
      // Demo loader: always replace any prior Dr. Elmore project with a
      // pristine copy from the current bundled sample. importAndOpenWorkspace
      // hydrates the title ledger itself (DA-H2).
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
        // DA-H2: importAndOpenWorkspace hydrates the title ledger itself.
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

  const menuActions = {
    onOpenProjects: () => onOpenProjectPicker?.(),
    onSaveWorkspace: () => void exportCurrentWorkspace(),
    onLoadWorkspace: () => {
      if (!readOnly) fileInputRef.current?.click();
    },
    onConfigureAutoExport: () => void handleConfigureAutoExport(),
    onDisableAutoExport: () => void disableRollingAutoExport(),
    onLoadCombinatorial: () => void handleCombinatorial(),
    onLoadVulcanMesa: () => void handleVulcanMesa(),
    onLoadSpringhill: () => void handleSpringhill(),
  };

  const savedLabel = formatSavedAt(lastSavedAt);
  const storageHealthy = persistentStorage?.status === 'persisted';
  const statusLine = `Storage ${storageHealthy ? 'persistent' : 'best effort'} · ${
    rollingAutoExport.enabled
      ? `Auto-export ${rollingAutoExport.directoryName ?? 'on'}`
      : 'Backup manual'
  }`;
  const statusDotClass = lastSavedAt
    ? 'bg-[#3f7d4e]'
    : 'bg-gold';

  const navButton = (
    item: { id: ViewMode; label: string; icon: ShellIconName },
    active: boolean
  ) => (
    <button
      key={item.id}
      type="button"
      onClick={() => setView(item.id)}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-[11px] py-[7px] text-[13px] transition-colors ${
        active
          ? 'bg-parchment-dark font-semibold text-leather'
          : 'text-ink-soft hover:bg-parchment'
      }`}
    >
      <ShellIcon name={item.icon} />
      {item.label}
    </button>
  );

  const railButton = (
    item: { id: ViewMode; label: string; icon: ShellIconName },
    active: boolean
  ) => (
    <button
      key={item.id}
      type="button"
      onClick={() => setView(item.id)}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={`flex h-[34px] w-[34px] items-center justify-center rounded-[9px] transition-colors ${
        active
          ? 'bg-parchment-dark text-leather'
          : 'text-ink-light hover:bg-parchment'
      }`}
    >
      <ShellIcon name={item.icon} size={17} />
    </button>
  );

  /* ── Collapsed icon rail ── */
  if (collapsed) {
    return (
      <nav
        aria-label="Primary"
        className="no-print relative flex w-[58px] shrink-0 flex-col items-center border-r border-ledger-line bg-parchment-light py-3"
      >
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-ink font-display text-base font-bold text-[#efe6d4]">
          L
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Expand sidebar"
          aria-label="Expand sidebar"
          className="mt-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-ink-light transition-colors hover:bg-parchment-dark"
        >
          <ExpandIcon />
        </button>
        <div className="my-2.5 h-px w-[30px] bg-ledger-line" />
        <div className="flex flex-col items-center gap-[3px] overflow-y-auto">
          {MAIN_NAV.map((item) => railButton(item, view === item.id))}
          <div className="my-[7px] h-px w-[30px] bg-ledger-line" />
          {PROSPECT_NAV.map((item) => railButton(item, view === item.id))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-2.5" ref={menuRef}>
          <div
            title={`${savedLabel} · ${statusLine}`}
            className={`h-2 w-2 rounded-full ${statusDotClass}`}
          />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            title="Projects · File · Demo Data"
            aria-label="Project menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-light transition-colors hover:bg-parchment-dark"
          >
            <DotsIcon size={16} />
          </button>
          {menuOpen && (
            <ProjectMenu
              className="absolute bottom-3 left-[62px] z-40"
              readOnly={readOnly}
              seedLoading={seedLoading}
              showDemoDataMenu={showDemoDataMenu}
              autoExportEnabled={rollingAutoExport.enabled}
              onClose={() => setMenuOpen(false)}
              {...menuActions}
            />
          )}
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

  /* ── Expanded sidebar ── */
  return (
    <nav
      aria-label="Primary"
      className="no-print flex w-[248px] shrink-0 flex-col border-r border-ledger-line bg-parchment-light"
    >
      <div className="relative px-3 pb-2.5 pt-3.5" ref={menuRef}>
        <div className="flex items-center gap-2">
          <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-ink font-display text-base font-bold text-[#efe6d4]">
            L
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-[15px] font-bold leading-tight text-ink">
              LANDroid
            </div>
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
                    setNameDraft(projectName);
                    setIsEditingName(false);
                  }
                }}
                aria-label="Project name"
                className="block w-full truncate rounded border border-line-strong bg-white px-1 text-[11px] text-ink focus:border-leather focus:outline-none"
              />
            ) : (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  if (readOnly) return;
                  setNameDraft(projectName);
                  setIsEditingName(true);
                }}
                title={readOnly ? READ_ONLY_WORKSPACE_EDIT_TITLE : 'Click to rename project'}
                aria-label={`Project name: ${projectName}. Click to rename.`}
                className="block w-full truncate rounded text-left text-[11px] text-ink-light hover:text-ink disabled:cursor-not-allowed"
              >
                {projectName}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            title="Projects · File · Demo Data"
            aria-label="Project menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-ink-light transition-colors hover:bg-parchment-dark"
          >
            <DotsIcon />
          </button>
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] text-ink-light transition-colors hover:bg-parchment-dark"
          >
            <CollapseIcon />
          </button>
        </div>
        {menuOpen && (
          <ProjectMenu
            className="absolute right-2.5 top-12 z-40"
            readOnly={readOnly}
            seedLoading={seedLoading}
            showDemoDataMenu={showDemoDataMenu}
            autoExportEnabled={rollingAutoExport.enabled}
            onClose={() => setMenuOpen(false)}
            {...menuActions}
          />
        )}
      </div>
      <div className="mx-3.5 mb-1.5 h-px bg-ledger-line" />

      <div className="flex flex-1 flex-col gap-px overflow-y-auto px-2.5 py-1">
        {MAIN_NAV.map((item) => navButton(item, view === item.id))}
        <div className="px-[11px] pb-1 pt-4 text-[9px] font-bold uppercase tracking-[0.12em] text-ink-faint">
          Prospect Tools
        </div>
        {PROSPECT_NAV.map((item) => navButton(item, view === item.id))}
      </div>

      <div className="border-t border-ledger-line px-3.5 py-3">
        <div className="flex items-center gap-[7px]">
          <div className={`h-[7px] w-[7px] rounded-full ${statusDotClass}`} />
          <div className="text-[11px] font-semibold text-ink">{savedLabel}</div>
          <button
            type="button"
            onClick={() => void exportCurrentWorkspace()}
            className="ml-auto rounded-[7px] border border-line-strong px-2.5 py-[3px] text-[10.5px] font-semibold text-ink transition-colors hover:bg-parchment-dark"
          >
            Backup Now
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="truncate text-[10px] text-ink-light" title={statusLine}>
            {statusLine}
          </div>
          <LedgerStatusChip />
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
