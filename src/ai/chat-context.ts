import type { ModelMessage } from 'ai';
import {
  formatAIActionJournalForModel,
  type AIActionJournalEntry,
} from './action-journal';

export interface AIChatHistoryEntry {
  role: 'user' | 'assistant';
  text: string;
}

export function buildModelMessagesWithActionJournal(
  entries: AIChatHistoryEntry[],
  actionJournalEntries: AIActionJournalEntry[]
): ModelMessage[] {
  const journalContext = formatAIActionJournalForModel(actionJournalEntries);
  return [
    ...(journalContext
      ? [{ role: 'system' as const, content: journalContext }]
      : []),
    // Drop empty/whitespace-only turns. An assistant entry with empty content
    // (e.g. a tool-only or errored turn) is rejected by the provider and wedges
    // the next request; empty user turns are equally unusable as context.
    ...entries
      .filter((entry) => entry.text.trim().length > 0)
      .map((entry) => ({
        role: entry.role,
        content: entry.text,
      })),
  ];
}
