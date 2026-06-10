import { describe, expect, it } from 'vitest';
import { createBlankNode, type OwnershipNode } from '../../../types/node';
import { buildDeskMapTree, visibleDeskMapNodes } from '../deskmap-tree';

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

describe('visibleDeskMapNodes', () => {
  function buildSampleNodes(): OwnershipNode[] {
    const root = {
      ...createBlankNode('root'),
      grantee: 'Pat Doe',
      fraction: '1',
      initialFraction: '1',
    };
    const mineralChild = {
      ...createBlankNode('mineral-child', 'root'),
      grantee: 'Sam Doe',
      fraction: '0.5',
      initialFraction: '0.5',
    };
    const npri = {
      ...createBlankNode('npri-1', 'root'),
      grantee: 'Royalty Holder',
      interestClass: 'npri' as const,
      royaltyKind: 'fixed' as const,
      fraction: '0.0625',
      initialFraction: '0.0625',
    };
    const npriSplit = {
      ...createBlankNode('npri-1-split', 'npri-1'),
      grantee: 'Royalty Heir',
      interestClass: 'npri' as const,
      royaltyKind: 'fixed' as const,
      fraction: '0.03125',
      initialFraction: '0.03125',
    };
    const npriDoc = {
      ...createBlankNode('npri-1-doc', 'npri-1'),
      type: 'related' as const,
      relatedKind: 'document' as const,
      instrument: 'Affidavit of Heirship',
    };
    return [root, mineralChild, npri, npriSplit, npriDoc];
  }

  it('hides NPRI nodes and their full subtrees when hideNpris is on', () => {
    const nodes = buildSampleNodes();

    const filtered = visibleDeskMapNodes(nodes, { hideNpris: true });

    expect(filtered.map((node) => node.id)).toEqual(['root', 'mineral-child']);
    // Nothing from the hidden subtree may be orphan-promoted to a root.
    const trees = buildDeskMapTree(filtered);
    expect(trees.map((entry) => entry.node.id)).toEqual(['root']);
    expect(trees[0]?.children.map((entry) => entry.node.id)).toEqual(['mineral-child']);
  });

  it('returns the input array unchanged when hideNpris is off', () => {
    const nodes = buildSampleNodes();

    const result = visibleDeskMapNodes(nodes, { hideNpris: false });

    expect(result).toBe(nodes);
  });

  it('returns the input array unchanged when no NPRI nodes are present', () => {
    const nodes = buildSampleNodes().filter(
      (node) => node.interestClass !== 'npri' && node.parentId !== 'npri-1'
    );

    const result = visibleDeskMapNodes(nodes, { hideNpris: true });

    expect(result).toBe(nodes);
  });

  it('never mutates the input nodes or array', () => {
    const nodes = buildSampleNodes();
    const snapshot = structuredClone(nodes);

    visibleDeskMapNodes(nodes, { hideNpris: true });
    visibleDeskMapNodes(nodes, { hideNpris: false });

    expect(nodes).toEqual(snapshot);
  });
});
