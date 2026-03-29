/**
 * Top navigation bar — view switcher, workspace name, save/load.
 */
import { useRef, useState } from 'react';
import { useUIStore, type ViewMode } from '../../store/ui-store';
import { useMapStore } from '../../store/map-store';
import { useOwnerStore } from '../../store/owner-store';
import { useResearchStore } from '../../store/research-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useCanvasStore } from '../../store/canvas-store';
import { downloadLandroidFile, importLandroidFile } from '../../storage/workspace-persistence';
import { importCSV } from '../../storage/csv-io';
import { seedStressTestData } from '../../storage/seed-test-data';

const views: { id: ViewMode; label: string }[] = [
  { id: 'chart', label: 'Desk Map' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'master', label: 'Runsheet' },
  { id: 'owners', label: 'Owners' },
  { id: 'maps', label: 'Maps' },
  { id: 'research', label: 'Research' },
];

export default function Navbar() {
  const view = useUIStore((s) => s.view);
  const setView = useUIStore((s) => s.setView);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const loadWorkspace = useWorkspaceStore((s) => s.loadWorkspace);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [seeding, setSeeding] = useState(false);

  const handleStressTest = async () => {
    setSeeding(true);
    try {
      const { nodeCount, pdfCount } = await seedStressTestData();
      console.log(`[stress] Loaded ${nodeCount} nodes, attached ${pdfCount} PDFs`);
    } catch (err) {
      console.error('[stress] Failed:', err);
    }
    setSeeding(false);
  };

  const handleSave = async () => {
    const state = useWorkspaceStore.getState();
    const canvasState = useCanvasStore.getState();
    await downloadLandroidFile({
      workspaceId: state.workspaceId,
      projectName: state.projectName,
      nodes: state.nodes,
      deskMaps: state.deskMaps,
      activeDeskMapId: state.activeDeskMapId,
      instrumentTypes: state.instrumentTypes,
      ownerData: await useOwnerStore.getState().exportWorkspaceData(),
      mapData: await useMapStore.getState().exportWorkspaceData(),
      researchData: await useResearchStore.getState().exportWorkspaceData(),
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
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.endsWith('.landroid')) {
        const data = await importLandroidFile(file);
        loadWorkspace(data);
        useCanvasStore.getState().loadCanvas(data.canvas ?? { nodes: [], edges: [] });
        await Promise.all([
          useOwnerStore.getState().replaceWorkspaceData(
            data.workspaceId,
            data.ownerData ?? { owners: [], leases: [], contacts: [], docs: [] }
          ),
          useMapStore.getState().replaceWorkspaceData(
            data.workspaceId,
            data.mapData ?? { mapAssets: [], mapRegions: [], mapReferences: [] }
          ),
          useResearchStore.getState().replaceWorkspaceData(
            data.workspaceId,
            data.researchData ?? { imports: [] }
          ),
        ]);
      } else if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const result = importCSV(text);
        loadWorkspace(result);
        useCanvasStore.getState().loadCanvas({ nodes: [], edges: [] });
        await Promise.all([
          useOwnerStore.getState().setWorkspace(result.workspaceId),
          useMapStore.getState().setWorkspace(result.workspaceId),
          useResearchStore.getState().setWorkspace(result.workspaceId),
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
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-display font-bold tracking-wide">LANDroid</h1>
        <span className="text-sm text-parchment/60 font-mono">{projectName}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1">
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
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-parchment/70 hover:text-parchment hover:bg-ink-light/30 transition-colors"
          >
            Save
          </button>
          <button
            onClick={handleLoad}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-parchment/70 hover:text-parchment hover:bg-ink-light/30 transition-colors"
          >
            Load
          </button>
          <button
            onClick={handleStressTest}
            disabled={seeding}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-seal/70 hover:text-seal hover:bg-seal/10 transition-colors disabled:opacity-50"
          >
            {seeding ? 'Loading...' : 'Stress (100/150/200)'}
          </button>
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
