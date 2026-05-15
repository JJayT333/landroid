import { describe, expect, it } from 'vitest';
import { getTypedConfirmationState } from '../ConfirmationProvider';

describe('getTypedConfirmationState', () => {
  it('allows confirmation when no typed phrase is required', () => {
    expect(getTypedConfirmationState(undefined, '')).toEqual({
      required: false,
      expectedText: '',
      confirmed: true,
    });
  });

  it('requires an exact trimmed typed phrase when configured', () => {
    expect(getTypedConfirmationState('LOAD WORKSPACE', 'LOAD WORKSPACE')).toEqual({
      required: true,
      expectedText: 'LOAD WORKSPACE',
      confirmed: true,
    });
    expect(getTypedConfirmationState('LOAD WORKSPACE', 'load workspace')).toEqual({
      required: true,
      expectedText: 'LOAD WORKSPACE',
      confirmed: false,
    });
  });

  it('trims wrapper whitespace without making the comparison fuzzy', () => {
    expect(getTypedConfirmationState(' LOAD DEMO ', ' LOAD DEMO ')).toEqual({
      required: true,
      expectedText: 'LOAD DEMO',
      confirmed: true,
    });
    expect(getTypedConfirmationState(' LOAD DEMO ', 'LOAD  DEMO')).toEqual({
      required: true,
      expectedText: 'LOAD DEMO',
      confirmed: false,
    });
  });
});
