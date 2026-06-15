import { describe, expect, it } from 'vitest';
import { calculateShare } from '../../../title-math';
import { isOverConveyance } from '../ConveyModal';

// DA-M1: the modal must flag an over-conveyance now that `calculateShare`
// returns the raw (uncapped) requested share instead of silently clamping it.
describe('ConveyModal over-conveyance detection (DA-M1)', () => {
  function shareOf(numerator: string, denominator: string, parentFraction: string) {
    return calculateShare({
      conveyanceMode: 'fraction',
      splitBasis: 'whole',
      numerator,
      denominator,
      manualAmount: '0',
      parentFraction,
      parentInitialFraction: '1.0',
    });
  }

  it('flags a request that exceeds the grantor remainder', () => {
    // 3/4 of the whole = 0.75 against a grantor holding only 0.5.
    const share = shareOf('3', '4', '0.5');
    expect(share.toFixed(9)).toBe('0.750000000');
    expect(isOverConveyance(share, '0.5')).toBe(true);
  });

  it('does not flag a request within the grantor remainder', () => {
    const share = shareOf('1', '4', '0.5');
    expect(isOverConveyance(share, '0.5')).toBe(false);
  });

  it('does not flag an exact-remainder conveyance (epsilon tolerance)', () => {
    // 1/3 of the whole rounds the remainder; conveying exactly the remaining
    // fraction must not trip the warning.
    const remaining = '0.333333333';
    const share = shareOf('1', '3', remaining);
    expect(isOverConveyance(share, remaining)).toBe(false);
  });
});
