import {
  AI_UNDO_MUTATING_TOOL_NAMES,
  HOSTED_BLOCKED_TOOL_NAMES,
  landroidTools,
  UNDO_MUTATING_TOOL_NAMES,
} from '../ai/tools';

export interface AIMutationGuardReport {
  projectStateMutatingTools: string[];
  statefulHostedBlockedTools: string[];
  missingUndoCoverage: string[];
  missingHostedBlock: string[];
  unknownPolicyTools: string[];
  covered: boolean;
}

const STATEFUL_NON_PROJECT_MUTATORS = ['setActiveDeskMap'] as const;

export function buildAIMutationGuardReport(): AIMutationGuardReport {
  const toolNames = new Set(Object.keys(landroidTools));
  const projectStateMutatingTools = [...AI_UNDO_MUTATING_TOOL_NAMES];
  const statefulHostedBlockedTools = [...STATEFUL_NON_PROJECT_MUTATORS];
  const missingUndoCoverage = projectStateMutatingTools.filter(
    (name) => !UNDO_MUTATING_TOOL_NAMES.has(name)
  );
  const missingHostedBlock = [
    ...projectStateMutatingTools,
    ...statefulHostedBlockedTools,
  ].filter((name) => !HOSTED_BLOCKED_TOOL_NAMES.has(name));
  const unknownPolicyTools = [
    ...projectStateMutatingTools,
    ...statefulHostedBlockedTools,
  ].filter((name) => !toolNames.has(name));

  return {
    projectStateMutatingTools,
    statefulHostedBlockedTools,
    missingUndoCoverage,
    missingHostedBlock,
    unknownPolicyTools,
    covered:
      missingUndoCoverage.length === 0
      && missingHostedBlock.length === 0
      && unknownPolicyTools.length === 0,
  };
}

