/**
 * Turn an AI `WorkspaceImportProposal` into a concrete, validated apply plan.
 *
 * The wizard never mutates workspace state directly. It builds an
 * `ApplyPlan` describing exactly what will change (project rename,
 * desk maps to create), runs it through `validateOwnershipGraph` to make
 * sure the starting node graph is sound, and reports collisions with
 * existing desk-map codes. The user reviews the plan, then a single
 * `executeApplyPlan` call commits via the workspace-store actions.
 */
import {
  validateOwnershipGraph,
  type ValidationIssue,
} from '../../engine/math-engine';
import type { DeskMap, OwnershipNode } from '../../types/node';
import type { WorkspaceImportProposal } from './schemas';

export interface PlannedDeskMap {
  /** Tract code from the proposal (e.g. "T2"). Used as DeskMap.code. */
  code: string;
  /** Display name we will pass to `createDeskMap`. */
  name: string;
  grossAcres: string;
  description: string;
}

export interface DeskMapCollision {
  code: string;
  existingDeskMapId: string;
}

export interface ApplyPlan {
  /** New project name to set, or null to leave alone. */
  projectNameChange: string | null;
  /** Desk maps that will actually be created. */
  deskMapsToCreate: PlannedDeskMap[];
  /** Tracts the proposal mentioned but already exist by code. Skipped, not overwritten. */
  collisions: DeskMapCollision[];
  /**
   * Pre-existing graph issues that might surface as confusing errors after apply.
   * Apply is still allowed — these are FYI.
   */
  existingGraphIssues: ValidationIssue[];
  /**
   * Hard blockers — non-empty means apply must NOT run. Examples: every
   * proposed tract collides, or the proposal carried zero actionable data.
   */
  blockers: string[];
}

export interface CurrentWorkspaceSnapshot {
  projectName: string;
  deskMaps: DeskMap[];
  nodes: OwnershipNode[];
}

/**
 * Build a deterministic apply plan from a proposal + current workspace.
 * Pure — no store mutations, safe to call as many times as you want.
 */
export function buildApplyPlan(
  proposal: WorkspaceImportProposal,
  current: CurrentWorkspaceSnapshot
): ApplyPlan {
  const blockers: string[] = [];

  const desiredProjectName = pickProjectName(proposal);
  const projectNameChange =
    desiredProjectName && desiredProjectName !== current.projectName
      ? desiredProjectName
      : null;

  const existingByCode = new Map(
    current.deskMaps.map((dm) => [normalizeCode(dm.code), dm.id])
  );

  const deskMapsToCreate: PlannedDeskMap[] = [];
  const collisions: DeskMapCollision[] = [];
  const seenInProposal = new Set<string>();

  for (const tract of proposal.tracts) {
    const code = normalizeCode(tract.code);
    if (!code) continue;
    if (seenInProposal.has(code)) continue;
    seenInProposal.add(code);

    const existing = existingByCode.get(code);
    if (existing) {
      collisions.push({ code, existingDeskMapId: existing });
      continue;
    }

    deskMapsToCreate.push({
      code,
      name: `Tract ${code}`,
      grossAcres: tract.grossAcres ?? '',
      description: buildTractDescription(tract),
    });
  }

  if (
    deskMapsToCreate.length === 0 &&
    projectNameChange === null &&
    collisions.length === 0
  ) {
    blockers.push('Nothing in the proposal would change the workspace.');
  }

  const validation = validateOwnershipGraph(current.nodes);
  const existingGraphIssues = validation.valid ? [] : validation.issues;

  return {
    projectNameChange,
    deskMapsToCreate,
    collisions,
    existingGraphIssues,
    blockers,
  };
}

export interface WorkspaceApplyActions {
  setProjectName: (name: string) => void;
  createDeskMap: (name: string, code: string) => string;
  updateDeskMapDetails: (
    id: string,
    fields: { grossAcres?: string; pooledAcres?: string; description?: string }
  ) => void;
}

export interface ApplyResult {
  projectRenamed: boolean;
  createdDeskMapIds: string[];
}

/**
 * Commit the plan through workspace-store actions. Caller must have
 * already inspected `plan.blockers` — this throws if blockers exist so
 * we never silently mutate a workspace the user didn't approve.
 */
export function executeApplyPlan(
  plan: ApplyPlan,
  actions: WorkspaceApplyActions
): ApplyResult {
  if (plan.blockers.length > 0) {
    throw new Error(
      `Cannot apply plan with blockers: ${plan.blockers.join('; ')}`
    );
  }

  if (plan.projectNameChange !== null) {
    actions.setProjectName(plan.projectNameChange);
  }

  const createdDeskMapIds: string[] = [];
  for (const dm of plan.deskMapsToCreate) {
    const id = actions.createDeskMap(dm.name, dm.code);
    if (dm.grossAcres || dm.description) {
      actions.updateDeskMapDetails(id, {
        grossAcres: dm.grossAcres,
        description: dm.description,
      });
    }
    createdDeskMapIds.push(id);
  }

  return {
    projectRenamed: plan.projectNameChange !== null,
    createdDeskMapIds,
  };
}

function pickProjectName(proposal: WorkspaceImportProposal): string | null {
  const unit = proposal.project.unitName?.trim();
  if (unit) return unit;
  const operator = proposal.project.operator?.trim();
  if (operator) return operator;
  return null;
}

function normalizeCode(raw: string | undefined): string {
  return (raw ?? '').trim();
}

function buildTractDescription(
  tract: WorkspaceImportProposal['tracts'][number]
): string {
  const parts: string[] = [];
  if (tract.nprGroups && tract.nprGroups.length > 0) {
    parts.push(`NPR: ${tract.nprGroups.join(', ')}`);
  }
  if (tract.notes) parts.push(tract.notes);
  return parts.join(' — ');
}
