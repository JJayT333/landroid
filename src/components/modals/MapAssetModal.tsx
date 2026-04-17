import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import type { DeskMap, OwnershipNode } from '../../types/node';
import type { Lease, Owner } from '../../types/owner';
import type { MapAsset, MapAssetKind } from '../../types/map';
import { MAP_ASSET_KIND_OPTIONS } from '../../types/map';
import type { ResearchProjectRecord, ResearchSource } from '../../types/research';

interface MapAssetModalProps {
  asset: MapAsset;
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
  owners: Owner[];
  leases: Lease[];
  researchSources: ResearchSource[];
  researchProjectRecords: ResearchProjectRecord[];
  onClose: () => void;
  onPreview: () => void;
  onSave: (fields: Partial<MapAsset>) => Promise<void>;
}

export default function MapAssetModal({
  asset,
  deskMaps,
  nodes,
  owners,
  leases,
  researchSources,
  researchProjectRecords,
  onClose,
  onPreview,
  onSave,
}: MapAssetModalProps) {
  const [form, setForm] = useState({
    title: asset.title,
    kind: asset.kind,
    notes: asset.notes,
    presentationSummary: asset.presentationSummary,
    isFeatured: asset.isFeatured,
    deskMapId: asset.deskMapId ?? '',
    nodeId: asset.nodeId ?? '',
    linkedOwnerId: asset.linkedOwnerId ?? '',
    leaseId: asset.leaseId ?? '',
    researchSourceId: asset.researchSourceId ?? '',
    researchProjectRecordId: asset.researchProjectRecordId ?? '',
    county: asset.county,
    prospect: asset.prospect,
    effectiveDate: asset.effectiveDate,
    source: asset.source,
  });
  const [saving, setSaving] = useState(false);

  const set = (
    field: keyof typeof form,
    value: string | MapAssetKind
  ) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <Modal open onClose={onClose} title="Map Asset Details" wide>
      <div className="space-y-4">
        <div className="rounded-lg border border-ledger-line bg-ledger px-3 py-2">
          <div className="text-xs font-semibold text-ink">{asset.fileName}</div>
          <div className="text-[11px] text-ink-light">{asset.mimeType || 'Unknown type'}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Title" value={form.title} onChange={(value) => set('title', value)} />

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Kind
            </label>
            <select
              value={form.kind}
              onChange={(event) => set('kind', event.target.value as MapAssetKind)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              {MAP_ASSET_KIND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <FormField label="County" value={form.county} onChange={(value) => set('county', value)} />
          <FormField
            label="Prospect"
            value={form.prospect}
            onChange={(value) => set('prospect', value)}
          />
          <FormField
            label="Effective Date"
            type="date"
            value={form.effectiveDate}
            onChange={(value) => set('effectiveDate', value)}
          />
          <FormField label="Source" value={form.source} onChange={(value) => set('source', value)} />
        </div>

        <label className="flex items-center gap-2 rounded-lg border border-ledger-line bg-ledger px-3 py-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isFeatured: event.target.checked,
              }))
            }
            className="h-4 w-4 rounded border-ledger-line text-leather focus:ring-leather"
          />
          Open this as the featured map when the Maps page loads
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Desk Map
            </label>
            <select
              value={form.deskMapId}
              onChange={(event) => set('deskMapId', event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              <option value="">Not linked</option>
              {deskMaps.map((deskMap) => (
                <option key={deskMap.id} value={deskMap.id}>
                  {deskMap.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Node
            </label>
            <select
              value={form.nodeId}
              onChange={(event) => set('nodeId', event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              <option value="">Not linked</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.grantee || node.docNo || node.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Owner
            </label>
            <select
              value={form.linkedOwnerId}
              onChange={(event) => set('linkedOwnerId', event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              <option value="">Not linked</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name || owner.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Lease
            </label>
            <select
              value={form.leaseId}
              onChange={(event) => set('leaseId', event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              <option value="">Not linked</option>
              {leases.map((lease) => (
                <option key={lease.id} value={lease.id}>
                  {lease.leaseName || lease.lessee || lease.docNo || lease.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Research Source
            </label>
            <select
              value={form.researchSourceId}
              onChange={(event) => set('researchSourceId', event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              <option value="">Not linked</option>
              {researchSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title || source.citation || source.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Project Record
            </label>
            <select
              value={form.researchProjectRecordId}
              onChange={(event) => set('researchProjectRecordId', event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              <option value="">Not linked</option>
              {researchProjectRecords.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.name || record.serialOrReference || record.id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Presentation Summary
          </label>
          <textarea
            value={form.presentationSummary}
            onChange={(event) => set('presentationSummary', event.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            placeholder="Plain-English context for presentations or quick handoffs"
          />
        </div>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-ledger-line">
          <button
            type="button"
            onClick={onPreview}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-leather hover:bg-leather/10 border border-leather/30 transition-colors"
          >
            Preview
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSave({
                  title: form.title,
                  kind: form.kind,
                  notes: form.notes,
                  presentationSummary: form.presentationSummary,
                  isFeatured: form.isFeatured,
                  deskMapId: form.deskMapId || null,
                  nodeId: form.nodeId || null,
                  linkedOwnerId: form.linkedOwnerId || null,
                  leaseId: form.leaseId || null,
                  researchSourceId: form.researchSourceId || null,
                  researchProjectRecordId: form.researchProjectRecordId || null,
                  county: form.county,
                  prospect: form.prospect,
                  effectiveDate: form.effectiveDate,
                  source: form.source,
                });
                setSaving(false);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
