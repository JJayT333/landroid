import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MIN_PASSED_TITLE_PARITIES } from '../../../project-records/action-layer/title-cutover-gate';
import { DEFAULT_TITLE_READ_PATH_MODE } from '../../../project-records/action-layer/title-read-path';
import {
  deriveTitleCutoverReadiness,
  TitleLedgerStatusBannerContent,
} from '../TitleLedgerStatusBanner';

function readyReadiness() {
  return deriveTitleCutoverReadiness({
    recordedMutationCount: MIN_PASSED_TITLE_PARITIES,
    mathParityClean: true,
    landroidRoundTripClean: true,
  });
}

describe('TitleLedgerStatusBanner', () => {
  it('keeps the flip disabled and the code default shadow before the gates are green', () => {
    const readiness = deriveTitleCutoverReadiness({ recordedMutationCount: 3 });
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={null}
        lastError={null}
        readiness={readiness}
      />
    );

    expect(DEFAULT_TITLE_READ_PATH_MODE).toBe('shadow');
    expect(html).toContain('Title read flip');
    expect(html).toContain('Not enough parities');
    expect(html).toContain('3/10');
    expect(html).toContain('Read mode: shadow');
    expect(html).toContain('MathInputView parity');
    expect(html).toContain('.landroid round trip');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Flip to cutover');
  });

  it('enables the flip control once readiness is green in shadow mode', () => {
    const readiness = readyReadiness();
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={null}
        lastError={null}
        readiness={readiness}
      />
    );

    expect(readiness.ready).toBe(true);
    expect(html).toContain('Ready');
    expect(html).toContain('10/10');
    expect(html).toContain('title_tree eligible');
    expect(html).toContain('Flip to cutover');
    expect(html).toContain('aria-disabled="false"');
  });

  it('shows cutover mode with a revert control and a store-canonical note', () => {
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={null}
        lastError={null}
        readiness={readyReadiness()}
        readMode="cutover"
      />
    );

    expect(html).toContain('Cutover (record layer)');
    expect(html).toContain('Read mode: cutover');
    expect(html).toContain('Revert to shadow');
    expect(html).toContain('Title records read from the durable ledger');
    expect(html).toContain('live Desk Map and math');
    expect(html).toContain('aria-disabled="false"');
  });

  it('surfaces runtime divergence, blocks the flip, and keeps the store canonical', () => {
    const readiness = deriveTitleCutoverReadiness({
      recordedMutationCount: MIN_PASSED_TITLE_PARITIES,
      mathParityClean: true,
      landroidRoundTripClean: true,
      runtimeDivergenceMessage: 'createRootNode diverged',
    });
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={{
          mutation: 'createRootNode',
          message: 'Parity divergence is a bug',
          at: '2026-06-03T12:00:00.000Z',
        }}
        lastError={null}
        readiness={readiness}
      />
    );

    expect(readiness.ready).toBe(false);
    expect(html).toContain('Title action ledger divergence detected');
    expect(html).toContain('Live title store remains canonical');
    expect(html).toContain('cutover candidacy is blocked');
    expect(html).toContain('Mutation createRootNode diverged');
    expect(html).toContain('Runtime title-ledger divergence is active');
    expect(html).toContain('Active');
    expect(html).toContain('aria-disabled="true"');
  });

  it('surfaces non-divergence ledger recording errors', () => {
    const readiness = deriveTitleCutoverReadiness({
      recordedMutationCount: MIN_PASSED_TITLE_PARITIES,
      mathParityClean: true,
      landroidRoundTripClean: true,
      runtimeErrorMessage: 'Malformed title mutation',
    });
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={null}
        lastError="Malformed title mutation"
        readiness={readiness}
      />
    );

    expect(html).toContain('Title action ledger recording failed');
    expect(html).toContain('Recording error: Malformed title mutation');
    expect(html).toContain('Runtime title-ledger recording error is active');
  });
});
