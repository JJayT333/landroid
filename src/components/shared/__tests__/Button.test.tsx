import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Button from '../Button';

describe('Button', () => {
  it('renders the canonical primary treatment by default', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain('bg-leather');
    expect(html).toContain('hover:bg-leather-dark');
    expect(html).toContain('rounded-md');
    expect(html).toContain('type="button"');
    expect(html).toContain('Save');
  });

  it('renders each variant and size', () => {
    expect(renderToStaticMarkup(<Button variant="secondary">A</Button>)).toContain('border-ledger-line');
    expect(renderToStaticMarkup(<Button variant="ghost">B</Button>)).toContain('hover:bg-parchment-dark/60');
    expect(renderToStaticMarkup(<Button variant="destructive">C</Button>)).toContain('bg-seal');
    expect(renderToStaticMarkup(<Button size="sm">D</Button>)).toContain('px-2.5 py-1 text-xs');
  });

  it('passes through disabled and custom classes', () => {
    const html = renderToStaticMarkup(
      <Button disabled className="w-full">E</Button>
    );
    expect(html).toContain('disabled');
    expect(html).toContain('w-full');
  });
});
