import { describe, expect, it } from 'vitest';
import {
  buildSalesDeckSlides,
  extractFirstBulletsFromSection,
} from '../sales-deck-content';

describe('sales-deck-content', () => {
  it('extracts clean bullets from a requested markdown section', () => {
    const bullets = extractFirstBulletsFromSection(
      [
        '# Example',
        '',
        '## Current',
        '',
        '- Added `Desk Map` status.',
        '- Linked [deployment](https://example.test) notes.',
        '',
        '## Next',
        '- Ignore this.',
      ].join('\n'),
      'Current',
      2
    );

    expect(bullets).toEqual([
      'Added Desk Map status.',
      'Linked deployment notes.',
    ]);
  });

  it('builds a ten-slide native deck with doc-sourced status slides', () => {
    const slides = buildSalesDeckSlides({
      changelog: [
        '# Changelog',
        '',
        '## 2026-05-19',
        '- Centralized reset behavior.',
        '- Added hosted AI context.',
      ].join('\n'),
      continuation: [
        '# Handoff',
        '',
        '## Likely Next Steps',
        '- Run build.',
        '- Open PR.',
        '',
        '## Open Risks And Assumptions',
        '- Hosted browser re-test remains.',
      ].join('\n'),
      deployment: [
        '# Deploy',
        '',
        '## Frontend',
        '- Public URL: `https://landroid.abstractmapping.com`',
        '',
        '## AI Proxy',
        '- Runtime: Node.js 22.x',
        '',
        '## Verification',
        '- Manual hosted smoke required.',
      ].join('\n'),
      roadmap: '## Now\n- Harden imports.',
    });

    expect(slides).toHaveLength(10);
    expect(slides.find((slide) => slide.id === 'recent-progress')?.points).toEqual([
      'Centralized reset behavior.',
      'Added hosted AI context.',
    ]);
    expect(slides.find((slide) => slide.id === 'hosted')?.points).toContain(
      'Runtime: Node.js 22.x'
    );
    expect(slides.find((slide) => slide.id === 'next')?.points).toContain(
      'Hosted browser re-test remains.'
    );
  });
});
