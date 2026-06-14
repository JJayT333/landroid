/**
 * `captureWorkspaceNumbers` — the characterization capture for the unified
 * title-math rewrite.
 *
 * Given a workspace + owner data and an `EngineBundle`, it produces ONE
 * canonical-serializable object holding every number the math layer derives for
 * that workspace: node displays, the leasehold unit summary, unit + per-tract
 * decimal rows, the transfer-order review, per-tract coverage, graph validation,
 * NPRI branch discrepancies, the root mineral total, the ORRI burden-rate map,
 * and the live ownership fractions (grant / remaining / relative share).
 *
 * The capture calls the SAME functions, in the SAME shapes, that
 * `scripts/generate-phase-0-fixtures.ts` uses to mint the committed Phase-0
 * goldens (`demo.leasehold-decimals.json`, `demo.coverage-summary.json`), so a
 * Vulcan Mesa capture reconciles with those goldens — a self-check on the
 * harness itself. Leases are passed UNFILTERED (matching the fixture generator),
 * not Texas-filtered like `buildMathInputView`; for the differential diff both
 * engines run through this identical path so the choice cancels out.
 *
 * `Map` values (`orriBurdenRateByTractId`, `computeLiveOwnershipFractions`) are
 * normalized to key-sorted plain objects with string leaves because
 * `canonicalJson` silently drops `Map`s and cannot stringify `Decimal`s.
 *
 * Test/diagnostic-only; never imported by app code.
 */
import type { DeskMapCoverageSummary } from '../../components/deskmap/deskmap-coverage';
import type {
  LeaseholdDecimalRow,
  LeaseholdTransferOrderReview,
  LeaseholdUnitSummary,
} from '../../components/leasehold/leasehold-summary';
import type {
  NpriBranchDiscrepancy,
  ValidationResult,
} from '../../engine/math-engine';
import type { LiveOwnershipFractions } from '../../engine/tree-layout';
import type { WorkspaceData } from '../../storage/workspace-persistence';
import { createBlankLeaseholdUnit } from '../../types/leasehold';
import type { LeaseholdUnit } from '../../types/leasehold';
import type { Lease, Owner } from '../../types/owner';
import type { EngineBundle } from './engine-bundle';

export interface WorkspaceInput {
  /** Stable project id used as the capture key (e.g. 'springhill'). */
  id: string;
  workspace: WorkspaceData;
  owners: Owner[];
  leases: Lease[];
}

/** Leasehold summary with its embedded Decimal Map flattened to strings. */
type SerializableLeaseholdSummary = Omit<LeaseholdUnitSummary, 'orriBurdenRateByTractId'> & {
  orriBurdenRateByTractId: Record<string, Record<string, string>>;
};

export interface CapturedNumbers {
  projectId: string;
  nodeDisplays: Array<{
    nodeId: string;
    interestClass: string;
    decimal: string;
    fraction: string;
    dualDisplay: string;
  }>;
  leaseholdSummary: SerializableLeaseholdSummary;
  orriBurdenRateByTractId: Record<string, Record<string, string>>;
  unitRows: LeaseholdDecimalRow[];
  focusedRowsByTractCode: Record<string, LeaseholdDecimalRow[]>;
  transferOrderReview: LeaseholdTransferOrderReview;
  coverageByTractCode: Record<string, DeskMapCoverageSummary>;
  validation: ValidationResult;
  npriDiscrepancies: NpriBranchDiscrepancy[];
  rootOwnershipTotal: string;
  liveOwnershipFractions: Record<string, LiveOwnershipFractions>;
}

function activeLeasesByOwnerId(leases: Lease[]): Map<string, Lease[]> {
  const result = new Map<string, Lease[]>();
  for (const lease of leases) {
    const current = result.get(lease.ownerId) ?? [];
    current.push(lease);
    result.set(lease.ownerId, current);
  }
  return result;
}

function normalizeNestedDecimalMap(
  map: Map<string, Map<string, { toString(): string }>>
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const key of [...map.keys()].sort()) {
    const inner = map.get(key) ?? new Map<string, { toString(): string }>();
    const innerOut: Record<string, string> = {};
    for (const innerKey of [...inner.keys()].sort()) {
      innerOut[innerKey] = (inner.get(innerKey) as { toString(): string }).toString();
    }
    out[key] = innerOut;
  }
  return out;
}

function normalizeLiveFractions(
  map: Map<string, LiveOwnershipFractions>
): Record<string, LiveOwnershipFractions> {
  const out: Record<string, LiveOwnershipFractions> = {};
  for (const key of [...map.keys()].sort()) {
    out[key] = map.get(key) as LiveOwnershipFractions;
  }
  return out;
}

export function captureWorkspaceNumbers(
  input: WorkspaceInput,
  engine: EngineBundle
): CapturedNumbers {
  const { workspace, owners, leases } = input;
  const unit: LeaseholdUnit = workspace.leaseholdUnit ?? createBlankLeaseholdUnit();
  const nodes = workspace.nodes;
  const deskMaps = workspace.deskMaps;

  const unitSummary = engine.buildLeaseholdUnitSummary({
    deskMaps,
    nodes,
    owners,
    leases,
    leaseholdAssignments: workspace.leaseholdAssignments ?? [],
    leaseholdOrris: workspace.leaseholdOrris ?? [],
  });

  const unitRows = engine.buildLeaseholdDecimalRows({
    unit,
    unitSummary,
    focusedDeskMapId: null,
  });

  const focusedRowsByTractCode: Record<string, LeaseholdDecimalRow[]> = {};
  for (const deskMap of deskMaps) {
    focusedRowsByTractCode[deskMap.code] = engine.buildLeaseholdDecimalRows({
      unit,
      unitSummary,
      focusedDeskMapId: deskMap.id,
    });
  }

  const transferOrderReview = engine.buildLeaseholdTransferOrderReview({
    unit,
    unitSummary,
    focusedDeskMapId: null,
  });

  const leasesByOwner = activeLeasesByOwnerId(leases);
  const coverageByTractCode: Record<string, DeskMapCoverageSummary> = {};
  for (const deskMap of deskMaps) {
    const tractNodes = nodes.filter((node) => deskMap.nodeIds.includes(node.id));
    coverageByTractCode[deskMap.code] = engine.calculateDeskMapCoverageSummary(
      tractNodes,
      leasesByOwner,
      nodes
    );
  }

  const orriBurdenRateByTractId = normalizeNestedDecimalMap(
    unitSummary.orriBurdenRateByTractId as Map<string, Map<string, { toString(): string }>>
  );
  const leaseholdSummary: SerializableLeaseholdSummary = {
    ...unitSummary,
    orriBurdenRateByTractId,
  };

  return {
    projectId: input.id,
    nodeDisplays: nodes.map((node) => ({
      nodeId: node.id,
      interestClass: node.interestClass,
      decimal: node.fraction,
      fraction: engine.formatAsFraction(node.fraction),
      dualDisplay: engine.dualDisplay(node.fraction),
    })),
    leaseholdSummary,
    orriBurdenRateByTractId,
    unitRows,
    focusedRowsByTractCode,
    transferOrderReview,
    coverageByTractCode,
    validation: engine.validateOwnershipGraph(nodes),
    npriDiscrepancies: engine.findNpriBranchDiscrepancies(nodes),
    rootOwnershipTotal: engine.rootOwnershipTotal(nodes).toString(),
    liveOwnershipFractions: normalizeLiveFractions(
      engine.computeLiveOwnershipFractions(nodes)
    ),
  };
}
