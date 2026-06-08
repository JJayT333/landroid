import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CutoverDisabledError } from '../../../project-records/action-layer/cutover';
import { MIN_PASSED_TITLE_PARITIES } from '../../../project-records/action-layer/title-cutover-gate';
import {
  DEFAULT_TITLE_READ_PATH_MODE,
  TitleReadFlipDisabledError,
  TitleReadPathFlag,
} from '../../../project-records/action-layer/title-read-path';
import {
  attemptReviewerTitleCutover,
  deriveTitleCutoverReadiness,
  TitleLedgerStatusBannerContent,
} from '../TitleLedgerStatusBanner';

describe('TitleLedgerStatusBanner', () => {
  it('renders the not-enough-parities readiness state without changing the default mode', () => {
    const readiness = deriveTitleCutoverReadiness({ recordedMutationCount: 3 });
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={null}
        lastError={null}
        readiness={readiness}
      />
    );

    expect(DEFAULT_TITLE_READ_PATH_MODE).toBe('shadow');
    expect(new TitleReadPathFlag().getMode()).toBe('shadow');
    expect(html).toContain('Title read flip');
    expect(html).toContain('Not enough parities');
    expect(html).toContain('3/10');
    expect(html).toContain('Default mode: shadow');
    expect(html).toContain('MathInputView parity');
    expect(html).toContain('.landroid round trip');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Flip to cutover');
  });

  it('surfaces runtime divergence without implying live-store rollback', () => {
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

    expect(html).toContain('Title action ledger divergence detected');
    expect(html).toContain('Live title store remains canonical');
    expect(html).toContain('cutover candidacy is blocked');
    expect(html).toContain('Mutation createRootNode diverged');
    expect(html).toContain('Runtime title-ledger divergence is active');
    expect(html).toContain('Active');
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

  it('renders the ready-but-disabled state and keeps the reviewer control blocked', () => {
    const readiness = deriveTitleCutoverReadiness({
      recordedMutationCount: MIN_PASSED_TITLE_PARITIES,
      mathParityClean: true,
      landroidRoundTripClean: true,
    });
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={null}
        lastError={null}
        readiness={readiness}
        reviewerFlipError={'CutoverDisabledError: Live cutover of "title_tree" is disabled.'}
      />
    );

    expect(readiness.ready).toBe(true);
    expect(html).toContain('Ready, disabled');
    expect(html).toContain('10/10');
    expect(html).toContain('title_tree eligible');
    expect(html).toContain('Runtime divergence');
    expect(html).toContain('Clear');
    expect(html).toContain('CutoverDisabledError');
    expect(html).toContain('Flip to cutover');
  });

  it('surfaces default-off errors without reaching cutover', () => {
    const notReady = deriveTitleCutoverReadiness({ recordedMutationCount: 0 });
    const ready = deriveTitleCutoverReadiness({
      recordedMutationCount: MIN_PASSED_TITLE_PARITIES,
      mathParityClean: true,
      landroidRoundTripClean: true,
    });

    expect(attemptReviewerTitleCutover(notReady)).toBeInstanceOf(
      TitleReadFlipDisabledError
    );
    expect(attemptReviewerTitleCutover(ready)).toBeInstanceOf(CutoverDisabledError);
  });
});
