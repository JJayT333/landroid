import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RootErrorBoundary,
  RootErrorFallback,
} from '../RootErrorBoundary';

describe('RootErrorBoundary', () => {
  it('captures an error into boundary state', () => {
    const error = new Error('Leasehold render failed');

    expect(RootErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
  });

  it('renders a reload fallback with the error details', () => {
    const html = renderToStaticMarkup(
      <RootErrorFallback error={new Error('Leasehold render failed')} />
    );

    expect(html).toContain('LANDroid hit a render error.');
    expect(html).toContain('Reload App');
    expect(html).toContain('Leasehold render failed');
  });
});
