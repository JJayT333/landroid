import { useState } from 'react';
import { useMapStore } from '../../store/map-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import { downloadUnitPlatPdf } from '../../maps/plat-pdf';
import TractMapCanvas from './TractMapCanvas';
import TractChooser from './TractChooser';

type TractMapMode = 'overlay' | 'cards';

/**
 * DA2-M — host for the two tract views: the flat polygon overlay (M4) and the
 * 3D flip-card chooser (M5), behind one header + a mode toggle, plus the plat
 * PDF export (M6).
 */
export default function TractMapSection() {
  const tractFeatures = useMapStore((state) => state.tractFeatures);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const projectName = useWorkspaceStore((state) => state.projectName);
  const [mode, setMode] = useState<TractMapMode>('overlay');
  const [exporting, setExporting] = useState(false);

  if (tractFeatures.length === 0) return null;

  async function exportPlat() {
    setExporting(true);
    try {
      const deskMapById = new Map(deskMaps.map((dm) => [dm.id, dm]));
      const legend = tractFeatures.map((feature) => {
        const deskMap = feature.matchedDeskMapId ? deskMapById.get(feature.matchedDeskMapId) : null;
        return {
          tractKey: feature.tractKey,
          landTractId: deskMap ? (deskMap.tractId || deskMap.code || '') : '',
        };
      });
      await downloadUnitPlatPdf({
        projectName,
        generatedAt: new Date().toLocaleDateString(),
        tractFeatures,
        legend,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="rounded-md border border-ledger-line bg-ledger p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Tract map</div>
          <div className="text-xs text-ink-light">
            {tractFeatures.length} tract{tractFeatures.length === 1 ? '' : 's'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => void exportPlat()}
            title="Export the unit plat as a PDF exhibit"
            className="rounded-md border border-ledger-line bg-parchment px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-parchment-dark disabled:opacity-50"
          >
            {exporting ? 'Building…' : 'Plat PDF'}
          </button>
          <div className="flex items-center rounded-md border border-ledger-line bg-ledger p-1">
            {(['overlay', 'cards'] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setMode(candidate)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  mode === candidate
                    ? 'bg-leather text-parchment'
                    : 'text-ink-light hover:text-ink'
                }`}
              >
                {candidate === 'overlay' ? 'Overlay' : 'Cards'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === 'overlay' ? <TractMapCanvas /> : <TractChooser />}
    </div>
  );
}
