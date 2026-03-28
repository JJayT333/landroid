import { describe, it, expect } from 'vitest';
import { formatAsFraction, dualDisplay } from '../fraction-display';

describe('formatAsFraction', () => {
  it('1/2', () => expect(formatAsFraction('0.5')).toBe('1/2'));
  it('1/3', () => expect(formatAsFraction('0.333333333')).toBe('1/3'));
  it('1/4', () => expect(formatAsFraction('0.25')).toBe('1/4'));
  it('3/8', () => expect(formatAsFraction('0.375')).toBe('3/8'));
  it('1/1 for 1.0', () => expect(formatAsFraction('1.0')).toBe('1/1'));
  it('0/1 for 0', () => expect(formatAsFraction('0')).toBe('0/1'));
  it('0/1 for negative', () => expect(formatAsFraction('-0.5')).toBe('0/1'));
  it('2/3', () => expect(formatAsFraction('0.666666667')).toBe('2/3'));
  it('1/8', () => expect(formatAsFraction('0.125')).toBe('1/8'));
  it('1/6', () => expect(formatAsFraction('0.166666667')).toBe('1/6'));
  it('1/16', () => expect(formatAsFraction('0.0625')).toBe('1/16'));
  it('1/32', () => expect(formatAsFraction('0.03125')).toBe('1/32'));
  it('1/420', () => {
    // 1/420 = 0.002380952... (repeating)
    const val = (1 / 420).toFixed(9);
    expect(formatAsFraction(val)).toBe('1/420');
  });
  it('3/420 simplifies to 1/140', () => {
    const val = (3 / 420).toFixed(9);
    expect(formatAsFraction(val)).toBe('1/140');
  });
  it('1/7', () => expect(formatAsFraction('0.142857143')).toBe('1/7'));
  it('5/8', () => expect(formatAsFraction('0.625')).toBe('5/8'));
  it('3/16', () => expect(formatAsFraction('0.1875')).toBe('3/16'));
  it('1/1024 from an exact finite decimal', () =>
    expect(formatAsFraction('0.0009765625')).toBe('1/1024'));
  it('1/65536 from an exact finite decimal', () =>
    expect(formatAsFraction('0.0000152587890625')).toBe('1/65536'));
  it('does not collapse tiny exact interests to zero', () =>
    expect(formatAsFraction('0.000000001')).toBe('1/1000000000'));
});

describe('dualDisplay', () => {
  it('shows decimal | fraction', () => {
    expect(dualDisplay('0.5')).toBe('0.500000000 | 1/2');
  });
  it('handles zero', () => {
    expect(dualDisplay('0')).toBe('0.000000000 | 0/1');
  });
  it('handles 1/3', () => {
    expect(dualDisplay('0.333333333')).toBe('0.333333333 | 1/3');
  });
});
