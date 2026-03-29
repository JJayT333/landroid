import { useState } from 'react';
import Modal from '../shared/Modal';
import FormField from '../shared/FormField';
import type { DeskMap, OwnershipNode } from '../../types/node';
import type { Lease, Owner } from '../../types/owner';
import type { MapRegion, MapRegionStatus } from '../../types/map';
import { MAP_REGION_STATUS_OPTIONS, clampPercent } from '../../types/map';

interface MapRegionModalProps {
  region: MapRegion;
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
  owners: Owner[];
  leases: Lease[];
  onClose: () => void;
  onSave: (fields: Partial<MapRegion>) => Promise<void>;
}

export default function MapRegionModal({
  region,
  deskMaps,
  nodes,
  owners,
  leases,
  onClose,
  onSave,
}: MapRegionModalProps) {
  const [form, setForm] = useState({
    title: region.title,
    shortLabel: region.shortLabel,
    status: region.status,
    summary: region.summary,
    notes: region.notes,
    acreage: region.acreage,
    color: region.color,
    deskMapId: region.deskMapId ?? '',
    nodeId: region.nodeId ?? '',
    linkedOwnerId: region.linkedOwnerId ?? '',
    leaseId: region.leaseId ?? '',
    x: region.rect.x.toString(),
    y: region.rect.y.toString(),
    width: region.rect.width.toString(),
    height: region.rect.height.toString(),
  });
  const [saving, setSaving] = useState(false);

  const set = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  return (
    <Modal open onClose={onClose} title="Map Region" wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Region Title" value={form.title} onChange={(value) => set('title', value)} />
          <FormField
            label="Short Label"
            value={form.shortLabel}
            onChange={(value) => set('shortLabel', value)}
          />

          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(event) => set('status', event.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none"
            >
              {MAP_REGION_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <FormField label="Acreage" value={form.acreage} onChange={(value) => set('acreage', value)} />
        </div>

        <div className="grid grid-cols-4 gap-3">
          <FormField label="Left" value={form.x} onChange={(value) => set('x', value)} />
          <FormField label="Top" value={form.y} onChange={(value) => set('y', value)} />
          <FormField
            label="Width"
            value={form.width}
            onChange={(value) => set('width', value)}
          />
          <FormField
            label="Height"
            value={form.height}
            onChange={(value) => set('height', value)}
          />
        </div>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.color}
              onChange={(event) => set('color', event.target.value)}
              className="h-10 w-16 rounded border border-ledger-line bg-parchment"
            />
            <span className="text-sm text-ink-light">
              Used for the presentation overlay.
            </span>
          </div>
        </div>

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
        </div>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Summary
          </label>
          <textarea
            value={form.summary}
            onChange={(event) => set('summary', event.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
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

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
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
                shortLabel: form.shortLabel,
                status: form.status as MapRegionStatus,
                acreage: form.acreage,
                summary: form.summary,
                notes: form.notes,
                color: form.color,
                deskMapId: form.deskMapId || null,
                nodeId: form.nodeId || null,
                linkedOwnerId: form.linkedOwnerId || null,
                leaseId: form.leaseId || null,
                rect: {
                  x: clampPercent(Number(form.x)),
                  y: clampPercent(Number(form.y)),
                  width: clampPercent(Number(form.width)),
                  height: clampPercent(Number(form.height)),
                  page: region.rect.page,
                },
              });
              setSaving(false);
              onClose();
            }}
            className="px-4 py-2 rounded-lg bg-leather text-parchment text-sm font-semibold hover:bg-leather-light transition-colors disabled:opacity-60"
          >
            Save Region
          </button>
        </div>
      </div>
    </Modal>
  );
}
