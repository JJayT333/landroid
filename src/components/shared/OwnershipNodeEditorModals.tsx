import { useCallback, useEffect, useMemo } from 'react';
import { getActiveLeases, pickPrimaryLease, toDeskMapPrimaryLeaseSummary } from '../deskmap/deskmap-coverage';
import { deriveCounty } from '../../utils/land';
import { useUIStore } from '../../store/ui-store';
import { useOwnerStore } from '../../store/owner-store';
import { useWorkspaceStore } from '../../store/workspace-store';
import NodeEditModal from '../modals/NodeEditModal';
import AttachLeaseModal from '../modals/AttachLeaseModal';
import CreateNpriModal from '../modals/CreateNpriModal';
import PdfViewerModal from '../modals/PdfViewerModal';
import { createBlankOwner } from '../../types/owner';
import type { NodeEditorRoute } from '../../utils/node-editor-route';

interface OwnershipNodeEditorModalsProps {
  route: NodeEditorRoute | null;
  onSetRoute: (route: NodeEditorRoute | null) => void;
  npriParentId: string | null;
  onSetNpriParentId: (nodeId: string | null) => void;
  pdfViewNodeId: string | null;
  onSetPdfViewNodeId: (nodeId: string | null) => void;
}

export default function OwnershipNodeEditorModals({
  route,
  onSetRoute,
  npriParentId,
  onSetNpriParentId,
  pdfViewNodeId,
  onSetPdfViewNodeId,
}: OwnershipNodeEditorModalsProps) {
  const setView = useUIStore((state) => state.setView);
  const owners = useOwnerStore((state) => state.owners);
  const leases = useOwnerStore((state) => state.leases);
  const ownerWorkspaceId = useOwnerStore((state) => state.workspaceId);
  const addOwnerRecord = useOwnerStore((state) => state.addOwner);
  const selectOwner = useOwnerStore((state) => state.selectOwner);
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const nodes = useWorkspaceStore((state) => state.nodes);
  const deskMaps = useWorkspaceStore((state) => state.deskMaps);
  const setActiveNode = useWorkspaceStore((state) => state.setActiveNode);
  const updateNode = useWorkspaceStore((state) => state.updateNode);

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const ownerById = useMemo(
    () => new Map(owners.map((owner) => [owner.id, owner])),
    [owners]
  );
  const deskMapNameByNodeId = useMemo(() => {
    const next = new Map<string, string>();

    deskMaps.forEach((deskMap) => {
      deskMap.nodeIds.forEach((nodeId) => {
        if (!next.has(nodeId)) {
          next.set(nodeId, deskMap.name);
        }
      });
    });

    return next;
  }, [deskMaps]);

  const editNode = route?.kind === 'node' ? nodeById.get(route.nodeId) ?? null : null;
  const leaseParent =
    route?.kind === 'lease' ? nodeById.get(route.parentNodeId) ?? null : null;
  const npriParent = npriParentId ? nodeById.get(npriParentId) ?? null : null;
  const pdfViewNode = pdfViewNodeId ? nodeById.get(pdfViewNodeId) ?? null : null;

  useEffect(() => {
    if (route?.kind === 'node' && !editNode) {
      onSetRoute(null);
    }
    if (route?.kind === 'lease' && !leaseParent) {
      onSetRoute(null);
    }
  }, [editNode, leaseParent, onSetRoute, route]);

  useEffect(() => {
    if (npriParentId && !npriParent) {
      onSetNpriParentId(null);
    }
  }, [npriParent, npriParentId, onSetNpriParentId]);

  useEffect(() => {
    if (pdfViewNodeId && !pdfViewNode) {
      onSetPdfViewNodeId(null);
    }
  }, [onSetPdfViewNodeId, pdfViewNode, pdfViewNodeId]);

  const leaseStatusText = useMemo(() => {
    if (!editNode || editNode.type === 'related' || !editNode.linkedOwnerId) {
      return null;
    }

    const ownerLeases = getActiveLeases(
      leases.filter((lease) => lease.ownerId === editNode.linkedOwnerId)
    );
    const leaseSummary = toDeskMapPrimaryLeaseSummary(pickPrimaryLease(ownerLeases));

    if (!leaseSummary) {
      return null;
    }

    return leaseSummary.lessee
      ? `Leased to ${leaseSummary.lessee}`
      : 'Lease node on file';
  }, [editNode, leases]);

  const handleManageOwner = useCallback(
    async (nodeId: string) => {
      const node = nodeById.get(nodeId) ?? null;
      if (!node) return;
      if (node.type === 'related' && !node.linkedOwnerId) return;

      const linkedOwner = node.linkedOwnerId
        ? ownerById.get(node.linkedOwnerId) ?? null
        : null;

      if (linkedOwner) {
        selectOwner(linkedOwner.id);
        setView('owners');
        onSetRoute(null);
        return;
      }

      const nextOwner = createBlankOwner(ownerWorkspaceId ?? workspaceId, {
        name: node.grantee || 'New Owner',
        county: deriveCounty(node.landDesc),
        prospect: deskMapNameByNodeId.get(node.id) ?? '',
        notes: [
          node.instrument ? `Source Instrument: ${node.instrument}` : '',
          node.docNo ? `Doc #: ${node.docNo}` : '',
          node.landDesc ? `Land: ${node.landDesc}` : '',
          node.remarks ? `Remarks: ${node.remarks}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });

      await addOwnerRecord(nextOwner);
      updateNode(node.id, { linkedOwnerId: nextOwner.id });
      selectOwner(nextOwner.id);
      setView('owners');
      onSetRoute(null);
    },
    [
      addOwnerRecord,
      deskMapNameByNodeId,
      nodeById,
      onSetRoute,
      ownerById,
      ownerWorkspaceId,
      selectOwner,
      setView,
      updateNode,
      workspaceId,
    ]
  );

  const handleManageLease = useCallback(
    (nodeId: string) => {
      setActiveNode(nodeId);
      onSetRoute({
        kind: 'lease',
        parentNodeId: nodeId,
      });
    },
    [onSetRoute, setActiveNode]
  );

  const handleManageNpri = useCallback(
    (nodeId: string) => {
      onSetRoute(null);
      onSetNpriParentId(nodeId);
    },
    [onSetNpriParentId, onSetRoute]
  );

  return (
    <>
      {editNode && (
        <NodeEditModal
          node={editNode}
          linkedOwnerName={
            editNode.linkedOwnerId
              ? ownerById.get(editNode.linkedOwnerId)?.name ?? null
              : null
          }
          leaseStatusText={leaseStatusText}
          onManageOwner={handleManageOwner}
          onManageLease={handleManageLease}
          onManageNpri={handleManageNpri}
          onClose={() => onSetRoute(null)}
          onViewPdf={(nodeId) => {
            onSetRoute(null);
            onSetPdfViewNodeId(nodeId);
          }}
        />
      )}

      {leaseParent && (
        <AttachLeaseModal
          parentNode={leaseParent}
          preferredLeaseId={route?.kind === 'lease' ? route.leaseId ?? null : null}
          onClose={() => onSetRoute(null)}
          onSaved={(nodeId) => {
            onSetRoute(null);
            setActiveNode(nodeId);
          }}
        />
      )}

      {npriParent && (
        <CreateNpriModal
          parentNode={npriParent}
          onClose={() => onSetNpriParentId(null)}
        />
      )}

      {pdfViewNode && (
        <PdfViewerModal
          nodeId={pdfViewNode.id}
          fileNameHint={pdfViewNode?.docNo ? `${pdfViewNode.docNo}.pdf` : null}
          onClose={() => onSetPdfViewNodeId(null)}
        />
      )}
    </>
  );
}
