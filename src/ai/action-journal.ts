import { create } from 'zustand';

export type AIActionJournalStatus = 'applied' | 'failed' | 'undone';

export interface AIApprovalDetail {
  label: string;
  value: string;
  tone?: 'default' | 'warning' | 'danger';
}

export interface AIActionJournalValidation {
  valid: boolean;
  issueCount: number;
  issues: Array<{ code: string; nodeId: string | null; message: string }>;
}

export interface AIActionJournalEntry {
  id: string;
  proposalId: string | null;
  toolName: string;
  summary: string;
  details: AIApprovalDetail[];
  status: AIActionJournalStatus;
  resultSummary: string;
  validation: AIActionJournalValidation | null;
  undoLabel: string | null;
  createdAt: number;
}

interface AIActionJournalState {
  entries: AIActionJournalEntry[];
  addEntry: (entry: AIActionJournalEntry) => void;
  markLatestAppliedUndone: (undoLabel: string) => void;
  clear: () => void;
}

const MAX_ACTION_JOURNAL_ENTRIES = 25;

export const useAIActionJournalStore = create<AIActionJournalState>()((set, get) => ({
  entries: [],
  addEntry: (entry) =>
    set({
      entries: [...get().entries, entry].slice(-MAX_ACTION_JOURNAL_ENTRIES),
    }),
  markLatestAppliedUndone: (undoLabel) => {
    const entries = get().entries;
    const index = findLatestAppliedIndex(entries, undoLabel);
    if (index < 0) return;
    set({
      entries: entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, status: 'undone' } : entry
      ),
    });
  },
  clear: () => set({ entries: [] }),
}));

export function buildAIApprovalDetails(
  toolName: string,
  input: unknown
): AIApprovalDetail[] {
  const data = asRecord(input);
  const form = asRecord(data.form);
  const details: AIApprovalDetail[] = [];
  const add = (label: string, value: unknown, tone?: AIApprovalDetail['tone']) => {
    const text = valueToText(value);
    if (!text) return;
    details.push(tone ? { label, value: text, tone } : { label, value: text });
  };
  const addNodeDocumentDetails = () => {
    add('Instrument', form.instrument);
    add('Document', form.docNo);
    const volumePage = [valueToText(form.vol), valueToText(form.page)]
      .filter(Boolean)
      .join('/');
    add('Volume/Page', volumePage);
    add('Instrument date', form.date);
    add('File date', form.fileDate);
    add('Land description', form.landDesc);
  };

  switch (toolName) {
    case 'createRootNode':
      add('Interest', data.kind ?? 'mineral');
      add('Fraction', data.initialFraction);
      add('Grantee', form.grantee);
      add('Grantor', form.grantor);
      addNodeDocumentDetails();
      add('Desk map', data.deskMapId);
      add('Owner record', data.linkedOwnerId);
      break;
    case 'convey':
      add('Parent node', data.parentNodeId);
      add('Share', data.share);
      add('Grantee', form.grantee);
      addNodeDocumentDetails();
      break;
    case 'createNpri':
      add('Parent node', data.parentNodeId);
      add('Share', data.share);
      add('Royalty kind', data.royaltyKind);
      add('Fixed basis', data.fixedRoyaltyBasis);
      add('Grantee', form.grantee);
      addNodeDocumentDetails();
      break;
    case 'precede':
      add('Existing node', data.nodeId);
      add('Predecessor fraction', data.newInitialFraction);
      add('Grantor', form.grantor);
      add('Grantee', form.grantee);
      addNodeDocumentDetails();
      break;
    case 'graftToParent':
      add('New parent', data.parentNodeId);
      if (Array.isArray(data.orphanNodeIds)) {
        add('Orphan nodes', `${data.orphanNodeIds.length}`);
      }
      break;
    case 'deleteNode':
      add('Node', data.nodeId, 'danger');
      add('Effect', 'Deletes one leaf node only after validation.', 'danger');
      break;
    case 'attachLease':
      add('Mineral node', data.mineralNodeId);
      add('Lease', data.leaseId);
      break;
    case 'createOwner':
      add('Owner', data.name);
      add('Entity type', data.entityType);
      add('County', data.county);
      break;
    case 'createLease':
      add('Owner', data.ownerId);
      add('Lease name', data.leaseName);
      add('Lessee', data.lessee);
      add('Royalty rate', data.royaltyRate);
      add('Leased interest', data.leasedInterest);
      add('Jurisdiction', data.jurisdiction);
      break;
    case 'createDeskMap':
      add('Name', data.name);
      add('Code', data.code);
      add('Gross acres', data.grossAcres);
      add('Pooled acres', data.pooledAcres);
      break;
    case 'setActiveDeskMap':
      add('Desk map', data.deskMapId);
      break;
    default:
      Object.entries(data)
        .slice(0, 6)
        .forEach(([key, value]) => add(key, value));
      break;
  }

  return details;
}

export function recordAIActionResult({
  proposalId,
  toolName,
  summary,
  input,
  result,
  undoLabel,
}: {
  proposalId?: string | null;
  toolName: string;
  summary: string;
  input: unknown;
  result: unknown;
  undoLabel?: string | null;
}): AIActionJournalEntry {
  const output = asRecord(result);
  const ok = output.ok !== false;
  const validation = normalizeValidation(output.validation);
  const entry: AIActionJournalEntry = {
    id: `ai-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    proposalId: proposalId ?? null,
    toolName,
    summary,
    details: buildAIApprovalDetails(toolName, input),
    status: ok ? 'applied' : 'failed',
    resultSummary: summarizeActionResult(toolName, input, result),
    validation,
    undoLabel: undoLabel ?? null,
    createdAt: Date.now(),
  };
  useAIActionJournalStore.getState().addEntry(entry);
  return entry;
}

export function markLatestAppliedJournalEntryUndone(undoLabel: string): void {
  useAIActionJournalStore.getState().markLatestAppliedUndone(undoLabel);
}

export function formatAIActionJournalForModel(
  entries: AIActionJournalEntry[],
  limit = 12
): string {
  const recent = entries.slice(-limit);
  if (recent.length === 0) return '';

  const lines = [
    '# Approved LANDroid AI action/result journal',
    'Use exact IDs from APPLIED entries for follow-up tool calls. UNDONE entries are historical only; do not treat as current workspace state. FAILED entries did not apply.',
    '',
  ];

  for (const entry of recent) {
    const details = entry.details
      .map((detail) => `${detail.label}=${detail.value}`)
      .join('; ');
    const validation = entry.validation
      ? entry.validation.valid
        ? 'validation=valid'
        : `validation=${entry.validation.issueCount} issue(s): ${entry.validation.issues
            .map((issue) => `${issue.code}${issue.nodeId ? `/${issue.nodeId}` : ''}`)
            .join(', ')}`
      : 'validation=not returned';
    lines.push(
      `- ${entry.status.toUpperCase()} ${entry.toolName} proposal=${entry.proposalId ?? 'none'} summary="${entry.summary}"${details ? ` details=[${details}]` : ''} result="${entry.resultSummary}" ${validation}${entry.undoLabel ? ` undo="${entry.undoLabel}"` : ''}`
    );
  }

  return lines.join('\n');
}

function summarizeActionResult(
  toolName: string,
  input: unknown,
  result: unknown
): string {
  const data = asRecord(input);
  const output = asRecord(result);
  const error = valueToText(output.error);
  if (output.ok === false) {
    return error ? `failed: ${error}` : 'failed';
  }

  switch (toolName) {
    case 'createRootNode':
    case 'convey':
    case 'createNpri':
      return idSummary('nodeId', output.nodeId);
    case 'precede':
      return idSummary('newPredecessorId', output.newPredecessorId);
    case 'graftToParent':
      return `attached=${arrayLength(output.attached)} failed=${arrayLength(output.failed)}`;
    case 'deleteNode':
      return `removedCount=${valueToText(output.removedCount) || '0'}`;
    case 'attachLease':
      return idSummary('leaseNodeId', output.leaseNodeId);
    case 'createOwner':
      return idSummary('ownerId', output.ownerId);
    case 'createLease':
      return idSummary('leaseId', output.leaseId);
    case 'createDeskMap':
      return idSummary('deskMapId', output.deskMapId);
    case 'setActiveDeskMap':
      return `activeDeskMapId=${valueToText(data.deskMapId)}`;
    default:
      return output.ok === true ? 'ok=true' : JSON.stringify(output).slice(0, 200);
  }
}

function normalizeValidation(value: unknown): AIActionJournalValidation | null {
  const data = asRecord(value);
  if (typeof data.valid !== 'boolean') return null;
  const rawIssues = Array.isArray(data.issues) ? data.issues : [];
  return {
    valid: data.valid,
    issueCount:
      typeof data.issueCount === 'number'
        ? data.issueCount
        : rawIssues.length,
    issues: rawIssues.slice(0, 6).flatMap((issue) => {
      const record = asRecord(issue);
      const code = valueToText(record.code);
      const message = valueToText(record.message);
      if (!code || !message) return [];
      return [{
        code,
        nodeId: valueToText(record.nodeId) || null,
        message,
      }];
    }),
  };
}

function findLatestAppliedIndex(
  entries: AIActionJournalEntry[],
  undoLabel: string
): number {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    // Match only the entry created with this exact undo label (latest wins on a
    // label collision). A label-less or differently-labelled applied entry must
    // not be undone in its place (deep-audit DA-L6).
    if (
      entry.status === 'applied'
      && (!undoLabel || entry.undoLabel === undoLabel)
    ) {
      return index;
    }
  }
  return -1;
}

function idSummary(label: string, value: unknown): string {
  const id = valueToText(value);
  return id ? `${label}=${id}` : `${label}=missing`;
}

function arrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function valueToText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}
