import {
  buildLeaseholdDecimalRows,
  buildLeaseholdTransferOrderReview,
  buildLeaseholdUnitSummary,
  type LeaseholdDecimalRow,
  type LeaseholdTransferOrderReview,
  type LeaseholdUnitSummary,
} from '../components/leasehold/leasehold-summary';
import { dualDisplay, formatAsFraction } from '../engine/fraction-display';
import type {
  BackendSpineCoreRecord,
  CitationAnchorRecord,
  CurativeIssueRecord,
  ExtractionRunRecord,
  InstrumentRecord,
  LeaseObligationRecord,
  ObligationEventRecord,
  PacketExportRecord,
  PacketItemRecord,
  PacketRecord,
  SourceCitationRecord,
  VaultObjectRecord,
} from '../backend-spine/contracts';
import type { OwnerWorkspaceData } from '../storage/owner-persistence';
import type { WorkspaceData } from '../storage/workspace-persistence';
import { createBlankLeaseholdUnit } from '../types/leasehold';
import type { Lease, LeaseJurisdiction } from '../types/owner';
import {
  isTexasMathLease,
  isTexasMathLeaseJurisdiction,
  TEXAS_MATH_LEASE_JURISDICTIONS,
} from '../types/owner';
import { buildAIMutationGuardReport, type AIMutationGuardReport } from './ai-mutation-guard';

export type ProjectionPreconditionStatus = 'passed' | 'warning' | 'blocked';

export interface JurisdictionIsolationPrecondition {
  status: ProjectionPreconditionStatus;
  allowedJurisdictions: LeaseJurisdiction[];
  blockedUnitJurisdiction: LeaseJurisdiction | null;
  excludedLeaseIds: string[];
}

export interface MathInputView {
  workspaceId: string;
  projectId: string;
  generatedAt: string;
  preconditions: {
    jurisdictionIsolation: JurisdictionIsolationPrecondition;
  };
  deskMapIds: string[];
  nodeDisplays: Array<{
    nodeId: string;
    interestClass: string;
    decimal: string;
    fraction: string;
    dualDisplay: string;
  }>;
  texasLeaseIds: string[];
  excludedLeaseIds: string[];
  leaseholdSummary: LeaseholdUnitSummary;
  decimalRows: LeaseholdDecimalRow[];
  transferOrderReview: LeaseholdTransferOrderReview;
  warningStates: {
    overAssignedTractCount: number;
    overBurdenedTractCount: number;
    overFloatingNpriBurdenedTractCount: number;
    leaseOverlapWarningCount: number;
    inputWarningCount: number;
  };
}

export interface OpinionDraft {
  instrumentIds: string[];
  sourceCitationIds: string[];
  openCurativeIssueIds: string[];
}

export interface ObligationCalendar {
  obligations: LeaseObligationRecord[];
  eventsByObligationId: Record<string, ObligationEventRecord[]>;
}

export interface PacketExportProjection {
  packets: PacketRecord[];
  itemsByPacketId: Record<string, PacketItemRecord[]>;
  exportsByPacketId: Record<string, PacketExportRecord[]>;
}

export interface AbstractorPackage {
  projectId: string;
  instrumentIds: string[];
  documentIds: string[];
  sourceCitationIds: string[];
  packetExport: PacketExportProjection;
}

export interface AIContextProjection {
  projectId: string;
  recordIdsByType: Partial<Record<BackendSpineCoreRecord['recordType'], string[]>>;
  sourceCitationIds: string[];
  curativeIssueIds: string[];
  mutationGuard: AIMutationGuardReport;
}

export interface CitationVerifierClaim {
  claimId: string;
  text: string;
  citationIds: string[];
}

export interface CitationVerifierInput {
  claims: CitationVerifierClaim[];
  records: BackendSpineCoreRecord[];
}

export interface CitationVerifierResult {
  claimId: string;
  confidence: SourceCitationRecord['confidence'];
  supportedCitationIds: string[];
  missingCitationIds: string[];
  unverifiedCitationIds: string[];
}

export interface CitationVerifierOutput {
  ok: boolean;
  failureBehavior: 'allow_answer' | 'downgrade_to_insufficient_evidence' | 'block_answer';
  results: CitationVerifierResult[];
}

function buildJurisdictionIsolationPrecondition(
  unitJurisdiction: LeaseJurisdiction,
  leases: Lease[]
): JurisdictionIsolationPrecondition {
  const blockedUnitJurisdiction = isTexasMathLeaseJurisdiction(unitJurisdiction)
    ? null
    : unitJurisdiction;
  const excludedLeaseIds = leases
    .filter((lease) => !isTexasMathLease(lease))
    .map((lease) => lease.id);

  return {
    status: blockedUnitJurisdiction
      ? 'blocked'
      : excludedLeaseIds.length > 0
        ? 'warning'
        : 'passed',
    allowedJurisdictions: [...TEXAS_MATH_LEASE_JURISDICTIONS],
    blockedUnitJurisdiction,
    excludedLeaseIds,
  };
}

export function buildMathInputView(input: {
  workspace: WorkspaceData;
  ownerData?: Pick<OwnerWorkspaceData, 'owners' | 'leases'>;
  projectId?: string;
  generatedAt: string;
}): MathInputView {
  const projectId = input.projectId ?? input.workspace.workspaceId;
  const unit = input.workspace.leaseholdUnit ?? createBlankLeaseholdUnit();
  const owners = input.ownerData?.owners ?? [];
  const leases = input.ownerData?.leases ?? [];
  const jurisdictionIsolation = buildJurisdictionIsolationPrecondition(
    unit.jurisdiction,
    leases
  );
  const texasLeases =
    jurisdictionIsolation.status === 'blocked'
      ? []
      : leases.filter((lease) => isTexasMathLease(lease));
  const leaseholdSummary = buildLeaseholdUnitSummary({
    deskMaps: input.workspace.deskMaps,
    nodes: input.workspace.nodes,
    owners,
    leases: texasLeases,
    leaseholdAssignments: input.workspace.leaseholdAssignments ?? [],
    leaseholdOrris: input.workspace.leaseholdOrris ?? [],
  });
  const decimalRows =
    jurisdictionIsolation.status === 'blocked'
      ? []
      : buildLeaseholdDecimalRows({
          unit,
          unitSummary: leaseholdSummary,
          focusedDeskMapId: null,
        });
  const transferOrderReview =
    jurisdictionIsolation.status === 'blocked'
      ? {
          rows: [],
          totalDecimal: '0',
          expectedDecimal: '0',
          varianceDecimal: '0',
          categorySummaries: [],
          reviewableRowCount: 0,
          rowsWithCompleteSource: 0,
          rowsWithSourceGap: 0,
          rowsMissingEffectiveDate: 0,
          rowsMissingSourceDocNo: 0,
        }
      : buildLeaseholdTransferOrderReview({
          unit,
          unitSummary: leaseholdSummary,
          focusedDeskMapId: null,
        });

  return {
    workspaceId: input.workspace.workspaceId,
    projectId,
    generatedAt: input.generatedAt,
    preconditions: { jurisdictionIsolation },
    deskMapIds: input.workspace.deskMaps.map((deskMap) => deskMap.id),
    nodeDisplays: input.workspace.nodes.map((node) => ({
      nodeId: node.id,
      interestClass: node.interestClass,
      decimal: node.fraction,
      fraction: formatAsFraction(node.fraction),
      dualDisplay: dualDisplay(node.fraction),
    })),
    texasLeaseIds: texasLeases.map((lease) => lease.id),
    excludedLeaseIds: jurisdictionIsolation.excludedLeaseIds,
    leaseholdSummary,
    decimalRows,
    transferOrderReview,
    warningStates: {
      overAssignedTractCount: leaseholdSummary.overAssignedTractCount,
      overBurdenedTractCount: leaseholdSummary.overBurdenedTractCount,
      overFloatingNpriBurdenedTractCount:
        leaseholdSummary.overFloatingNpriBurdenedTractCount,
      leaseOverlapWarningCount: leaseholdSummary.leaseOverlapWarningCount,
      inputWarningCount: leaseholdSummary.inputWarningCount,
    },
  };
}

export function buildOpinionDraft(records: BackendSpineCoreRecord[]): OpinionDraft {
  return {
    instrumentIds: records
      .filter((record): record is InstrumentRecord => record.recordType === 'instrument_record')
      .map((record) => record.recordId),
    sourceCitationIds: records
      .filter((record): record is SourceCitationRecord => record.recordType === 'source_citation')
      .map((record) => record.recordId),
    openCurativeIssueIds: records
      .filter((record): record is CurativeIssueRecord => record.recordType === 'curative_issue')
      .filter((record) => record.status !== 'resolved' && record.status !== 'deferred')
      .map((record) => record.recordId),
  };
}

export function buildObligationCalendar(records: BackendSpineCoreRecord[]): ObligationCalendar {
  const obligations = records.filter(
    (record): record is LeaseObligationRecord => record.recordType === 'lease_obligation'
  );
  const eventsByObligationId: Record<string, ObligationEventRecord[]> = {};
  records
    .filter((record): record is ObligationEventRecord => record.recordType === 'obligation_event')
    .forEach((event) => {
      eventsByObligationId[event.obligationId] ??= [];
      eventsByObligationId[event.obligationId].push(event);
    });

  return { obligations, eventsByObligationId };
}

export function buildPacketExportProjection(
  records: BackendSpineCoreRecord[]
): PacketExportProjection {
  const packets = records.filter(
    (record): record is PacketRecord => record.recordType === 'packet'
  );
  const itemsByPacketId: Record<string, PacketItemRecord[]> = {};
  const exportsByPacketId: Record<string, PacketExportRecord[]> = {};

  records
    .filter((record): record is PacketItemRecord => record.recordType === 'packet_item')
    .forEach((item) => {
      itemsByPacketId[item.packetId] ??= [];
      itemsByPacketId[item.packetId].push(item);
    });
  records
    .filter((record): record is PacketExportRecord => record.recordType === 'packet_export')
    .forEach((packetExport) => {
      exportsByPacketId[packetExport.packetId] ??= [];
      exportsByPacketId[packetExport.packetId].push(packetExport);
    });

  return { packets, itemsByPacketId, exportsByPacketId };
}

export function buildAbstractorPackage(input: {
  projectId: string;
  records: BackendSpineCoreRecord[];
}): AbstractorPackage {
  return {
    projectId: input.projectId,
    instrumentIds: input.records
      .filter((record) => record.recordType === 'instrument_record')
      .map((record) => record.recordId),
    documentIds: input.records
      .filter((record) => record.recordType === 'document')
      .map((record) => record.recordId),
    sourceCitationIds: input.records
      .filter((record) => record.recordType === 'source_citation')
      .map((record) => record.recordId),
    packetExport: buildPacketExportProjection(input.records),
  };
}

export function buildAIContextProjection(input: {
  projectId: string;
  records: BackendSpineCoreRecord[];
}): AIContextProjection {
  const recordIdsByType: AIContextProjection['recordIdsByType'] = {};
  for (const record of input.records) {
    recordIdsByType[record.recordType] ??= [];
    recordIdsByType[record.recordType]?.push(record.recordId);
  }

  return {
    projectId: input.projectId,
    recordIdsByType,
    sourceCitationIds: recordIdsByType.source_citation ?? [],
    curativeIssueIds: recordIdsByType.curative_issue ?? [],
    mutationGuard: buildAIMutationGuardReport(),
  };
}

export function verifyCitationSupport(
  input: CitationVerifierInput
): CitationVerifierOutput {
  const citations = new Map(
    input.records
      .filter((record): record is SourceCitationRecord => record.recordType === 'source_citation')
      .map((citation) => [citation.recordId, citation])
  );
  const extractionRuns = new Map(
    input.records
      .filter((record): record is ExtractionRunRecord => record.recordType === 'extraction_run')
      .map((run) => [run.recordId, run])
  );
  const vaultObjectIds = new Set(
    input.records
      .filter((record): record is VaultObjectRecord => record.recordType === 'vault_object')
      .map((record) => record.recordId)
  );
  const anchorsByCitationId = new Map<string, CitationAnchorRecord[]>();
  input.records
    .filter((record): record is CitationAnchorRecord => record.recordType === 'citation_anchor')
    .forEach((anchor) => {
      anchorsByCitationId.set(anchor.sourceCitationId, [
        ...(anchorsByCitationId.get(anchor.sourceCitationId) ?? []),
        anchor,
      ]);
    });

  const hasVerifiableDocumentTextAnchor = (citation: SourceCitationRecord): boolean => {
    if (!citation.extractionRunId) return true;
    const run = extractionRuns.get(citation.extractionRunId);
    if (!run || !['succeeded', 'partial'].includes(run.status)) return false;
    if (!run.outputVaultObjectIds.some((vaultObjectId) => vaultObjectIds.has(vaultObjectId))) {
      return false;
    }
    return (anchorsByCitationId.get(citation.recordId) ?? []).some((anchor) =>
      typeof anchor.pageNumber === 'number'
      && typeof anchor.charStart === 'number'
      && typeof anchor.charEnd === 'number'
      && anchor.charEnd > anchor.charStart
    );
  };

  const results = input.claims.map((claim): CitationVerifierResult => {
    const supportedCitationIds = claim.citationIds.filter((id) => {
      const citation = citations.get(id);
      if (!citation) return false;
      if (citation.confidence === 'insufficient' || citation.confidence === 'conflicting') {
        return false;
      }
      return hasVerifiableDocumentTextAnchor(citation);
    });
    const missingCitationIds = claim.citationIds.filter((id) => !citations.has(id));
    const unverifiedCitationIds = claim.citationIds.filter((id) => {
      const citation = citations.get(id);
      return citation
        ? !supportedCitationIds.includes(id) && !missingCitationIds.includes(id)
        : false;
    });
    const confidence: SourceCitationRecord['confidence'] =
      supportedCitationIds.length === 0
        ? 'insufficient'
        : missingCitationIds.length > 0 || unverifiedCitationIds.length > 0
          ? 'partial'
          : 'supported';

    return {
      claimId: claim.claimId,
      confidence,
      supportedCitationIds,
      missingCitationIds,
      unverifiedCitationIds,
    };
  });
  const unsupported = results.filter((result) => result.confidence === 'insufficient');
  const partial = results.filter((result) => result.confidence === 'partial');

  return {
    ok: unsupported.length === 0 && partial.length === 0,
    failureBehavior:
      unsupported.length > 0
        ? 'block_answer'
        : partial.length > 0
          ? 'downgrade_to_insufficient_evidence'
          : 'allow_answer',
    results,
  };
}
