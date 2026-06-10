import { useMemo, useRef, useState, type ReactNode } from 'react';
import { buildLeaseNode, isLeaseNode } from '../deskmap/deskmap-lease-node';
import {
  buildLeaseScopeIndex,
  getLeasesForOwnerNode,
  pickPrimaryLease,
} from '../deskmap/deskmap-coverage';
import {
  planTractReconcile,
  seedTractDrafts,
  type TractDraft,
} from '../leasehold/lease-tract-rows';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import type { OwnershipNode } from '../../types/node';
import {
  LEASE_STATUS_OPTIONS,
  computeNetAcres,
  createBlankLease,
  createBlankOwner,
  isLeaseStatusOption,
  isTexasMathLease,
  normalizeLease,
  type Lease,
} from '../../types/owner';
import {
  DEFAULT_LEASE_FORM,
  LEASE_ATTACHMENT_DEFINITIONS,
  LEASE_PROVISION_DEFINITIONS,
  LEASE_TYPE_OPTIONS,
  computeLeaseEconomicsTotals,
  createBlankLeasePurchaseReport,
  getProvision,
  hasAttachment,
  normalizeLeasePurchaseReport,
  setProvision,
  toggleAttachment,
  type LeaseAttachmentKey,
  type LeaseProvisionKey,
  type LeasePurchaseReport,
} from '../../types/lease-purchase-report';
import { deriveCounty } from '../../utils/land';
import { parseStrictInterestString } from '../../utils/interest-string';
import { serialize } from '../../engine/decimal';
import { assertFileSize, FILE_SIZE_LIMITS } from '../../utils/file-validation';
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

const NON_TEXAS_LEASE_ATTACHMENT_MESSAGE =
  'Only Texas fee/state leases can attach to Desk Map math. Keep federal/private/tribal leases in Research or Federal Leasing as reference records.';

export function getAttachLeaseModalTexasMathError(
  lease: Pick<Lease, 'jurisdiction'>
): string | null {
  return isTexasMathLease(lease) ? null : NON_TEXAS_LEASE_ATTACHMENT_MESSAGE;
}

/** Store actions the tract reconcile needs; injected so it is unit-testable. */
interface TractReconcileActions {
  addLease: (lease: Lease) => Promise<void>;
  updateLease: (id: string, fields: Partial<Lease>) => Promise<void>;
  removeLease: (id: string) => Promise<void>;
  addNode: (node: OwnershipNode) => void;
  updateNode: (id: string, fields: Partial<OwnershipNode>) => void;
  removeNode: (id: string) => void;
  addNodeToDeskMap: (nodeId: string, deskMapId: string) => void;
}

/**
 * Reconcile the desired (checked) tracts against the existing slices/nodes for
 * this LPR: create new, update kept, delete unchecked. Each lessee node lands
 * on its own tract's desk map. Returns the originating tract's lessee node id
 * (PDF attachment / onSaved focus target), or null when the originating tract
 * was not materialized. Exported for tests; the save handler is the only
 * runtime caller.
 */
export async function reconcileLeaseTractNodes({
  tractDrafts,
  parentNode,
  ownerId,
  resolvedWorkspaceId,
  nodes,
  leases,
  leaseOverrides,
  normalizedInterestByNode,
  actions,
}: {
  tractDrafts: readonly TractDraft[];
  parentNode: OwnershipNode;
  ownerId: string;
  resolvedWorkspaceId: string;
  nodes: OwnershipNode[];
  leases: Lease[];
  leaseOverrides: Partial<Lease>;
  normalizedInterestByNode: ReadonlyMap<string, string>;
  actions: TractReconcileActions;
}): Promise<string | null> {
  const {
    addLease,
    updateLease,
    removeLease,
    addNode,
    updateNode,
    removeNode,
    addNodeToDeskMap,
  } = actions;
  const plan = planTractReconcile(tractDrafts);
  let originatingNodeId: string | null = null;
  for (const tract of [...plan.create, ...plan.update, ...plan.remove]) {
    const isOriginating = tract.mineralNodeId === parentNode.id;
    const buildParentNode = isOriginating
      ? { ...parentNode, linkedOwnerId: ownerId }
      : nodes.find((node) => node.id === tract.mineralNodeId) ?? null;

    if (tract.checked) {
      if (!buildParentNode) continue;
      const perTractFields = {
        leaseName: tract.leaseName,
        grossAcres: tract.grossAcres,
        status: tract.status,
        docNo: tract.docNo,
        leasedInterest:
          normalizedInterestByNode.get(tract.mineralNodeId) ?? '',
      };

      if (tract.existingLeaseId) {
        const existing = leases.find(
          (lease) => lease.id === tract.existingLeaseId
        );
        const leaseRecord = {
          ...(existing ?? createBlankLease(resolvedWorkspaceId, ownerId)),
          ...perTractFields,
          ...leaseOverrides,
          id: tract.existingLeaseId,
          workspaceId: resolvedWorkspaceId,
        };
        await updateLease(tract.existingLeaseId, leaseRecord);
        if (tract.existingLeaseNodeId) {
          const existingNode =
            nodes.find((node) => node.id === tract.existingLeaseNodeId) ?? null;
          updateNode(
            tract.existingLeaseNodeId,
            buildLeaseNode({
              id: tract.existingLeaseNodeId,
              parentNode: buildParentNode,
              lease: leaseRecord,
              existingNode,
            })
          );
          if (isOriginating) originatingNodeId = tract.existingLeaseNodeId;
        } else {
          // Record created before node (e.g. via the Owners "Add Lease" form,
          // then "Create Tract N" here): the slice exists but no lessee node
          // does. Previously a silent no-op — create the missing node exactly
          // like the create branch below.
          const newNodeId = `node-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}-${tract.mineralNodeId.slice(-4)}`;
          addNode(
            buildLeaseNode({
              id: newNodeId,
              parentNode: buildParentNode,
              lease: leaseRecord,
            })
          );
          addNodeToDeskMap(newNodeId, tract.deskMapId);
          if (isOriginating) originatingNodeId = newNodeId;
        }
      } else {
        const leaseRecord = createBlankLease(resolvedWorkspaceId, ownerId, {
          ...perTractFields,
          ...leaseOverrides,
        });
        await addLease(leaseRecord);
        const newNodeId = `node-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}-${tract.mineralNodeId.slice(-4)}`;
        addNode(
          buildLeaseNode({
            id: newNodeId,
            parentNode: buildParentNode,
            lease: leaseRecord,
          })
        );
        addNodeToDeskMap(newNodeId, tract.deskMapId);
        if (isOriginating) originatingNodeId = newNodeId;
      }
    } else if (tract.existingLeaseId) {
      // Unchecked but previously leased: remove exactly this tract's slice
      // and lessee node. Remove the slice explicitly first so it is gone
      // synchronously; removeNode's owner cleanup would also cascade it.
      await removeLease(tract.existingLeaseId);
      if (tract.existingLeaseNodeId) {
        removeNode(tract.existingLeaseNodeId);
      }
    }
  }
  return originatingNodeId;
}

/**
 * Collapsed-by-default disclosure used for the long, optional abstract sections
 * (provisions, attachments, preparer). Keeps the lease editor compact; native
 * `<details>` so it needs no extra state.
 */
function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="rounded-lg border border-ledger-line bg-parchment/40">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-ink-light uppercase tracking-wider">
        {title}
      </summary>
      <div className="border-t border-ledger-line px-3 py-3 space-y-2">
        {children}
      </div>
    </details>
  );
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
  const addNodeToDeskMap = useWorkspaceStore(
    (state) => state.addNodeToDeskMap
  );
  const removeNode = useWorkspaceStore((state) => state.removeNode);
  const updateNode = useWorkspaceStore((state) => state.updateNode);
  const attachDocToNode = useWorkspaceStore((state) => state.attachDocToNode);
  const detachDocFromNode = useWorkspaceStore(
    (state) => state.detachDocFromNode
  );

  const ownerWorkspaceId = useOwnerStore((state) => state.workspaceId);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const leasePurchaseReports = useOwnerStore((state) => state.leasePurchaseReports);
  const addLease = useOwnerStore((state) => state.addLease);
  const updateLease = useOwnerStore((state) => state.updateLease);
  const removeLease = useOwnerStore((state) => state.removeLease);
  const addLeasePurchaseReport = useOwnerStore(
    (state) => state.addLeasePurchaseReport
  );
  const updateLeasePurchaseReport = useOwnerStore(
    (state) => state.updateLeasePurchaseReport
  );
  const removeLeasePurchaseReport = useOwnerStore(
    (state) => state.removeLeasePurchaseReport
  );
  const addOwner = useOwnerStore((state) => state.addOwner);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const activeDeskMap = useMemo(
    () => activeDeskMaps.find((deskMap) => deskMap.id === activeDeskMapId) ?? null,
    [activeDeskMapId, activeDeskMaps]
  );
  // Texas leasehold math only consumes leases that attach under mineral-class
  // owners. NPRI royalty streams (and any future non-mineral interest class)
  // must never be lessors here — the modal gates both opening and save on
  // `parentNode.interestClass === 'mineral'`. Owner options are also filtered
  // down to owners referenced by at least one mineral node so the user cannot
  // re-attach to an NPRI-only owner.
  const isParentMineral = parentNode.interestClass === 'mineral';
  const mineralOwnerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const node of nodes) {
      if (node.type === 'related' || node.interestClass !== 'mineral') continue;
      if (node.linkedOwnerId) ids.add(node.linkedOwnerId);
    }
    return ids;
  }, [nodes]);
  const ownerLinkOptions = useMemo(
    () => buildOwnerLinkOptions(
      isParentMineral
        ? owners.filter((owner) => mineralOwnerIds.has(owner.id))
        : owners
    ),
    [isParentMineral, mineralOwnerIds, owners]
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
  // The Lease Purchase Report carries the instrument-level abstract shared
  // across tracts (lessee, type, form, economics, term). The per-tract slice
  // above keeps lessor interest / acres / status. Seed a fresh LPR from the
  // lease draft so single-entry fields carry over for existing standalone leases.
  const existingLpr = useMemo<LeasePurchaseReport | null>(() => {
    const lprId = existingLease?.leasePurchaseReportId ?? null;
    if (!lprId) return null;
    return leasePurchaseReports.find((report) => report.id === lprId) ?? null;
  }, [existingLease?.leasePurchaseReportId, leasePurchaseReports]);

  const [lprDraft, setLprDraft] = useState<LeasePurchaseReport>(() => {
    const resolvedWorkspaceId = ownerWorkspaceId ?? workspaceId;
    const ownerId = parentNode.linkedOwnerId ?? '';
    if (existingLpr) {
      return normalizeLeasePurchaseReport(existingLpr, {
        workspaceId: resolvedWorkspaceId,
        ownerId,
      });
    }
    return createBlankLeasePurchaseReport(resolvedWorkspaceId, ownerId, {
      lesseeName: existingLease?.lessee ?? '',
      royalty: existingLease?.royaltyRate ?? '',
      effectiveDate: existingLease?.effectiveDate ?? '',
      expirationDate: existingLease?.expirationDate ?? '',
      primaryTerm: existingLease?.primaryTerm ?? '',
      heldByProduction: existingLease?.heldByProduction ?? false,
      comments: existingLease?.notes ?? '',
    });
  });

  // Per-tract rows: this lessor's present mineral-owner presence across the
  // unit's desk maps. Seeded once on open; the originating tract is always
  // present and pre-checked. When the parent node is not yet linked to an owner
  // only the originating tract shows — cross-tract rows appear on later edits.
  const [tractDrafts, setTractDrafts] = useState<TractDraft[]>(() =>
    seedTractDrafts({
      parentNode,
      ownerId: parentNode.linkedOwnerId ?? '',
      deskMaps: activeDeskMaps,
      nodes,
      leases,
      leasePurchaseReportId: existingLpr?.id ?? null,
      activeDeskMapId,
      originatingExistingLease: existingLease
        ? normalizeLease(existingLease, {
            workspaceId: ownerWorkspaceId ?? workspaceId,
            ownerId: parentNode.linkedOwnerId ?? '',
          })
        : null,
      originatingExistingNodeId: existingLeaseNode?.id ?? null,
    })
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedPdfFile, setSelectedPdfFile] = useState<File | null>(null);
  const isEditingExistingLease = Boolean(existingLeaseNode || existingLease);

  const setTract = (
    mineralNodeId: string,
    patch: Partial<Omit<TractDraft, 'mineralNodeId'>>
  ) => {
    setSaveError(null);
    setTractDrafts((current) =>
      current.map((tract) =>
        tract.mineralNodeId === mineralNodeId ? { ...tract, ...patch } : tract
      )
    );
  };

  const setLpr = (field: keyof LeasePurchaseReport, value: string) => {
    setSaveError(null);
    setLprDraft((current) => ({ ...current, [field]: value }));
  };

  const setLprFlag = (field: 'heldByProduction' | 'paidUp', value: boolean) => {
    setSaveError(null);
    setLprDraft((current) => ({ ...current, [field]: value }));
  };

  const setProvisionField = (
    key: LeaseProvisionKey,
    patch: { present?: boolean; paragraph?: string }
  ) => {
    setSaveError(null);
    setLprDraft((current) => ({
      ...current,
      provisions: setProvision(current.provisions, key, patch),
    }));
  };

  const toggleAttachmentKey = (key: LeaseAttachmentKey, on: boolean) => {
    setSaveError(null);
    setLprDraft((current) => ({
      ...current,
      attachments: toggleAttachment(current.attachments, key, on),
    }));
  };

  const checkedTracts = tractDrafts.filter((tract) => tract.checked);

  // Display-only economics: bonus/ac x sum(net acres across checked tracts),
  // delay rental when not paid up. Never persisted, never fed to
  // coverage/royalty/NRI math.
  const economicsTotals = computeLeaseEconomicsTotals(
    lprDraft,
    checkedTracts.map((tract) =>
      computeNetAcres(tract.grossAcres, tract.leasedInterest)
    )
  );

  const handleSave = async () => {
    if (!isParentMineral) {
      // Belt-and-suspenders: the modal body already renders a mineral-only
      // error state in this case, but guard the save path directly so a stale
      // prop can never write a lease under a non-mineral parent.
      setSaveError(
        'Leases can only be attached to mineral owners. Open this from a mineral-class card.'
      );
      return;
    }
    // Strict-parse the royalty BEFORE any persistence. A blank value is a legal
    // "not entered yet" state and parses as Decimal(0); malformed input ("abc",
    // "1/0", multi-slash garbage) returns null and blocks the save with an
    // inline error. Closes audit finding #4.
    const parsedRoyalty = parseStrictInterestString(lprDraft.royalty);
    if (parsedRoyalty === null) {
      setSaveError(
        'Royalty must be a fraction (e.g. 1/8), a decimal (e.g. 0.125), or blank.'
      );
      return;
    }

    const checked = tractDrafts.filter((tract) => tract.checked);
    if (checked.length === 0 && !existingLpr && !existingLease) {
      setSaveError('Select at least one tract to lease.');
      return;
    }

    // Validate every checked tract before touching persistence: strict-parse the
    // per-tract lessor interest, and keep the Texas-math gate (an existing slice
    // could carry a non-Texas jurisdiction that must not re-enter Desk Map math).
    const normalizedInterestByNode = new Map<string, string>();
    for (const tract of checked) {
      const parsed = parseStrictInterestString(tract.leasedInterest);
      if (parsed === null) {
        setSaveError(
          `Lessor interest for ${tract.deskMapName} must be a fraction (e.g. 1/2), a decimal, or blank.`
        );
        return;
      }
      normalizedInterestByNode.set(
        tract.mineralNodeId,
        tract.leasedInterest.trim().length === 0 ? '' : serialize(parsed)
      );
      const existing = tract.existingLeaseId
        ? leases.find((lease) => lease.id === tract.existingLeaseId) ?? null
        : null;
      if (existing) {
        const jurisdictionError = getAttachLeaseModalTexasMathError(existing);
        if (jurisdictionError) {
          setSaveError(jurisdictionError);
          return;
        }
      }
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

      const hasChecked = checked.length > 0;

      // The LPR is the instrument-level abstract shared across tracts. Build it
      // first so each slice can reference its id; derive the math-relevant slice
      // scalars (royalty, lessee, dates) from it so the existing coverage/summary
      // pipeline reads a single source of truth.
      const lprRecord = existingLpr
        ? normalizeLeasePurchaseReport(
            { ...existingLpr, ...lprDraft, ownerId, workspaceId: resolvedWorkspaceId },
            { workspaceId: resolvedWorkspaceId, ownerId }
          )
        : createBlankLeasePurchaseReport(resolvedWorkspaceId, ownerId, {
            ...lprDraft,
            ownerId,
          });

      // Preserve the user's raw royalty text (1/8 stays 1/8, not 0.125).
      const leaseOverrides = {
        lessee: lprDraft.lesseeName,
        royaltyRate: lprDraft.royalty.trim(),
        effectiveDate: lprDraft.effectiveDate,
        expirationDate: lprDraft.expirationDate,
        primaryTerm: lprDraft.primaryTerm,
        heldByProduction: lprDraft.heldByProduction,
        notes: lprDraft.comments,
        leasePurchaseReportId: lprRecord.id,
        ownerId,
      };

      if (hasChecked) {
        if (existingLpr) {
          await updateLeasePurchaseReport(existingLpr.id, lprRecord);
        } else {
          await addLeasePurchaseReport(lprRecord);
        }
      }

      // Reconcile the desired (checked) tracts against the existing slices/nodes
      // for this LPR: create new, update kept, delete unchecked. Each lessee node
      // lands on its own tract's desk map.
      const originatingNodeId = await reconcileLeaseTractNodes({
        tractDrafts,
        parentNode,
        ownerId,
        resolvedWorkspaceId,
        nodes,
        leases,
        leaseOverrides,
        normalizedInterestByNode,
        actions: {
          addLease,
          updateLease,
          removeLease,
          addNode,
          updateNode,
          removeNode,
          addNodeToDeskMap,
        },
      });

      // No tracts left under this LPR: drop the orphan parent record.
      if (!hasChecked && existingLpr) {
        await removeLeasePurchaseReport(existingLpr.id);
      }

      if (selectedPdfFile && originatingNodeId) {
        // Route the PDF through the workspace-store action so the document
        // tables and node.attachments[] cache stay in sync. Applies to the
        // originating tract's lessee node only.
        const existingAttachment = existingLeaseNode?.attachments[0];
        if (existingAttachment && existingLeaseNode) {
          await detachDocFromNode(
            existingLeaseNode.id,
            existingAttachment.attachmentId
          );
        }
        await attachDocToNode(originatingNodeId, selectedPdfFile, {
          kind: 'lease',
        });
      }

      if (originatingNodeId) onSaved?.(originatingNodeId);
      onClose();
    } catch (saveError) {
      setSaveError(
        saveError instanceof Error
          ? saveError.message
          : 'Lease save failed. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isParentMineral) {
    return (
      <Modal open onClose={onClose} title="Lease Attachment Blocked">
        <div className="space-y-4">
          <div className="rounded-lg border border-seal/30 bg-seal/10 p-3 text-sm text-seal">
            <p className="font-semibold mb-1">Leases can only be attached to mineral owners.</p>
            <p className="text-xs leading-5">
              This card carries the{' '}
              <span className="font-mono">{parentNode.interestClass}</span> interest
              class. NPRI royalty streams and any future non-mineral classes are not
              lessors — open the parent mineral-owner card to manage leasing for this
              branch.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-leather text-parchment hover:bg-leather/90 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        isEditingExistingLease
          ? 'Edit Lease Purchase Report'
          : 'New Lease Purchase Report'
      }
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
            Lessee &amp; Lease Form
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Lessee"
              value={lprDraft.lesseeName}
              onChange={(value) => setLpr('lesseeName', value)}
            />
            <div>
              <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                Lease Type
              </label>
              <select
                value={lprDraft.leaseType}
                onChange={(event) => setLpr('leaseType', event.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
              >
                {LEASE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <FormField
              label="Lease Form"
              value={lprDraft.leaseForm}
              onChange={(value) => setLpr('leaseForm', value)}
            />
          </div>
          <div className="text-[11px] leading-5 text-ink-light">
            Lease form defaults to {DEFAULT_LEASE_FORM}.
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Dates &amp; Term
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Lease Date"
              type="date"
              value={lprDraft.leaseDate}
              onChange={(value) => setLpr('leaseDate', value)}
            />
            <FormField
              label="Primary Term"
              value={lprDraft.primaryTerm}
              onChange={(value) => setLpr('primaryTerm', value)}
            />
            <FormField
              label="Effective Date"
              type="date"
              value={lprDraft.effectiveDate}
              onChange={(value) => setLpr('effectiveDate', value)}
            />
            <FormField
              label="Expiration Date"
              type="date"
              value={lprDraft.expirationDate}
              onChange={(value) => setLpr('expirationDate', value)}
            />
            <label className="flex items-center gap-2 text-xs text-ink mt-1">
              <input
                type="checkbox"
                checked={lprDraft.heldByProduction}
                onChange={(event) =>
                  setLprFlag('heldByProduction', event.target.checked)
                }
              />
              Held by production (HBP)
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Economics
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Royalty"
              value={lprDraft.royalty}
              onChange={(value) => setLpr('royalty', value)}
            />
            <div />
            <FormField
              label="Bonus / Ac"
              value={lprDraft.bonusPerAcre}
              onChange={(value) => setLpr('bonusPerAcre', value)}
            />
            <FormField
              label="Rental / Ac"
              value={lprDraft.rentalPerAcre}
              onChange={(value) => setLpr('rentalPerAcre', value)}
            />
            <label className="flex items-center gap-2 text-xs text-ink mt-1">
              <input
                type="checkbox"
                checked={lprDraft.paidUp}
                onChange={(event) => setLprFlag('paidUp', event.target.checked)}
              />
              Paid up (no delay rentals)
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                Total Bonus
              </label>
              <div className="px-3 py-2 rounded-lg border border-ledger-line bg-ledger text-sm text-ink-light">
                {economicsTotals.totalBonus || '—'}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                Delay Rental
              </label>
              <div className="px-3 py-2 rounded-lg border border-ledger-line bg-ledger text-sm text-ink-light">
                {lprDraft.paidUp ? 'Paid up' : economicsTotals.totalDelayRental || '—'}
              </div>
            </div>
          </div>
          <div className="text-[11px] leading-5 text-ink-light">
            Royalty starts blank so a placeholder rate is not mistaken for lease evidence.
            Blank economics stay as not entered in payout review. Totals are derived
            from net mineral acres for reference only and never change the math.
          </div>
        </fieldset>

        <CollapsibleSection title="Significant Provisions">
          <div className="grid grid-cols-1 gap-1.5">
            {LEASE_PROVISION_DEFINITIONS.map((definition) => {
              const provision = getProvision(lprDraft.provisions, definition.key);
              return (
                <div
                  key={definition.key}
                  className="flex items-center justify-between gap-2"
                >
                  <label className="flex items-center gap-2 text-xs text-ink min-w-0">
                    <input
                      type="checkbox"
                      checked={provision.present}
                      onChange={(event) =>
                        setProvisionField(definition.key, {
                          present: event.target.checked,
                        })
                      }
                    />
                    <span className="truncate">{definition.label}</span>
                  </label>
                  <input
                    type="text"
                    value={provision.paragraph}
                    onChange={(event) =>
                      setProvisionField(definition.key, {
                        paragraph: event.target.value,
                      })
                    }
                    placeholder="¶"
                    aria-label={`${definition.label} paragraph number`}
                    className="w-16 shrink-0 px-2 py-1 rounded border border-ledger-line bg-parchment text-xs text-ink focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
                  />
                </div>
              );
            })}
          </div>
          <div className="text-[11px] leading-5 text-ink-light">
            Check the provisions present in this lease and note the lease paragraph
            where each appears. Descriptive only.
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Attachments">
          <div className="grid grid-cols-2 gap-1.5">
            {LEASE_ATTACHMENT_DEFINITIONS.map((definition) => (
              <label
                key={definition.key}
                className="flex items-center gap-2 text-xs text-ink"
              >
                <input
                  type="checkbox"
                  checked={hasAttachment(lprDraft.attachments, definition.key)}
                  onChange={(event) =>
                    toggleAttachmentKey(definition.key, event.target.checked)
                  }
                />
                <span className="truncate">{definition.label}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Preparer & Legal Description">
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Prepared By"
              value={lprDraft.preparedBy}
              onChange={(value) => setLpr('preparedBy', value)}
            />
            <FormField
              label="Prepared Date"
              type="date"
              value={lprDraft.preparedDate}
              onChange={(value) => setLpr('preparedDate', value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
              Legal Description
            </label>
            <textarea
              value={lprDraft.legalDescription}
              onChange={(event) => setLpr('legalDescription', event.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
            />
          </div>
        </CollapsibleSection>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Tracts
          </legend>
          <div className="space-y-2">
            {tractDrafts.map((tract) => {
              const netAcres = computeNetAcres(tract.grossAcres, tract.leasedInterest);
              const statusOptions = isLeaseStatusOption(tract.status)
                ? [...LEASE_STATUS_OPTIONS]
                : [tract.status, ...LEASE_STATUS_OPTIONS];
              return (
                <div
                  key={tract.mineralNodeId}
                  className={`rounded-lg border p-3 ${
                    tract.checked
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : 'border-ledger-line bg-parchment/40'
                  }`}
                >
                  <label className="flex items-center gap-2 text-sm font-semibold text-ink mb-2">
                    <input
                      type="checkbox"
                      checked={tract.checked}
                      onChange={(event) =>
                        setTract(tract.mineralNodeId, {
                          checked: event.target.checked,
                        })
                      }
                    />
                    <span className="truncate">
                      {tract.deskMapName}
                      <span className="font-normal text-ink-light">
                        {' '}
                        — {tract.ownerLabel}
                      </span>
                    </span>
                  </label>
                  {tract.checked && (
                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        label="Lease Name"
                        value={tract.leaseName}
                        onChange={(value) =>
                          setTract(tract.mineralNodeId, { leaseName: value })
                        }
                      />
                      <FormField
                        label="Lessor Interest"
                        value={tract.leasedInterest}
                        onChange={(value) =>
                          setTract(tract.mineralNodeId, { leasedInterest: value })
                        }
                      />
                      <FormField
                        label="Gross Acres"
                        value={tract.grossAcres}
                        onChange={(value) =>
                          setTract(tract.mineralNodeId, { grossAcres: value })
                        }
                      />
                      <div>
                        <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                          Net Mineral Acres
                        </label>
                        <div className="px-3 py-2 rounded-lg border border-ledger-line bg-ledger text-sm text-ink-light">
                          {netAcres || '—'}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
                          Status
                        </label>
                        <select
                          value={tract.status}
                          onChange={(event) =>
                            setTract(tract.mineralNodeId, {
                              status: event.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none"
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {isLeaseStatusOption(status)
                                ? status
                                : `${status} (legacy)`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <FormField
                        label="Doc #"
                        value={tract.docNo}
                        onChange={(value) =>
                          setTract(tract.mineralNodeId, { docNo: value })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-[11px] leading-5 text-ink-light">
            Check each tract this lessor leases under this report. Saving creates one
            lessee card per checked tract on its own desk map; unchecking removes that
            tract&apos;s card. Net mineral acres = gross acres x lessor interest — the
            acre view of the lessor interest, which never changes the ownership math.
          </div>
        </fieldset>

        <div>
          <label className="text-[10px] text-ink-light uppercase tracking-wider block mb-1">
            Comments
          </label>
          <textarea
            value={lprDraft.comments}
            onChange={(event) => setLpr('comments', event.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-ledger-line bg-parchment text-sm text-ink focus:ring-2 focus:ring-leather focus:border-leather outline-none resize-y"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-ink-light uppercase tracking-wider mb-2">
            Lease PDF
          </legend>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSaveError(null);
              if (file) {
                try {
                  assertFileSize(file, FILE_SIZE_LIMITS.PDF, 'Lease PDF');
                } catch (err) {
                  setSaveError(err instanceof Error ? err.message : 'File too large');
                  event.target.value = '';
                  return;
                }
              }
              setSelectedPdfFile(file);
              event.target.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {existingLeaseNode?.attachments[0] && !selectedPdfFile && (
              <span className="min-w-0 max-w-full rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                <span className="font-semibold">Current:</span>{' '}
                <span className="font-mono break-all">
                  {existingLeaseNode.attachments[0].fileName ||
                    (existingLeaseNode.docNo ? `${existingLeaseNode.docNo}.pdf` : 'PDF')}
                </span>
              </span>
            )}
            {selectedPdfFile && (
              <span className="min-w-0 max-w-full rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                <span className="font-semibold">Selected:</span>{' '}
                <span className="font-mono break-all">{selectedPdfFile.name}</span>
              </span>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => pdfInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors disabled:opacity-60"
            >
              {existingLeaseNode?.attachments[0] || selectedPdfFile
                ? 'Replace PDF'
                : 'Attach PDF'}
            </button>
            {selectedPdfFile && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setSelectedPdfFile(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-seal hover:bg-seal/10 transition-colors disabled:opacity-60"
              >
                Clear Selected PDF
              </button>
            )}
          </div>
          <div className="text-[11px] leading-5 text-ink-light">
            The PDF attaches to the Desk Map lessee card and its filename appears on the card face.
          </div>
        </fieldset>

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
                ? 'Save Lease'
                : 'Create Lease'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
