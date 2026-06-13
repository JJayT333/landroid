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

  it('renders a shape node as a shape, not a bogus ownership card', () => {
    const html = renderToStaticMarkup(
      <PrintOverlay
        nodes={[
          {
            id: 's1',
            type: 'shape',
            position: { x: 40, y: 40 },
            data: {
              shapeType: 'note',
              text: 'A field annotation',
              width: 180,
              height: 140,
              fontSize: 14,
              textAlign: 'center',
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

    expect(html).toContain('A field annotation');
    expect(html).toContain('width:180px;height:140px');
    // The note accent border distinguishes it from an ownership card.
    expect(html).toContain('border-left:4px solid #c9a227');
    // No ownership-card-only labels leak through.
    expect(html).not.toContain('Granted');
    expect(html).not.toContain('Of Whole');
  });

  it('renders an edge label when present', () => {
    const html = renderToStaticMarkup(
      <PrintOverlay
        nodes={[
          { id: 'a', type: 'shape', position: { x: 40, y: 40 }, data: { shapeType: 'rect', text: 'A', width: 120, height: 80, fontSize: 14, textAlign: 'center' } },
          { id: 'b', type: 'shape', position: { x: 40, y: 240 }, data: { shapeType: 'rect', text: 'B', width: 120, height: 80, fontSize: 14, textAlign: 'center' } },
        ]}
        edges={[{ source: 'a', target: 'b', data: { label: 'conveys' } }]}
        cols={1}
        rows={1}
        orientation="landscape"
        pageSize="ansi-a"
      />
    );

    expect(html).toContain('conveys');
  });

  it('renders a frame as a titled border', () => {
    const html = renderToStaticMarkup(
      <PrintOverlay
        nodes={[
          {
            id: 'f1',
            type: 'frame',
            position: { x: 20, y: 20 },
            data: { title: 'Tract 1 Exhibit', width: 400, height: 300 },
          },
        ]}
        edges={[]}
        cols={1}
        rows={1}
        orientation="landscape"
        pageSize="ansi-a"
      />
    );

    expect(html).toContain('Tract 1 Exhibit');
    expect(html).toContain('width:400px;height:300px');
    expect(html).not.toContain('Granted');
  });

  it('paints lower z-order nodes (frames) before higher ones', () => {
    const html = renderToStaticMarkup(
      <PrintOverlay
        nodes={[
          { id: 'top', type: 'shape', zIndex: 5, position: { x: 20, y: 20 }, data: { shapeType: 'rect', text: 'TOP', width: 100, height: 60, fontSize: 14, textAlign: 'center' } },
          { id: 'frame', type: 'frame', zIndex: -1, position: { x: 0, y: 0 }, data: { title: 'BACK', width: 300, height: 200 } },
        ]}
        edges={[]}
        cols={1}
        rows={1}
        orientation="landscape"
        pageSize="ansi-a"
      />
    );
    // The frame (zIndex -1) appears earlier in the DOM than the shape (zIndex 5).
    expect(html.indexOf('BACK')).toBeLessThan(html.indexOf('TOP'));
  });

  it('renders nothing for an unimplemented node kind (no bogus card)', () => {
    const html = renderToStaticMarkup(
      <PrintOverlay
        nodes={[
          {
            id: 'img1',
            type: 'image',
            position: { x: 40, y: 40 },
            data: { width: 100, height: 100 },
          },
        ]}
        edges={[]}
        cols={1}
        rows={1}
        orientation="landscape"
        pageSize="ansi-a"
      />
    );

    expect(html).not.toContain('Granted');
    expect(html).not.toContain('Unknown');
  });
});
