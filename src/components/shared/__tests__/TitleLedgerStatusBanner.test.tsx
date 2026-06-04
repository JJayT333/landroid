import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TitleLedgerStatusBannerContent } from '../TitleLedgerStatusBanner';

describe('TitleLedgerStatusBanner', () => {
  it('renders nothing when the title ledger has no surfaced issue', () => {
    expect(
      renderToStaticMarkup(
        <TitleLedgerStatusBannerContent lastDivergence={null} lastError={null} />
      )
    ).toBe('');
  });

  it('surfaces runtime divergence without implying live-store rollback', () => {
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={{
        mutation: 'createRootNode',
        message: 'Parity divergence is a bug',
        at: '2026-06-03T12:00:00.000Z',
        }}
        lastError={null}
      />
    );

    expect(html).toContain('Title action ledger divergence detected');
    expect(html).toContain('Live title store remains canonical');
    expect(html).toContain('cutover candidacy is blocked');
    expect(html).toContain('Mutation createRootNode diverged');
  });

  it('surfaces non-divergence ledger recording errors', () => {
    const html = renderToStaticMarkup(
      <TitleLedgerStatusBannerContent
        lastDivergence={null}
        lastError="Malformed title mutation"
      />
    );

    expect(html).toContain('Title action ledger recording failed');
    expect(html).toContain('Recording error: Malformed title mutation');
  });
});
