import { describe, expect, it } from 'vitest';
import { buildModelMessagesWithActionJournal } from '../chat-context';
import type { AIActionJournalEntry } from '../action-journal';

describe('AI chat model context', () => {
  it('prepends approved action journal context before chat history', () => {
    const entries: AIActionJournalEntry[] = [
      {
        id: 'entry-1',
        proposalId: 'proposal-1',
        toolName: 'createOwner',
        summary: 'Create owner Alpha Minerals',
        details: [{ label: 'Owner', value: 'Alpha Minerals' }],
        status: 'applied',
        resultSummary: 'ownerId=owner-alpha',
        validation: { valid: true, issueCount: 0, issues: [] },
        undoLabel: 'Approved AI: Create owner Alpha Minerals',
        createdAt: 1,
      },
    ];

    const messages = buildModelMessagesWithActionJournal(
      [
        { role: 'user', text: 'create the root for that owner' },
      ],
      entries
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: 'system',
      content: expect.stringContaining('owner-alpha'),
    });
    expect(messages[1]).toEqual({
      role: 'user',
      content: 'create the root for that owner',
    });
  });

  it('does not add empty journal context when no actions are available', () => {
    expect(
      buildModelMessagesWithActionJournal(
        [{ role: 'user', text: 'hello' }],
        []
      )
    ).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('drops empty/whitespace-only turns that would wedge the provider', () => {
    // An assistant turn with empty content (tool-only or errored) is rejected by
    // the provider and wedges the next request. These must not be sent.
    expect(
      buildModelMessagesWithActionJournal(
        [
          { role: 'user', text: 'first question' },
          { role: 'assistant', text: '' },
          { role: 'assistant', text: '   ' },
          { role: 'user', text: 'second question' },
        ],
        []
      )
    ).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'user', content: 'second question' },
    ]);
  });
});
