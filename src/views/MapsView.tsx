import { useEffect, useMemo, useRef, useState } from 'react';
import AssetPreviewModal from '../components/modals/AssetPreviewModal';
import MapAssetModal from '../components/modals/MapAssetModal';
import MapReferenceModal from '../components/modals/MapReferenceModal';
import MapRegionModal from '../components/modals/MapRegionModal';
import { parseGeoJsonSummary, type GeoJsonSummary } from '../maps/geojson-summary';
import { useMapStore } from '../store/map-store';
import { useOwnerStore } from '../store/owner-store';
import { useResearchStore } from '../store/research-store';
import { useWorkspaceStore } from '../store/workspace-store';
import {
  createBlankMapAsset,
  createBlankMapExternalReference,
  createBlankMapRegion,
  normalizeMapReferenceUrl,
  type MapAsset,
  type MapExternalReference,
  type MapRegion,
} from '../types/map';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isImageAsset(asset: MapAsset | null): boolean {
  return !!asset && asset.mimeType.toLowerCase().startsWith('image/');
}

function isPdfAsset(asset: MapAsset | null): boolean {
  return !!asset && asset.mimeType.toLowerCase().includes('pdf');
}

function isTextLikeAsset(asset: MapAsset | null): boolean {
  if (!asset) return false;
  const lowerMime = asset.mimeType.toLowerCase();
  const lowerName = asset.fileName.toLowerCase();
  return (
    lowerMime.includes('json') ||
    lowerMime.startsWith('text/') ||
    lowerName.endsWith('.geojson') ||
    lowerName.endsWith('.json')
  );
}

function clampRegionOrigin(value: number, size: number): number {
  return Math.max(0, Math.min(value, 1 - size));
}

function formatNodeLabel(nodeId: string | null, nodes: ReturnType<typeof useWorkspaceStore.getState>['nodes']) {
  if (!nodeId) return null;
  const node = nodes.find((candidate) => candidate.id === nodeId);
  return node ? node.grantee || node.docNo || node.id : nodeId;
}

function formatDeskMapLabel(
  deskMapId: string | null,
  deskMaps: ReturnType<typeof useWorkspaceStore.getState>['deskMaps']
) {
  if (!deskMapId) return null;
  const deskMap = deskMaps.find((candidate) => candidate.id === deskMapId);
  return deskMap ? deskMap.name : deskMapId;
}

function formatOwnerLabel(
  ownerId: string | null,
  owners: ReturnType<typeof useOwnerStore.getState>['owners']
) {
  if (!ownerId) return null;
  const owner = owners.find((candidate) => candidate.id === ownerId);
  return owner ? owner.name || owner.id : ownerId;
}

function formatLeaseLabel(
  leaseId: string | null,
  leases: ReturnType<typeof useOwnerStore.getState>['leases']
) {
  if (!leaseId) return null;
  const lease = leases.find((candidate) => candidate.id === leaseId);
  return lease ? lease.leaseName || lease.lessee || lease.docNo || lease.id : leaseId;
}

function formatResearchSourceLabel(
  sourceId: string | null,
  sources: ReturnType<typeof useResearchStore.getState>['sources']
) {
  if (!sourceId) return null;
  const source = sources.find((candidate) => candidate.id === sourceId);
  return source ? source.title || source.citation || source.id : sourceId;
}

function formatResearchProjectLabel(
  projectRecordId: string | null,
  projectRecords: ReturnType<typeof useResearchStore.getState>['projectRecords']
) {
  if (!projectRecordId) return null;
  const record = projectRecords.find((candidate) => candidate.id === projectRecordId);
  return record ? record.name || record.serialOrReference || record.id : projectRecordId;
}

interface FeaturedMapStageProps {
  asset: MapAsset;
  regions: MapRegion[];
  selectedRegionId: string | null;
  placingRegion: boolean;
  onSelectRegion: (id: string | null) => void;
  onPlaceRegion: (position: { x: number; y: number }) => void;
}

function FeaturedMapStage({
  asset,
  regions,
  selectedRegionId,
  placingRegion,
  onSelectRegion,
  onPlaceRegion,
}: FeaturedMapStageProps) {
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [geoJsonSummary, setGeoJsonSummary] = useState<GeoJsonSummary | null>(null);
  const objectUrl = useMemo(() => URL.createObjectURL(asset.blob), [asset.blob]);

  useEffect(() => {
    if (!isTextLikeAsset(asset)) {
      setTextPreview(null);
      setGeoJsonSummary(null);
      return;
    }

    let cancelled = false;
    asset.blob.text().then((text) => {
      if (cancelled) return;
      try {
        setTextPreview(JSON.stringify(JSON.parse(text), null, 2));
        const nextSummary = parseGeoJsonSummary(text);
        setGeoJsonSummary(nextSummary.featureCount > 0 ? nextSummary : null);
      } catch {
        setTextPreview(text);
        setGeoJsonSummary(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [asset]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (isImageAsset(asset)) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-ledger-line bg-ledger p-3 overflow-auto">
          <div
            className={`relative inline-block max-w-full ${
              placingRegion ? 'cursor-crosshair' : ''
            }`}
            onClick={(event) => {
              if (!placingRegion) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const x = (event.clientX - rect.left) / rect.width;
              const y = (event.clientY - rect.top) / rect.height;
              onPlaceRegion({ x, y });
            }}
          >
            <img
              src={objectUrl}
              alt={asset.title || asset.fileName}
              className="block max-h-[calc(100vh-17rem)] max-w-full rounded-lg shadow-sm"
            />
            <div className="absolute inset-0 pointer-events-none">
              {regions.map((region) => {
                const isSelected = region.id === selectedRegionId;
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectRegion(region.id);
                    }}
                    className={`absolute rounded-lg border-2 shadow-sm transition-all pointer-events-auto ${
                      isSelected ? 'ring-2 ring-ink/35' : 'hover:scale-[1.01]'
                    }`}
                    style={{
                      left: `${region.rect.x * 100}%`,
                      top: `${region.rect.y * 100}%`,
                      width: `${region.rect.width * 100}%`,
                      height: `${region.rect.height * 100}%`,
                      borderColor: region.color,
                      backgroundColor: `${region.color}22`,
                    }}
                  >
                    <span
                      className="absolute left-1.5 top-1.5 rounded bg-parchment/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm"
                      style={{ borderLeft: `3px solid ${region.color}` }}
                    >
                      {region.shortLabel || region.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-ink-light">
          <span>
            {placingRegion
              ? 'Click the map to place a starter region box, then finish details in the editor.'
              : 'Clickable regions are available on image-based maps in this first phase.'}
          </span>
          <span>{regions.length} saved regions</span>
        </div>
      </div>
    );
  }

  if (isPdfAsset(asset)) {
    return (
      <div className="space-y-3">
        <iframe
          src={objectUrl}
          className="w-full rounded-xl border border-ledger-line bg-ledger"
          style={{ height: 'calc(100vh - 17rem)' }}
          title={asset.fileName}
        />
        <div className="text-xs text-ink-light">
          PDF maps can be the featured presentation map now. For clickable presentation
          regions, upload a PNG or JPG export of the same map.
        </div>
      </div>
    );
  }

  if (isTextLikeAsset(asset)) {
    return (
      <div className="space-y-3">
        {geoJsonSummary && (
          <div className="rounded-xl border border-ledger-line bg-ledger p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">GeoJSON Features</div>
                <div className="text-xs text-ink-light">
                  Reference-only geometry summary for linking this map artifact.
                </div>
              </div>
              <span className="rounded-full border border-ledger-line bg-parchment px-2 py-0.5 text-[11px] font-semibold text-ink-light">
                {geoJsonSummary.featureCount} features
              </span>
            </div>
            {geoJsonSummary.bbox && (
              <div className="text-xs font-mono text-ink-light">
                Bounds: {geoJsonSummary.bbox.join(', ')}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {geoJsonSummary.features.slice(0, 8).map((feature) => (
                <div
                  key={feature.id}
                  className="rounded-lg border border-ledger-line bg-parchment px-3 py-2"
                >
                  <div className="text-sm font-semibold text-ink truncate">
                    {feature.label}
                  </div>
                  <div className="text-[11px] text-ink-light">
                    {feature.geometryType} • {feature.id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <pre className="max-h-[calc(100vh-17rem)] overflow-auto rounded-xl border border-ledger-line bg-ledger p-4 text-xs text-ink whitespace-pre-wrap break-words">
          {textPreview ?? 'Loading preview...'}
        </pre>
        <div className="text-xs text-ink-light">
          GeoJSON and text artifacts are available here for reference while the map-first
          workflow grows.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-ledger-line bg-ledger p-6 text-sm text-ink-light">
      This file type does not have an inline stage yet. Use Preview or Download to review it.
    </div>
  );
}

type ViewMode = 'present' | 'edit';

export default function MapsView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const workspaceId = useMapStore((state) => state.workspaceId);
  const mapAssets = useMapStore((state) => state.mapAssets);
  const mapRegions = useMapStore((state) => state.mapRegions);
  const mapReferences = useMapStore((state) => state.mapReferences);
  const addAsset = useMapStore((state) => state.addAsset);
  const updateAsset = useMapStore((state) => state.updateAsset);
  const removeAsset = useMapStore((state) => state.removeAsset);
  const setFeaturedAsset = useMapStore((state) => state.setFeaturedAsset);
  const addRegion = useMapStore((state) => state.addRegion);
  const updateRegion = useMapStore((state) => state.updateRegion);
  const removeRegion = useMapStore((state) => state.removeRegion);
  const addReference = useMapStore((state) => state.addReference);
  const updateReference = useMapStore((state) => state.updateReference);
  const removeReference = useMapStore((state) => state.removeReference);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const researchSources = useResearchStore((state) => state.sources);
  const researchProjectRecords = useResearchStore((state) => state.projectRecords);

  const [mode, setMode] = useState<ViewMode>('present');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editingReferenceId, setEditingReferenceId] = useState<string | null>(null);
  const [draftRegion, setDraftRegion] = useState<MapRegion | null>(null);
  const [draftReference, setDraftReference] = useState<MapExternalReference | null>(null);
  const [placingRegion, setPlacingRegion] = useState(false);

  useEffect(() => {
    if (mapAssets.length === 0) {
      setSelectedAssetId(null);
      return;
    }

    if (selectedAssetId && mapAssets.some((asset) => asset.id === selectedAssetId)) {
      return;
    }

    const preferredAsset = mapAssets.find((asset) => asset.isFeatured) ?? mapAssets[0];
    setSelectedAssetId(preferredAsset?.id ?? null);
  }, [mapAssets, selectedAssetId]);

  const selectedAsset =
    mapAssets.find((asset) => asset.id === selectedAssetId) ??
    mapAssets.find((asset) => asset.isFeatured) ??
    mapAssets[0] ??
    null;

  const assetRegions = useMemo(
    () =>
      selectedAsset
        ? mapRegions.filter((region) => region.assetId === selectedAsset.id)
        : [],
    [mapRegions, selectedAsset]
  );

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedRegionId(null);
      return;
    }

    if (selectedRegionId && assetRegions.some((region) => region.id === selectedRegionId)) {
      return;
    }

    setSelectedRegionId(assetRegions[0]?.id ?? null);
  }, [assetRegions, selectedAsset, selectedRegionId]);

  useEffect(() => {
    if (mode === 'present') {
      setPlacingRegion(false);
    }
  }, [mode]);

  const selectedRegion =
    assetRegions.find((region) => region.id === selectedRegionId) ?? null;

  const previewAsset =
    mapAssets.find((asset) => asset.id === previewAssetId) ?? null;
  const editingAsset =
    mapAssets.find((asset) => asset.id === editingAssetId) ?? null;
  const editingRegion =
    mapRegions.find((region) => region.id === editingRegionId) ?? draftRegion;
  const editingReference =
    mapReferences.find((reference) => reference.id === editingReferenceId) ?? draftReference;

  const assetReferences = selectedAsset
    ? mapReferences.filter(
        (reference) =>
          reference.assetId === selectedAsset.id && reference.regionId === null
      )
    : [];
  const regionReferences = selectedRegion
    ? mapReferences.filter((reference) => reference.regionId === selectedRegion.id)
    : [];

  const supportsRegionOverlay = isImageAsset(selectedAsset);
  const selectedDeskMapLabel = formatDeskMapLabel(selectedAsset?.deskMapId ?? null, deskMaps);
  const selectedNodeLabel = formatNodeLabel(selectedAsset?.nodeId ?? null, nodes);
  const selectedOwnerLabel = formatOwnerLabel(selectedAsset?.linkedOwnerId ?? null, owners);
  const selectedLeaseLabel = formatLeaseLabel(selectedAsset?.leaseId ?? null, leases);
  const selectedResearchSourceLabel = formatResearchSourceLabel(
    selectedAsset?.researchSourceId ?? null,
    researchSources
  );
  const selectedResearchProjectLabel = formatResearchProjectLabel(
    selectedAsset?.researchProjectRecordId ?? null,
    researchProjectRecords
  );
  const selectedRegionDeskMapLabel = formatDeskMapLabel(
    selectedRegion?.deskMapId ?? null,
    deskMaps
  );
  const selectedRegionNodeLabel = formatNodeLabel(selectedRegion?.nodeId ?? null, nodes);
  const selectedRegionOwnerLabel = formatOwnerLabel(
    selectedRegion?.linkedOwnerId ?? null,
    owners
  );
  const selectedRegionLeaseLabel = formatLeaseLabel(
    selectedRegion?.leaseId ?? null,
    leases
  );
  const selectedRegionResearchSourceLabel = formatResearchSourceLabel(
    selectedRegion?.researchSourceId ?? null,
    researchSources
  );
  const selectedRegionResearchProjectLabel = formatResearchProjectLabel(
    selectedRegion?.researchProjectRecordId ?? null,
    researchProjectRecords
  );

  return (
    <div className="h-full flex flex-col gap-4 p-4 bg-parchment-dark/30">
      <div className="rounded-xl border border-ledger-line bg-parchment shadow-sm px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <div className="text-xl font-display font-bold text-ink">Maps</div>
          <div className="text-sm text-ink-light">
            Open to a featured prospect map first, then layer presentation-friendly
            regions and reference links on top of it.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-ledger-line bg-ledger p-1 flex items-center">
            {(['present', 'edit'] as ViewMode[]).map((viewMode) => (
              <button
                key={viewMode}
                type="button"
                onClick={() => setMode(viewMode)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  mode === viewMode
                    ? 'bg-leather text-parchment'
                    : 'text-ink-light hover:text-ink'
                }`}
              >
                {viewMode === 'present' ? 'Present' : 'Edit'}
              </button>
            ))}
          </div>
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
            setSelectedAssetId(asset.id);
            setEditingAssetId(asset.id);
          }
          event.target.value = '';
        }}
      />

      {mapAssets.length === 0 ? (
        <div className="flex-1 rounded-xl border border-dashed border-ledger-line bg-parchment shadow-sm flex items-center justify-center px-6">
          <div className="max-w-xl text-center">
            <div className="text-2xl font-display font-bold text-ink">
              Start with the main prospect map
            </div>
            <div className="text-sm text-ink-light mt-2">
              Upload a PDF map, plat, exhibit image, or GeoJSON artifact. The first asset
              becomes the featured map automatically, and image exports can carry clickable
              presentation regions.
            </div>
          </div>
        </div>
      ) : selectedAsset ? (
        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(0,2.35fr)_340px]">
            <section className="min-h-0 rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden grid grid-rows-[auto_minmax(0,1fr)_auto]">
              <div className="px-4 py-3 border-b border-ledger-line bg-ledger flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-lg font-display font-bold text-ink truncate">
                      {selectedAsset.title || selectedAsset.fileName}
                    </div>
                    {selectedAsset.isFeatured && (
                      <span className="px-2 py-0.5 rounded-full bg-leather text-parchment text-[11px] font-semibold">
                        Featured
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full bg-parchment text-[11px] font-semibold text-ink-light border border-ledger-line">
                      {selectedAsset.kind}
                    </span>
                  </div>
                  <div className="text-xs text-ink-light break-all">
                    {selectedAsset.fileName}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {mode === 'edit' && !selectedAsset.isFeatured && (
                    <button
                      type="button"
                      onClick={() => setFeaturedAsset(selectedAsset.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
                    >
                      Make Featured
                    </button>
                  )}
                  {mode === 'edit' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!supportsRegionOverlay) return;
                        setPlacingRegion((current) => !current);
                      }}
                      disabled={!supportsRegionOverlay}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-ledger border border-ledger-line transition-colors disabled:opacity-50"
                    >
                      {placingRegion ? 'Cancel Placement' : 'New Region'}
                    </button>
                  )}
                  {mode === 'edit' && (
                    <button
                      type="button"
                      onClick={() =>
                        workspaceId &&
                        setDraftReference(
                          createBlankMapExternalReference(workspaceId, {
                            assetId: selectedAsset.id,
                            regionId: selectedRegion?.id ?? null,
                          })
                        )
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-ledger border border-ledger-line transition-colors"
                    >
                      Add Reference
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewAssetId(selectedAsset.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
                  >
                    Preview
                  </button>
                  {mode === 'edit' && (
                    <button
                      type="button"
                      onClick={() => setEditingAssetId(selectedAsset.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-ledger transition-colors"
                    >
                      Edit Asset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => downloadBlob(selectedAsset.blob, selectedAsset.fileName)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-ledger transition-colors"
                  >
                    Download
                  </button>
                  {mode === 'edit' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm('Delete this map asset and its linked regions/references?')) {
                          return;
                        }
                        await removeAsset(selectedAsset.id);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 min-h-0 overflow-auto">
                <FeaturedMapStage
                  asset={selectedAsset}
                  regions={assetRegions}
                  selectedRegionId={selectedRegionId}
                  placingRegion={placingRegion}
                  onSelectRegion={setSelectedRegionId}
                  onPlaceRegion={(position) => {
                    if (!workspaceId) return;
                    const width = 0.18;
                    const height = 0.16;
                    setDraftRegion(
                      createBlankMapRegion(workspaceId, selectedAsset.id, {
                        rect: {
                          x: clampRegionOrigin(position.x - width / 2, width),
                          y: clampRegionOrigin(position.y - height / 2, height),
                          width,
                          height,
                          page: 0,
                        },
                      })
                    );
                    setPlacingRegion(false);
                  }}
                />
              </div>

              <div className="border-t border-ledger-line bg-ledger/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-ink">Map Library</div>
                    <div className="text-xs text-ink-light">
                      Switch maps here without shrinking the main stage.
                    </div>
                  </div>
                  <div className="text-xs text-ink-light">{mapAssets.length} assets</div>
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                  {mapAssets.map((asset) => {
                    const regionCount = mapRegions.filter(
                      (region) => region.assetId === asset.id
                    ).length;
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => setSelectedAssetId(asset.id)}
                        className={`min-w-[220px] max-w-[220px] text-left rounded-xl border p-3 transition-colors ${
                          selectedAsset?.id === asset.id
                            ? 'border-leather bg-leather/10'
                            : 'border-ledger-line bg-parchment-dark/30 hover:bg-parchment'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-ink truncate">
                            {asset.title || asset.fileName}
                          </div>
                          {asset.isFeatured && (
                            <span className="text-[11px] font-semibold text-leather">
                              Featured
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-light mt-1">
                          {asset.kind} • {regionCount} regions
                        </div>
                        <div className="text-xs text-ink-light mt-2">
                          {asset.presentationSummary || asset.fileName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="min-h-0 rounded-xl border border-ledger-line bg-parchment shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-ledger-line bg-ledger">
                <div className="text-lg font-display font-bold text-ink">
                  {selectedRegion ? 'Region Story' : 'Map Story'}
                </div>
                <div className="text-xs text-ink-light">
                  {mode === 'present'
                    ? 'Presentation mode keeps attention on the current story.'
                    : 'Edit mode lets you wire this map into tracts, owners, and references.'}
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4">
                <section className="rounded-xl border border-ledger-line bg-parchment-dark/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">Featured Map Summary</div>
                    <span className="text-[11px] text-ink-light">{selectedAsset.kind}</span>
                  </div>
                  <div className="text-sm text-ink">
                    {selectedAsset.presentationSummary || 'Add a presentation summary to explain what this map shows in plain English.'}
                  </div>
                  <div className="text-xs text-ink-light space-y-1">
                    {selectedAsset.county && <div>County: {selectedAsset.county}</div>}
                    {selectedAsset.prospect && <div>Prospect: {selectedAsset.prospect}</div>}
                    {selectedAsset.effectiveDate && (
                      <div>Effective: {selectedAsset.effectiveDate}</div>
                    )}
                    {selectedDeskMapLabel && <div>Desk Map: {selectedDeskMapLabel}</div>}
                    {selectedNodeLabel && <div>Node: {selectedNodeLabel}</div>}
                    {selectedOwnerLabel && <div>Owner: {selectedOwnerLabel}</div>}
                    {selectedLeaseLabel && <div>Lease: {selectedLeaseLabel}</div>}
                    {selectedResearchSourceLabel && (
                      <div>Research Source: {selectedResearchSourceLabel}</div>
                    )}
                    {selectedResearchProjectLabel && (
                      <div>Project Record: {selectedResearchProjectLabel}</div>
                    )}
                    {selectedAsset.source && <div>Source: {selectedAsset.source}</div>}
                  </div>
                  {selectedAsset.notes && (
                    <div className="text-xs text-ink whitespace-pre-wrap border-t border-ledger-line pt-2">
                      {selectedAsset.notes}
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">Regions</div>
                    <div className="text-xs text-ink-light">{assetRegions.length} total</div>
                  </div>

                  {assetRegions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ledger-line bg-parchment-dark/30 p-3 text-sm text-ink-light">
                      {supportsRegionOverlay
                        ? 'Switch to Edit mode and place your first region directly on the map.'
                        : 'This asset can be featured now, but clickable regions start with PNG or JPG map exports.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {assetRegions.map((region) => (
                        <button
                          key={region.id}
                          type="button"
                          onClick={() => setSelectedRegionId(region.id)}
                          className={`w-full text-left rounded-xl border p-3 transition-colors ${
                            selectedRegionId === region.id
                              ? 'border-leather bg-leather/10'
                              : 'border-ledger-line bg-parchment-dark/30 hover:bg-ledger'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="h-3 w-3 rounded-full flex-none"
                                style={{ backgroundColor: region.color }}
                              />
                              <div className="text-sm font-semibold text-ink truncate">
                                {region.title}
                              </div>
                            </div>
                            <span className="text-[11px] text-ink-light">{region.status}</span>
                          </div>
                          <div className="text-xs text-ink-light mt-1">
                            {region.shortLabel && <span>{region.shortLabel} • </span>}
                            {region.acreage || 'No acreage yet'}
                          </div>
                          {region.summary && (
                            <div className="text-xs text-ink mt-2">
                              {region.summary}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {selectedRegion && (
                  <section className="rounded-xl border border-ledger-line bg-ledger p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-ink">
                          {selectedRegion.title}
                        </div>
                        <div className="text-xs text-ink-light">
                          {selectedRegion.shortLabel || 'No short label'} • {selectedRegion.status}
                        </div>
                      </div>
                      {mode === 'edit' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingRegionId(selectedRegion.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-ink hover:bg-parchment transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Delete this region and its linked references?')) {
                                return;
                              }
                              await removeRegion(selectedRegion.id);
                            }}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-ink">
                      {selectedRegion.summary || 'Add a simple summary so this section is easy to explain in a meeting.'}
                    </div>

                    <div className="text-xs text-ink-light space-y-1">
                      {selectedRegion.acreage && <div>Acreage: {selectedRegion.acreage}</div>}
                      {selectedRegionDeskMapLabel && (
                        <div>Desk Map: {selectedRegionDeskMapLabel}</div>
                      )}
                      {selectedRegionNodeLabel && <div>Node: {selectedRegionNodeLabel}</div>}
                      {selectedRegionOwnerLabel && (
                        <div>Owner: {selectedRegionOwnerLabel}</div>
                      )}
                      {selectedRegionLeaseLabel && (
                        <div>Lease: {selectedRegionLeaseLabel}</div>
                      )}
                      {selectedRegionResearchSourceLabel && (
                        <div>Research Source: {selectedRegionResearchSourceLabel}</div>
                      )}
                      {selectedRegionResearchProjectLabel && (
                        <div>Project Record: {selectedRegionResearchProjectLabel}</div>
                      )}
                    </div>

                    {selectedRegion.notes && (
                      <div className="text-xs text-ink whitespace-pre-wrap border-t border-ledger-line pt-2">
                        {selectedRegion.notes}
                      </div>
                    )}
                  </section>
                )}

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-ink">
                      {selectedRegion ? 'Region References' : 'Map References'}
                    </div>
                    {mode === 'edit' && selectedAsset && (
                      <button
                        type="button"
                        onClick={() =>
                          workspaceId &&
                          setDraftReference(
                            createBlankMapExternalReference(workspaceId, {
                              assetId: selectedAsset.id,
                              regionId: selectedRegion?.id ?? null,
                            })
                          )
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
                      >
                        + Reference
                      </button>
                    )}
                  </div>

                  {(selectedRegion ? regionReferences : assetReferences).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-ledger-line bg-parchment-dark/30 p-3 text-sm text-ink-light">
                      Save deep links here for RRC lookups, downloads, or other outside reference pages.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(selectedRegion ? regionReferences : assetReferences).map((reference) => (
                        (() => {
                          const safeUrl = normalizeMapReferenceUrl(reference.url);

                          return (
                            <div
                              key={reference.id}
                              className="rounded-xl border border-ledger-line bg-parchment-dark/30 p-3 space-y-2"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-ink">
                                    {reference.label || 'Untitled reference'}
                                  </div>
                                  <div className="text-[11px] text-ink-light">
                                    {reference.source}
                                  </div>
                                </div>
                                {mode === 'edit' && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingReferenceId(reference.id)}
                                      className="px-2 py-1 rounded text-xs font-semibold text-ink hover:bg-ledger transition-colors"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!confirm('Delete this reference link?')) {
                                          return;
                                        }
                                        await removeReference(reference.id);
                                      }}
                                      className="px-2 py-1 rounded text-xs font-semibold text-seal hover:bg-seal/10 transition-colors"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                              {safeUrl ? (
                                <a
                                  href={safeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs text-leather break-all hover:underline"
                                >
                                  {safeUrl}
                                </a>
                              ) : reference.url ? (
                                <div className="text-xs font-medium text-seal break-all">
                                  Blocked unsupported link: {reference.url}
                                </div>
                              ) : null}
                              {reference.notes && (
                                <div className="text-xs text-ink whitespace-pre-wrap">
                                  {reference.notes}
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ))}
                    </div>
                  )}

                  {selectedRegion && assetReferences.length > 0 && (
                    <div className="rounded-xl border border-ledger-line bg-parchment-dark/20 p-3 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-ink-light">
                        Map-level references
                      </div>
                      {assetReferences.map((reference) => (
                        <div key={reference.id} className="text-xs text-ink">
                          <span className="font-semibold">{reference.label || 'Untitled reference'}</span>
                          <span className="text-ink-light"> • {reference.source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
      ) : null}

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
          key={editingAsset.id}
          asset={editingAsset}
          deskMaps={deskMaps}
          nodes={nodes}
          owners={owners}
          leases={leases}
          researchSources={researchSources}
          researchProjectRecords={researchProjectRecords}
          onClose={() => setEditingAssetId(null)}
          onPreview={() => setPreviewAssetId(editingAsset.id)}
          onSave={(fields) => updateAsset(editingAsset.id, fields)}
        />
      )}

      {editingRegion && (
        <MapRegionModal
          key={editingRegion.id}
          region={editingRegion}
          deskMaps={deskMaps}
          nodes={nodes}
          owners={owners}
          leases={leases}
          researchSources={researchSources}
          researchProjectRecords={researchProjectRecords}
          onClose={() => {
            setEditingRegionId(null);
            setDraftRegion(null);
          }}
          onSave={async (fields) => {
            if (draftRegion) {
              await addRegion({ ...draftRegion, ...fields });
              setSelectedRegionId(draftRegion.id);
            } else if (editingRegionId) {
              await updateRegion(editingRegionId, fields);
            }
            setEditingRegionId(null);
            setDraftRegion(null);
          }}
        />
      )}

      {editingReference && (
        <MapReferenceModal
          key={editingReference.id}
          reference={editingReference}
          onClose={() => {
            setEditingReferenceId(null);
            setDraftReference(null);
          }}
          onSave={async (fields) => {
            if (draftReference) {
              await addReference({ ...draftReference, ...fields });
            } else if (editingReferenceId) {
              await updateReference(editingReferenceId, fields);
            }
            setEditingReferenceId(null);
            setDraftReference(null);
          }}
        />
      )}
    </div>
  );
}
