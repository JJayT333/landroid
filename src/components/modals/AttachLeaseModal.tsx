import { useMemo, useState } from 'react';
import { buildLeaseNode, isLeaseNode } from '../deskmap/deskmap-lease-node';
import {
  buildLeaseScopeIndex,
  getLeasesForOwnerNode,
  pickPrimaryLease,
} from '../deskmap/deskmap-coverage';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { OwnershipNode } from '../../types/node';
import {
  DEFAULT_LEASE_STATUS,
  LEASE_STATUS_OPTIONS,
  createBlankLease,
  createBlankOwner,
  isLeaseStatusOption,
  normalizeLease,
  type Lease,
} from '../../types/owner';
import { deriveCounty } from '../../utils/land';
import { parseStrictInterestString } from '../../utils/interest-string';
import { serialize } from '../../engine/decimal';
import FormField from '../shared/FormField';
import Modal from '../shared/Modal';
import {
  buildOwnerLinkOptions,
  resolveExistingOwnerSelection,
} from '../owners/owner-link-options';

interface AttachLeaseModalProps {
  parentNode: OwnershipNode;
  preferredLeaseId?: string | null;
  onClose: () => void;
  onSaved?: (nodeId: string) => void;
}

function createLeaseDraft(workspaceId: string, ownerId: string, parentNode: OwnershipNode) {
  return createBlankLease(workspaceId, ownerId || 'owner-pending', {
    leaseName: parentNode.grantee ? `${parentNode.grantee} Lease` : '',
    royaltyRate: '',
    leasedInterest: parentNode.fraction,
    status: DEFAULT_LEASE_STATUS,
  });
}

export default function AttachLeaseModal({
  parentNode,
  preferredLeaseId = null,
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
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const addLease = useOwnerStore((state) => state.addLease);
  const updateLease = useOwnerStore((state) => state.updateLease);
  const addOwner = useOwnerStore((state) => state.addOwner);

  const activeDeskMap = useMemo(
    () => activeDeskMaps.find((deskMap) => deskMap.id === activeDeskMapId) ?? null,
    [activeDeskMapId, activeDeskMaps]
  );
  const ownerLinkOptions = useMemo(
    () => buildOwnerLinkOptions(owners),
    [owners]
  );
  const leaseScopeIndex = useMemo(() => buildLeaseScopeIndex(nodes), [nodes]);
  const leaseNodesForParent = useMemo(
    () => nodes.filter((node) => node.parentId === parentNode.id && isLeaseNode(node)),
    [nodes, parentNode.id]
  );
  const existingLeaseNode = useMemo(
    () => {
      if (preferredLeaseId) {
        return leaseNodesForParent.find((node) => node.linkedLeaseId === preferredLeaseId)
          ?? null;
      }

      return leaseNodesForParent[0] ?? null;
    },
    [leaseNodesForParent, preferredLeaseId]
  );
  const existingLease = useMemo(() => {
    if (preferredLeaseId) {
      const preferredLease = leases.find((lease) => lease.id === preferredLeaseId) ?? null;
      if (preferredLease) {
        return preferredLease;
      }
    }

    if (existingLeaseNode?.linkedLeaseId) {
      return leases.find((lease) => lease.id === existingLeaseNode.linkedLeaseId) ?? null;
    }

    if (!parentNode.linkedOwnerId) {
      return null;
    }

    return pickPrimaryLease(
      getLeasesForOwnerNode(
        leases.filter((lease) => lease.ownerId === parentNode.linkedOwnerId),
        parentNode,
        leaseScopeIndex
      )
    );
  }, [
    existingLeaseNode?.linkedLeaseId,
    leaseScopeIndex,
    leases,
    parentNode,
    parentNode.linkedOwnerId,
    preferredLeaseId,
  ]);
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const isEditingExistingLease = Boolean(existingLeaseNode || existingLease);
  const statusOptions = isLeaseStatusOption(draft.status)
    ? [...LEASE_STATUS_OPTIONS]
    : [draft.status, ...LEASE_STATUS_OPTIONS];

  const set = (field: keyof Lease, value: string) => {
    setSaveError(null);
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    // Strict-parse both interest fields BEFORE any persistence. A blank value is a
    // legal "not entered yet" state and parses as Decimal(0); malformed input ("abc",
    // "1/0", multi-slash garbage) returns null and blocks the save with an inline
    // error. Closes audit finding #4.
    const parsedRoyalty = parseStrictInterestString(draft.royaltyRate);
    if (parsedRoyalty === null) {
      setSaveError(
        'Royalty must be a fraction (e.g. 1/8), a decimal (e.g. 0.125), or blank.'
      );
      return;
    }
    const parsedLeasedInterest = parseStrictInterestString(draft.leasedInterest);
    if (parsedLeasedInterest === null) {
      setSaveError(
        'Leased Interest must be a fraction (e.g. 1/2), a decimal (e.g. 0.5), or blank.'
      );
      return;
    }
    setSaveError(null);
    setSaving(true);

    try {
      const resolvedWorkspaceId = ownerWorkspaceId ?? workspaceId;
      const selectedExistingOwnerId = resolveExistingOwnerSelection(
        ownerLinkOptions,
        selectedOwnerId
      );
      let ownerId = parentNode.linkedOwnerId ?? selectedExistingOwnerId;

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
      } else if (!parentNode.linkedOwnerId) {
        updateNode(parentNode.id, { linkedOwnerId: ownerId });
      }

      // Preserve the user's raw royalty text (1/8 stays 1/8, not 0.125). Leased
      // Interest normalizes to a serialized decimal when entered, or stays blank.
      const trimmedLeasedInterest = draft.leasedInterest.trim();
      const normalizedLeasedInterest = trimmedLeasedInterest.length === 0
        ? ''
        : serialize(parsedLeasedInterest);

      const leaseRecord = existingLease
        ? {
            ...existingLease,
            ...draft,
            royaltyRate: draft.royaltyRate.trim(),
            leasedInterest: normalizedLeasedInterest,
            ownerId,
            workspaceId: resolvedWorkspaceId,
          }
        : createBlankLease(resolvedWorkspaceId, ownerId, {
            ...draft,
            royaltyRate: draft.royaltyRate.trim(),
            leasedInterest: normalizedLeasedInterest,
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

        {!parentNode.linkedOwnerId && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
              Owner Record
            </legend>
            <div className="text-xs leading-5 text-ink-light">
              Choose an existing owner when this branch is the same party already used on
              another tract. Leave blank to create a new owner from this title card when saving.
            </div>
            <select
              value={selectedOwnerId}
              onChange={(event) => {
                setSaveError(null);
                setSelectedOwnerId(event.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
            >
              <option value="">Create owner from this title card</option>
              {ownerLinkOptions.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.detail ? `${owner.label} — ${owner.detail}` : owner.label}
                </option>
              ))}
            </select>
          </fieldset>
        )}

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
            <div>
              <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                Status
              </label>
              <select
                value={draft.status}
                onChange={(event) => set('status', event.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {isLeaseStatusOption(status) ? status : `${status} (legacy)`}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              label="Doc #"
              value={draft.docNo}
              onChange={(value) => set('docNo', value)}
            />
          </div>
          <div className="text-[11px] leading-5 text-ink-light">
            Royalty starts blank so a placeholder rate is not mistaken for lease evidence.
            Blank economics stay as not entered in payout review.
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

        {saveError && (
          <div className="rounded-lg border border-seal/30 bg-seal/10 px-3 py-2 text-xs text-seal">
            {saveError}
          </div>
        )}

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
