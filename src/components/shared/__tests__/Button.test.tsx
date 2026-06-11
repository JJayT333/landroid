import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Button from '../Button';

describe('Button', () => {
  it('renders the canonical primary treatment by default', () => {
    const html = renderToStaticMarkup(<Button>Save</Button>);
    expect(html).toContain('bg-leather');
    expect(html).toContain('text-[#fff6ec]');
    expect(html).toContain('rounded-lg');
    expect(html).toContain('focus-visible:ring-2');
    expect(html).toContain('type="button"');
    expect(html).toContain('Save');
  });

  it('renders each variant', () => {
    expect(renderToStaticMarkup(<Button variant="secondary">A</Button>)).toContain('border-line-strong');
    expect(renderToStaticMarkup(<Button variant="ghost">B</Button>)).toContain('hover:bg-parchment-dark');
    expect(renderToStaticMarkup(<Button variant="destructive">C</Button>)).toContain('bg-seal');
    expect(renderToStaticMarkup(<Button variant="destructive-ghost">D</Button>)).toContain('text-seal');
    expect(renderToStaticMarkup(<Button variant="glass">E</Button>)).toContain('backdrop-blur-md');
  });

  it('renders each size', () => {
    expect(renderToStaticMarkup(<Button size="xs">A</Button>)).toContain('text-[11px]');
    expect(renderToStaticMarkup(<Button size="sm">B</Button>)).toContain('px-3 py-[5px] text-xs');
    expect(renderToStaticMarkup(<Button size="md">C</Button>)).toContain('px-3.5 py-1.5 text-sm');
  });

  it('passes through disabled and custom classes', () => {
    const html = renderToStaticMarkup(
      <Button disabled className="w-full">E</Button>
    );
    expect(html).toContain('disabled');
    expect(html).toContain('w-full');
  });
});
