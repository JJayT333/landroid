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
    ...entries.map((entry) => ({
      role: entry.role,
      content: entry.text,
    })),
  ];
}
