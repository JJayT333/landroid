import { useRef, useState } from 'react';
import AssetPreviewModal from '../components/modals/AssetPreviewModal';
import MapAssetModal from '../components/modals/MapAssetModal';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useWorkspaceStore } from '../store/workspace-store';
import { createBlankMapAsset } from '../types/map';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ResearchView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const workspaceId = useMapStore((state) => state.workspaceId);
  const mapAssets = useMapStore((state) => state.mapAssets);
  const addAsset = useMapStore((state) => state.addAsset);
  const updateAsset = useMapStore((state) => state.updateAsset);
  const removeAsset = useMapStore((state) => state.removeAsset);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);

  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

  const previewAsset =
    mapAssets.find((asset) => asset.id === previewAssetId) ?? null;
  const editingAsset =
    mapAssets.find((asset) => asset.id === editingAssetId) ?? null;

  return (
    <div className="h-full flex flex-col gap-4 p-4 bg-parchment-dark/30">
      <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-display font-bold text-ink">Research</div>
          <div className="text-sm text-ink-light">
            Store map PDFs, images, and GeoJSON as structured workspace assets.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-light">
            Short term: PDF, PNG/JPG, GeoJSON
          </span>
          <button
            type="button"
            disabled={!workspaceId}
            onClick={() => inputRef.current?.click()}
            className="px-3 py-2 rounded-lg text-sm font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors disabled:opacity-50"
          >
            Upload Asset
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.geojson,.json"
        multiple
        onChange={async (event) => {
          if (!workspaceId) return;
          const files = Array.from(event.target.files ?? []);
          for (const file of files) {
            const asset = createBlankMapAsset(workspaceId, file, {
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
            });
            await addAsset(asset);
            setEditingAssetId(asset.id);
          }
          event.target.value = '';
        }}
      />

      <div className="flex-1 overflow-auto rounded-xl border border-ledger-line bg-parchment shadow-sm">
        {mapAssets.length === 0 ? (
          <div className="h-full flex items-center justify-center px-6">
            <div className="text-center">
              <div className="text-xl font-display font-bold text-ink">
                No map assets yet
              </div>
              <div className="text-sm text-ink-light mt-2">
                Add exported ArcGIS artifacts, exhibits, plats, or reference maps here.
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {mapAssets.map((asset) => {
              const deskMap = deskMaps.find((deskMapItem) => deskMapItem.id === asset.deskMapId);
              const node = nodes.find((nodeItem) => nodeItem.id === asset.nodeId);
              const owner = owners.find((ownerItem) => ownerItem.id === asset.linkedOwnerId);
              const lease = leases.find((leaseItem) => leaseItem.id === asset.leaseId);

              return (
                <div
                  key={asset.id}
                  className="rounded-xl border border-ledger-line bg-parchment-dark/40 p-4 space-y-3"
                >
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-ink-light">
                      {asset.kind}
                    </div>
                    <div className="text-lg font-display font-bold text-ink">
                      {asset.title || asset.fileName}
                    </div>
                    <div className="text-xs text-ink-light break-all">{asset.fileName}</div>
                  </div>

                  <div className="text-sm text-ink-light space-y-1">
                    {asset.county && <div>County: {asset.county}</div>}
                    {asset.prospect && <div>Prospect: {asset.prospect}</div>}
                    {asset.effectiveDate && <div>Effective: {asset.effectiveDate}</div>}
                    {deskMap && <div>Desk Map: {deskMap.name}</div>}
                    {node && <div>Node: {node.grantee || node.docNo || node.id}</div>}
                    {owner && <div>Owner: {owner.name || owner.id}</div>}
                    {lease && (
                      <div>Lease: {lease.leaseName || lease.lessee || lease.docNo || lease.id}</div>
                    )}
                    {asset.source && <div>Source: {asset.source}</div>}
                  </div>

                  {asset.notes && (
                    <div className="text-sm text-ink whitespace-pre-wrap">{asset.notes}</div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewAssetId(asset.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 transition-colors"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingAssetId(asset.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-ledger transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadBlob(asset.blob, asset.fileName)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-ledger transition-colors"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Delete this map asset?')) {
                          return;
                        }
                        await removeAsset(asset.id);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewAsset && (
        <AssetPreviewModal
          fileName={previewAsset.fileName}
          mimeType={previewAsset.mimeType}
          blob={previewAsset.blob}
          onClose={() => setPreviewAssetId(null)}
        />
      )}

      {editingAsset && (
        <MapAssetModal
          asset={editingAsset}
          deskMaps={deskMaps}
          nodes={nodes}
          owners={owners}
          leases={leases}
          onClose={() => setEditingAssetId(null)}
          onPreview={() => setPreviewAssetId(editingAsset.id)}
          onSave={(fields) => updateAsset(editingAsset.id, fields)}
        />
      )}
    </div>
  );
}
