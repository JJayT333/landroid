import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Notice from '../Notice';

describe('Notice', () => {
  it('renders children with a status role and the sky tone for info', () => {
    const html = renderToStaticMarkup(<Notice tone="info">Heads up</Notice>);
    expect(html).toContain('Heads up');
    expect(html).toContain('role="status"');
    expect(html).toContain('text-tint-sky-ink');
  });

  it('uses an alert role and the seal tone for error', () => {
    const html = renderToStaticMarkup(
      <Notice tone="error" title="Problem">
        details
      </Notice>
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('text-seal');
    expect(html).toContain('Problem');
  });

  it('uses an alert role for warn', () => {
    const html = renderToStaticMarkup(<Notice tone="warn">careful</Notice>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('text-tint-amber-ink');
  });

  it('renders the banner frame with a bottom border and centered wrapper', () => {
    const html = renderToStaticMarkup(
      <Notice frame="banner" tone="warn">
        banner body
      </Notice>
    );
    expect(html).toContain('border-b');
    expect(html).toContain('max-w-6xl');
  });
});
