import { useMemo, useState } from 'react';
import { buildLeaseNode, isLeaseNode } from '../deskmap/deskmap-lease-node';
import { pickPrimaryLease } from '../deskmap/deskmap-coverage';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { OwnershipNode } from '../../types/node';
import {
  createBlankLease,
  createBlankOwner,
  normalizeLease,
  type Lease,
} from '../../types/owner';
import { normalizeInterestString } from '../../utils/interest-string';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';

interface AttachLeaseModalProps {
  parentNode: OwnershipNode;
  onClose: () => void;
  onSaved?: (nodeId: string) => void;
}

function deriveCounty(landDesc: string): string {
  const match = landDesc.match(/([A-Za-z .'-]+?)\s+County\b/i);
  return match?.[1]?.trim() ?? '';
}

function createLeaseDraft(workspaceId: string, ownerId: string, parentNode: OwnershipNode) {
  return createBlankLease(workspaceId, ownerId || 'owner-pending', {
    leaseName: parentNode.grantee ? `${parentNode.grantee} Lease` : '',
    royaltyRate: '1/4',
    leasedInterest: parentNode.fraction,
    status: 'Active',
  });
}

export default function AttachLeaseModal({
  parentNode,
  onClose,
  onSaved,
}: AttachLeaseModalProps) {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const activeDeskMaps = useWorkspaceStore((state) => state.deskMaps);
  const activeDeskMapId = useWorkspaceStore((state) => state.activeDeskMapId);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const addNode = useWorkspaceStore((state) => state.addNode);
  const addNodeToActiveDeskMap = useWorkspaceStore(
    (state) => state.addNodeToActiveDeskMap
  );
  const updateNode = useWorkspaceStore((state) => state.updateNode);

  const ownerWorkspaceId = useOwnerStore((state) => state.workspaceId);
  const leases = useOwnerStore((state) => state.leases);
  const addLease = useOwnerStore((state) => state.addLease);
  const updateLease = useOwnerStore((state) => state.updateLease);
  const addOwner = useOwnerStore((state) => state.addOwner);

  const activeDeskMap = useMemo(
    () => activeDeskMaps.find((deskMap) => deskMap.id === activeDeskMapId) ?? null,
    [activeDeskMapId, activeDeskMaps]
  );
  const existingLeaseNode = useMemo(
    () =>
      nodes.find(
        (node) => node.parentId === parentNode.id && isLeaseNode(node)
      ) ?? null,
    [nodes, parentNode.id]
  );
  const existingLease = useMemo(() => {
    if (existingLeaseNode?.linkedLeaseId) {
      return leases.find((lease) => lease.id === existingLeaseNode.linkedLeaseId) ?? null;
    }

    if (!parentNode.linkedOwnerId) {
      return null;
    }

    return pickPrimaryLease(
      leases.filter((lease) => lease.ownerId === parentNode.linkedOwnerId)
    );
  }, [existingLeaseNode?.linkedLeaseId, leases, parentNode.linkedOwnerId]);
  const [draft, setDraft] = useState<Lease>(() =>
    existingLease
      ? normalizeLease(existingLease, {
          workspaceId: ownerWorkspaceId ?? workspaceId,
          ownerId: parentNode.linkedOwnerId ?? '',
        })
      : createLeaseDraft(
          ownerWorkspaceId ?? workspaceId,
          parentNode.linkedOwnerId ?? '',
          parentNode
        )
  );
  const [saving, setSaving] = useState(false);
  const isEditingExistingLease = Boolean(existingLeaseNode || existingLease);

  const set = (field: keyof Lease, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const resolvedWorkspaceId = ownerWorkspaceId ?? workspaceId;
      let ownerId = parentNode.linkedOwnerId;

      if (!ownerId) {
        const nextOwner = createBlankOwner(resolvedWorkspaceId, {
          name: parentNode.grantee || 'New Owner',
          county: deriveCounty(parentNode.landDesc),
          prospect: activeDeskMap?.name ?? '',
          notes: [
            parentNode.instrument ? `Source Instrument: ${parentNode.instrument}` : '',
            parentNode.docNo ? `Doc #: ${parentNode.docNo}` : '',
            parentNode.landDesc ? `Land: ${parentNode.landDesc}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        });

        await addOwner(nextOwner);
        updateNode(parentNode.id, { linkedOwnerId: nextOwner.id });
        ownerId = nextOwner.id;
      }

      const leaseRecord = existingLease
        ? {
            ...existingLease,
            ...draft,
            royaltyRate: draft.royaltyRate.trim(),
            leasedInterest: normalizeInterestString(draft.leasedInterest),
            ownerId,
            workspaceId: resolvedWorkspaceId,
          }
        : createBlankLease(resolvedWorkspaceId, ownerId, {
            ...draft,
            royaltyRate: draft.royaltyRate.trim(),
            leasedInterest: normalizeInterestString(draft.leasedInterest),
            ownerId,
          });

      if (existingLease) {
        await updateLease(existingLease.id, leaseRecord);
      } else {
        await addLease(leaseRecord);
      }

      const leaseNodeId =
        existingLeaseNode?.id ??
        `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const leaseNode = buildLeaseNode({
        id: leaseNodeId,
        parentNode: {
          ...parentNode,
          linkedOwnerId: ownerId,
        },
        lease: leaseRecord,
        existingNode: existingLeaseNode,
      });

      if (existingLeaseNode) {
        updateNode(existingLeaseNode.id, leaseNode);
      } else {
        addNode(leaseNode);
        addNodeToActiveDeskMap(leaseNode.id);
      }

      onSaved?.(leaseNode.id);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditingExistingLease ? 'Edit Lessee Node' : 'Create Lessee Node'}
    >
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
          This creates or updates the terminal lessee node under the present owner without changing mineral ownership.
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Lease Info
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Lease Name"
              value={draft.leaseName}
              onChange={(value) => set('leaseName', value)}
            />
            <FormField
              label="Lessee"
              value={draft.lessee}
              onChange={(value) => set('lessee', value)}
            />
            <FormField
              label="Royalty"
              value={draft.royaltyRate}
              onChange={(value) => set('royaltyRate', value)}
            />
            <FormField
              label="Leased Interest"
              value={draft.leasedInterest}
              onChange={(value) => set('leasedInterest', value)}
            />
            <FormField
              label="Effective Date"
              type="date"
              value={draft.effectiveDate}
              onChange={(value) => set('effectiveDate', value)}
            />
            <FormField
              label="Expiration Date"
              type="date"
              value={draft.expirationDate}
              onChange={(value) => set('expirationDate', value)}
            />
            <FormField
              label="Status"
              value={draft.status}
              onChange={(value) => set('status', value)}
            />
            <FormField
              label="Doc #"
              value={draft.docNo}
              onChange={(value) => set('docNo', value)}
            />
          </div>
        </fieldset>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Notes
          </label>
          <textarea
            value={draft.notes}
            onChange={(event) => set('notes', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-ledger-line">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-ink-light hover:bg-parchment-dark transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-700 text-white hover:bg-emerald-600 transition-colors disabled:opacity-60"
          >
            {saving
              ? 'Saving...'
              : isEditingExistingLease
                ? 'Save Lessee Node'
                : 'Create Lessee Node'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
