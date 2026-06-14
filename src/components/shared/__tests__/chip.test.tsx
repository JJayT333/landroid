import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Chip from '../Chip';

describe('Chip', () => {
  it('renders children with the default soft neutral tag', () => {
    const html = renderToStaticMarkup(<Chip>Draft</Chip>);
    expect(html).toContain('Draft');
    expect(html).toContain('rounded-sm');
    expect(html).toContain('text-ink-light');
    expect(html).toContain('uppercase');
  });

  it('maps solid amber and pill shape', () => {
    const html = renderToStaticMarkup(
      <Chip tone="amber" variant="solid" shape="pill">
        NPRI
      </Chip>
    );
    expect(html).toContain('rounded-full');
    expect(html).toContain('bg-tint-amber');
    expect(html).toContain('text-tint-amber-ink');
  });

  it('drops uppercase tracking when uppercase is false', () => {
    const html = renderToStaticMarkup(
      <Chip tone="green" uppercase={false}>
        80 net acres
      </Chip>
    );
    expect(html).not.toContain('uppercase');
    expect(html).toContain('text-tint-green-ink');
  });
});
