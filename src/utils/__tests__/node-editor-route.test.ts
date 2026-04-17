import { describe, expect, it } from 'vitest';
import { createBlankNode } from '../../types/node';
import { resolveNodeEditorRoute } from '../node-editor-route';

describe('node-editor-route', () => {
  it('opens lease nodes through their parent lease editor route', () => {
    const leaseNode = {
      ...createBlankNode('lease-node', 'owner-node'),
      type: 'related' as const,
      relatedKind: 'lease' as const,
      linkedLeaseId: 'lease-1',
    };

    expect(resolveNodeEditorRoute(leaseNode)).toEqual({
      kind: 'lease',
      parentNodeId: 'owner-node',
      leaseId: 'lease-1',
    });
  });

  it('opens regular nodes through the node edit route', () => {
    const ownerNode = {
      ...createBlankNode('owner-node', null),
      grantee: 'Pat Doe',
    };

    expect(resolveNodeEditorRoute(ownerNode)).toEqual({
      kind: 'node',
      nodeId: 'owner-node',
    });
  });
});
