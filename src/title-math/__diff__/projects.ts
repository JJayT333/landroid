/**
 * Project loaders for the characterization harness.
 *
 * Three projects feed the baseline:
 *   - springhill   — real-but-scrubbed operator data, loaded from the committed
 *                    public sample. THE correctness oracle (must stay
 *                    byte-identical through the rewrite).
 *   - vulcan-mesa  — the bundled demo seed. Change-detector.
 *   - raven-forest — the larger combinatorial demo seed. Change-detector.
 *
 * The demo seeds use frozen `Date.now` (Vulcan) and seeded `Math.random`
 * (Raven, for NPRI node ids); neither uses `crypto.randomUUID`. Each demo loader
 * installs the deterministic runtime fresh before building, so every project's
 * capture is reproducible and independent of build order. Springhill is a static
 * file and needs no shim.
 *
 * Test/diagnostic-only; never imported by app code.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCombinatorialWorkspaceData } from '../../storage/seed-test-data';
import { buildVulcanMesaWorkspaceData } from '../../storage/seed-vulcan-mesa';
import type { LandroidFileData, WorkspaceData } from '../../storage/workspace-persistence';
import type { Lease, Owner } from '../../types/owner';
import type { WorkspaceInput } from './capture';

const FIXTURE_DATE_MS = Date.parse('2026-05-23T17:00:00.000Z');
const SEED_UUIDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
];

type Uuid = `${string}-${string}-${string}-${string}-${string}`;

/**
 * Mirror of `scripts/generate-phase-0-fixtures.ts`'s deterministic runtime, so
 * harness captures match the committed Phase-0 goldens. Mutates process globals
 * (`Date.now`, `Math.random`, `crypto.randomUUID`); call before building a seed.
 */
export function installDeterministicRuntime(): void {
  let uuidIndex = 0;
  let randomSeed = 0xc0ffee;

  Date.now = () => FIXTURE_DATE_MS;
  Math.random = () => {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 0x100000000;
  };

  const currentCrypto = globalThis.crypto ?? ({} as Crypto);
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      ...currentCrypto,
      randomUUID: (): Uuid =>
        (SEED_UUIDS[uuidIndex++] ??
          `00000000-0000-4000-8000-${String(uuidIndex).padStart(12, '0')}`) as Uuid,
    },
  });
}

interface SeedResult {
  workspaceId: string;
  projectName: string;
  nodes: WorkspaceData['nodes'];
  deskMaps: WorkspaceData['deskMaps'];
  leaseholdUnit: WorkspaceData['leaseholdUnit'];
  leaseholdAssignments: WorkspaceData['leaseholdAssignments'];
  leaseholdOrris: WorkspaceData['leaseholdOrris'];
  leaseholdTransferOrderEntries: WorkspaceData['leaseholdTransferOrderEntries'];
  activeDeskMapId: string | null;
  activeUnitCode: WorkspaceData['activeUnitCode'];
  instrumentTypes: string[];
  ownerData: { owners: Owner[]; leases: Lease[] };
}

function demoInput(id: string, result: SeedResult): WorkspaceInput {
  const workspace: WorkspaceData = {
    workspaceId: result.workspaceId,
    projectName: result.projectName,
    nodes: result.nodes,
    deskMaps: result.deskMaps,
    leaseholdUnit: result.leaseholdUnit,
    leaseholdAssignments: result.leaseholdAssignments,
    leaseholdOrris: result.leaseholdOrris,
    leaseholdTransferOrderEntries: result.leaseholdTransferOrderEntries,
    activeDeskMapId: result.activeDeskMapId,
    activeUnitCode: result.activeUnitCode,
    instrumentTypes: result.instrumentTypes,
  };
  return {
    id,
    workspace,
    owners: result.ownerData.owners,
    leases: result.ownerData.leases,
  };
}

export function loadVulcanMesa(): WorkspaceInput {
  installDeterministicRuntime();
  return demoInput('vulcan-mesa', buildVulcanMesaWorkspaceData());
}

export function loadRavenForest(): WorkspaceInput {
  installDeterministicRuntime();
  return demoInput('raven-forest', buildCombinatorialWorkspaceData());
}

export function loadSpringhill(): WorkspaceInput {
  const samplePath = join(process.cwd(), 'public', 'samples', 'springhill-dr-elmore.landroid');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8')) as LandroidFileData;
  return {
    id: 'springhill',
    workspace: sample,
    owners: sample.ownerData?.owners ?? [],
    leases: sample.ownerData?.leases ?? [],
  };
}

export interface ProjectLoader {
  id: string;
  load: () => WorkspaceInput;
  /** Springhill is the byte-identity oracle; demos are change-detectors. */
  oracle: boolean;
}

export const PROJECT_LOADERS: ProjectLoader[] = [
  { id: 'springhill', load: loadSpringhill, oracle: true },
  { id: 'vulcan-mesa', load: loadVulcanMesa, oracle: false },
  { id: 'raven-forest', load: loadRavenForest, oracle: false },
];
