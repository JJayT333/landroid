/**
 * Top navigation bar — view switcher, workspace name, save/load.
 */
import { useEffect, useRef, useState } from 'react';
import { useUIStore, type ViewMode } from '../../store/ui-store';
import { useMapStore } from '../../store/map-store';
import { useOwnerStore } from '../../store/owner-store';
import { useResearchStore } from '../../store/research-store';
import { useCurativeStore } from '../../store/curative-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useCanvasStore } from '../../store/canvas-store';
import {
  downloadLandroidFile,
  exportPdfWorkspaceData,
  importLandroidFile,
  replacePdfWorkspaceData,
} from '../../storage/workspace-persistence';
import { importCSV } from '../../storage/csv-io';
import { assertFileSize, FILE_SIZE_LIMITS } from '../../utils/file-validation';
import { seedCombinatorialData } from '../../storage/seed-test-data';

const landroidLogoUrl = new URL('../../assets/branding/landroid-logo.png', import.meta.url).href;
const ravenForestBackdropUrl = new URL('../../assets/branding/raven-forest-backdrop.png', import.meta.url).href;

const views: { id: ViewMode; label: string }[] = [
  { id: 'chart', label: 'Desk Map' },
  { id: 'leasehold', label: 'Leasehold' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'master', label: 'Runsheet' },
  { id: 'owners', label: 'Owners' },
  { id: 'curative', label: 'Curative' },
  { id: 'maps', label: 'Maps' },
  { id: 'federalLeasing', label: 'Federal Leasing' },
  { id: 'research', label: 'Research' },
];

export default function Navbar() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const setProjectName = useWorkspaceStore((s) => s.setProjectName);
  const leaseholdUnit = useWorkspaceStore((s) => s.leaseholdUnit);
  const leaseholdAssignments = useWorkspaceStore((s) => s.leaseholdAssignments);
  const leaseholdOrris = useWorkspaceStore((s) => s.leaseholdOrris);
  const leaseholdTransferOrderEntries = useWorkspaceStore(
    (s) => s.leaseholdTransferOrderEntries
  );
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace);

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

  const beginEditingName = () => {
    setNameDraft(projectName);
    setIsEditingName(true);
  };

  const commitName = () => {
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
    setSeedLoading(true);
    try {
      const { nodeCount, pdfCount } = await seedCombinatorialData();
      console.log(
        `[combinatorial] Loaded ${nodeCount} nodes, attached ${pdfCount} PDFs`
      );
    } catch (err) {
      console.error('[combinatorial] Failed:', err);
    }
    setSeedLoading(false);
  };

  const handleSave = async () => {
    setFileMenuOpen(false);
    const state = useWorkspaceStore.getState();
    const canvasState = useCanvasStore.getState();
    await downloadLandroidFile({
      workspaceId: state.workspaceId,
      projectName: state.projectName,
      nodes: state.nodes,
      deskMaps: state.deskMaps,
      leaseholdUnit,
      leaseholdAssignments,
      leaseholdOrris,
      leaseholdTransferOrderEntries,
      activeDeskMapId: state.activeDeskMapId,
      activeUnitCode: state.activeUnitCode,
      instrumentTypes: state.instrumentTypes,
      ownerData: await useOwnerStore.getState().exportWorkspaceData(),
      pdfData: await exportPdfWorkspaceData(state.nodes),
      mapData: await useMapStore.getState().exportWorkspaceData(),
      researchData: await useResearchStore.getState().exportWorkspaceData(),
      curativeData: await useCurativeStore.getState().exportWorkspaceData(),
      canvas: {
        nodes: canvasState.nodes,
        edges: canvasState.edges,
        viewport: canvasState.viewport,
        gridCols: canvasState.gridCols,
        gridRows: canvasState.gridRows,
        orientation: canvasState.orientation,
        pageSize: canvasState.pageSize,
        horizontalSpacingFactor: canvasState.horizontalSpacingFactor,
        verticalSpacingFactor: canvasState.verticalSpacingFactor,
        snapToGrid: canvasState.snapToGrid,
        gridSize: canvasState.gridSize,
      },
    });
  };

  const handleLoad = () => {
    setFileMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.landroid')) {
        assertFileSize(file, FILE_SIZE_LIMITS.LANDROID, '.landroid file');
        const data = await importLandroidFile(file);
        loadWorkspace(data);
        useCanvasStore.getState().loadCanvas(data.canvas ?? { nodes: [], edges: [] });
        await Promise.all([
          useOwnerStore.getState().replaceWorkspaceData(
            data.workspaceId,
            data.ownerData ?? { owners: [], leases: [], contacts: [], docs: [] }
          ),
          replacePdfWorkspaceData(data.pdfData ?? { pdfs: [] }, data.nodes),
          useMapStore.getState().replaceWorkspaceData(
            data.workspaceId,
            data.mapData ?? { mapAssets: [], mapRegions: [], mapReferences: [] }
          ),
          useResearchStore.getState().replaceWorkspaceData(
            data.workspaceId,
            data.researchData ?? {
              imports: [],
              sources: [],
              formulas: [],
              projectRecords: [],
              questions: [],
            }
          ),
          useCurativeStore.getState().replaceWorkspaceData(
            data.workspaceId,
            data.curativeData ?? { titleIssues: [] }
          ),
        ]);
      } else if (file.name.endsWith('.csv')) {
        assertFileSize(file, FILE_SIZE_LIMITS.SPREADSHEET, 'CSV file');
        const text = await file.text();
        const result = importCSV(text);
        loadWorkspace(result);
        useCanvasStore.getState().loadCanvas({ nodes: [], edges: [] });
        await Promise.all([
          useOwnerStore.getState().setWorkspace(result.workspaceId),
          useMapStore.getState().setWorkspace(result.workspaceId),
          useResearchStore.getState().setWorkspace(result.workspaceId),
          useCurativeStore.getState().setWorkspace(result.workspaceId),
        ]);
      } else {
        alert('Unsupported file type. Use .landroid or .csv files.');
      }
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    e.target.value = '';
  };

  return (
    <nav className="no-print flex items-center justify-between px-4 py-2 bg-ink text-parchment border-b border-leather">
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
              onClick={beginEditingName}
              title="Click to rename project"
              aria-label={`Project name: ${projectName}. Click to rename.`}
              className="block max-w-[12rem] truncate rounded px-0.5 text-left text-xs text-parchment/60 font-mono hover:text-parchment hover:bg-ink-light/30"
            >
              {projectName}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          <div className="flex items-center pr-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-parchment/15 bg-parchment/10 p-1 shadow-md">
              <img
                src={ravenForestBackdropUrl}
                alt="Prospect mark"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`
                px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
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
                  onClick={handleLoad}
                  className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment"
                >
                  Load workspace
                </button>
              </div>
            )}
          </div>

          <div ref={demoMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setDemoMenuOpen((open) => !open);
                setFileMenuOpen(false);
              }}
              disabled={seedLoading}
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
                  disabled={seedLoading}
                  className="block w-full px-3 py-2 text-left text-xs text-parchment/80 hover:bg-ink-light/40 hover:text-parchment disabled:opacity-50"
                >
                  Combinatorial — Raven Forest
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".landroid,.csv"
        className="hidden"
        onChange={handleFileChange}
      />
    </nav>
  );
}
