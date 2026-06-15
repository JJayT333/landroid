import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OwnershipCard, resolveCardFootprint, MIN_CARD_WIDTH, MIN_CARD_HEIGHT } from '../OwnershipNode';
import { BASE_NODE_WIDTH, BASE_NODE_HEIGHT } from '../../../engine/flowchart-metrics';
import type { OwnershipNodeData } from '../../../types/flowchart';

const data: OwnershipNodeData = {
  label: 'Root',
  grantee: 'Acme Minerals LLC',
  grantor: 'Pat Doe',
  instrument: 'Mineral Deed',
  date: '2009-06-04',
  grantFraction: '0.5',
  remainingFraction: '0.5',
  relativeShare: '0.5',
  nodeId: 'node-1',
};

describe('resolveCardFootprint — node cards never collapse (flowchart card fix)', () => {
  it('uses the scale-derived footprint when no explicit size is stored', () => {
    expect(resolveCardFootprint(undefined, undefined, 1)).toEqual({
      width: BASE_NODE_WIDTH, // 288
      minHeight: BASE_NODE_HEIGHT, // 160
      height: undefined,
    });
  });

  it('floors a stale/sub-minimum stored width+height so the card cannot become a sliver', () => {
    // This is the regression: a tiny stored width collapsed the card and the
    // text overflowed. The footprint must floor to the resizer minimums.
    const fp = resolveCardFootprint(40, 30, 1);
    expect(fp.width).toBe(MIN_CARD_WIDTH); // 160, not 40
    expect(fp.minHeight).toBe(MIN_CARD_HEIGHT); // 96, not 30
    expect(fp.height).toBe(MIN_CARD_HEIGHT);
  });

  it('preserves a legitimate user resize above the minimum', () => {
    expect(resolveCardFootprint(240, 200, 1)).toEqual({
      width: 240,
      minHeight: 200,
      height: 200,
    });
  });
});

describe('OwnershipCard — renders a visible box (flowchart card fix)', () => {
  const html = renderToStaticMarkup(
    <OwnershipCard data={data} scale={1} width={288} minHeight={160} />
  );

  it('renders a surface distinct from the canvas background', () => {
    // bg-parchment-light (not bg-parchment, which ≈ the canvas) + a strong border
    // so the card never blends into bg-canvas-bg.
    expect(html).toContain('bg-parchment-light');
    expect(html).toContain('border-line-strong');
    expect(html).not.toMatch(/\bbg-parchment\b(?!-)/); // not the canvas-colored fill
  });

  it('applies the resolved width so content cannot overflow a collapsed box', () => {
    expect(html).toContain('width:288px');
  });

  it('renders the fraction footer content', () => {
    expect(html).toContain('Granted');
    expect(html).toContain('Of Whole');
    expect(html).toContain('1/2'); // formatAsFraction(0.5)
  });
});
