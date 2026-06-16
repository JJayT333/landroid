import { useState } from 'react';
import { useMapStore } from '../../store/map-store';
import TractMapCanvas from './TractMapCanvas';
import TractChooser from './TractChooser';

type TractMapMode = 'overlay' | 'cards';

/**
 * DA2-M — host for the two tract views: the flat polygon overlay (M4) and the
 * 3D flip-card chooser (M5), behind one header + a mode toggle.
 */
export default function TractMapSection() {
  const tractFeatureCount = useMapStore((state) => state.tractFeatures.length);
  const [mode, setMode] = useState<TractMapMode>('overlay');

  if (tractFeatureCount === 0) return null;

  return (
    <div className="rounded-md border border-ledger-line bg-ledger p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Tract map</div>
          <div className="text-xs text-ink-light">
            {tractFeatureCount} tract{tractFeatureCount === 1 ? '' : 's'}
          </div>
        </div>
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

      {mode === 'overlay' ? <TractMapCanvas /> : <TractChooser />}
    </div>
  );
}
