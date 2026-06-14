import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Pill from '../Pill';

describe('Pill', () => {
  it('renders an inactive md pill by default', () => {
    const html = renderToStaticMarkup(<Pill>All</Pill>);
    expect(html).toContain('All');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('text-[11.5px]');
    expect(html).toContain('border-ledger-line');
    expect(html).not.toContain('bg-leather');
  });

  it('applies the leather active standard when active', () => {
    const html = renderToStaticMarkup(<Pill active>Leased</Pill>);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('bg-leather');
    expect(html).toContain('text-parchment');
  });

  it('supports the small size', () => {
    const html = renderToStaticMarkup(
      <Pill size="sm">Unleased</Pill>
    );
    expect(html).toContain('text-[10.5px]');
  });
});
