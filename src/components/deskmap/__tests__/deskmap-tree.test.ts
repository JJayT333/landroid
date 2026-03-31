import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../../types/node';
import { buildDeskMapTree } from '../deskmap-tree';

describe('deskmap-tree', () => {
  it('treats lease nodes as terminal children while keeping other related docs inline', () => {
    const root = {
      ...createBlankNode('root'),
      grantee: 'Pat Doe',
      fraction: '1',
      initialFraction: '1',
    };
    const child = {
      ...createBlankNode('child', 'root'),
      grantee: 'Sam Doe',
      fraction: '0.5',
      initialFraction: '0.5',
    };
    const leaseNode = {
      ...createBlankNode('lease-1', 'root'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      instrument: 'Oil & Gas Lease',
      grantee: 'Acme Energy',
    };
    const affidavit = {
      ...createBlankNode('doc-1', 'root'),
      type: 'related' as const,
      relatedKind: 'document' as const,
      instrument: 'Affidavit of Heirship',
    };

    const trees = buildDeskMapTree([root, child, leaseNode, affidavit]);

    expect(trees).toHaveLength(1);
    expect(trees[0]?.node.id).toBe('root');
    expect(trees[0]?.children.map((entry) => entry.node.id)).toEqual(['child', 'lease-1']);
    expect(trees[0]?.relatedDocs.map((entry) => entry.id)).toEqual(['doc-1']);
    expect(trees[0]?.children[1]?.children).toEqual([]);
    expect(trees[0]?.children[1]?.relatedDocs).toEqual([]);
  });

  it('returns multiple top-level roots when a tract starts from separate families', () => {
    const familyOneRoot = {
      ...createBlankNode('family-1-root'),
      grantee: 'Family One',
      fraction: '1',
      initialFraction: '1',
    };
    const familyTwoRoot = {
      ...createBlankNode('family-2-root'),
      grantee: 'Family Two',
      fraction: '1',
      initialFraction: '1',
    };
    const familyTwoChild = {
      ...createBlankNode('family-2-child', 'family-2-root'),
      grantee: 'Family Two Child',
      fraction: '0.5',
      initialFraction: '0.5',
    };

    const trees = buildDeskMapTree([familyOneRoot, familyTwoRoot, familyTwoChild]);

    expect(trees.map((entry) => entry.node.id)).toEqual([
      'family-1-root',
      'family-2-root',
    ]);
    expect(trees[0]?.children).toEqual([]);
    expect(trees[1]?.children.map((entry) => entry.node.id)).toEqual(['family-2-child']);
  });
});
