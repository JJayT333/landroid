import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintOverlay from '../PrintOverlay';

describe('PrintOverlay', () => {
  it('keeps print cards at fixed height with truncation styles', () => {
    const html = renderToStaticMarkup(
      <PrintOverlay
        nodes={[
          {
            id: 'root',
            position: { x: 40, y: 40 },
            data: {
              label: 'Root',
              grantee: 'A Very Long Grantee Name That Should Not Stretch The Card',
              grantor: 'A Very Long Grantor Name That Should Not Stretch The Card',
              instrument: 'A Very Long Instrument Name That Should Not Stretch The Card',
              date: '2026-03-27',
              grantFraction: '0.5',
              remainingFraction: '0.25',
              relativeShare: '0.5',
              nodeId: 'root',
            },
          },
        ]}
        edges={[]}
        cols={1}
        rows={1}
        orientation="landscape"
        pageSize="ansi-a"
      />
    );

    expect(html).toContain('width:288px;height:160px');
    expect(html).toContain('text-overflow:ellipsis');
    expect(html).toContain('white-space:nowrap');
  });
});
