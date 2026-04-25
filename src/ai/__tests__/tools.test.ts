import { beforeEach, describe, expect, it } from 'vitest';
import { useWorkspaceStore } from '../../store/workspace-store';
import { useOwnerStore } from '../../store/owner-store';
import { useCurativeStore } from '../../store/curative-store';
import { createBlankNode, type DeskMap } from '../../types/node';
import { createBlankOwner, createBlankLease } from '../../types/owner';
import { landroidTools } from '../tools';

function deskMap(overrides: Partial<DeskMap>): DeskMap {
  return {
    id: 'dm-1',
    name: 'Tract 1',
    code: 'T1',
    tractId: null,
    grossAcres: '100',
    pooledAcres: '100',
    description: '',
    nodeIds: [],
    ...overrides,
  };
}

async function runTool<Tool extends { execute?: (...args: never[]) => unknown }>(
  tool: Tool,
  args: unknown
): Promise<any> {
  // Tools can technically stream; in tests we always await a concrete value.
  const exec = tool.execute as (a: unknown, o: unknown) => Promise<unknown>;
  return await exec(args, {} as never);
}

describe('AI tools — read-only project queries', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaceId: 'ws-1',
      projectName: 'Test Project',
      deskMaps: [],
      nodes: [],
      activeDeskMapId: null,
      leaseholdAssignments: [],
      leaseholdOrris: [],
      leaseholdTransferOrderEntries: [],
    });
    useOwnerStore.setState({ owners: [], leases: [] });
    useCurativeStore.setState({ titleIssues: [] });
  });

  it('getProjectSummary returns counts from current state', async () => {
    useWorkspaceStore.setState({
      deskMaps: [deskMap({ id: 'dm-1' })],
      activeDeskMapId: 'dm-1',
      nodes: [
        { ...createBlankNode('n1'), interestClass: 'mineral' },
        { ...createBlankNode('n2'), interestClass: 'mineral' },
        { ...createBlankNode('n3'), interestClass: 'npri' },
      ],
    });

    const result = await runTool(landroidTools.getProjectSummary, {});
    expect(result).toMatchObject({
      projectName: 'Test Project',
      deskMapCount: 1,
      totalNodes: 3,
      nodeCountsByInterestClass: { mineral: 2, npri: 1 },
      activeDeskMap: { id: 'dm-1', name: 'Tract 1', code: 'T1' },
    });
  });

  it('listDeskMaps reports per-tract node count', async () => {
    useWorkspaceStore.setState({
      deskMaps: [
        deskMap({ id: 'dm-1', nodeIds: ['n1', 'n2'] }),
        deskMap({ id: 'dm-2', name: 'Tract 2', code: 'T2', nodeIds: ['n3'] }),
      ],
      nodes: [
        createBlankNode('n1'),
        createBlankNode('n2'),
        createBlankNode('n3'),
      ],
    });

    const result = await runTool(landroidTools.listDeskMaps, {});
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'dm-1', nodeCount: 2 });
    expect(result[1]).toMatchObject({ id: 'dm-2', nodeCount: 1 });
  });

  it('getLessorRoster joins owners to leases and sorts by lease count', async () => {
    const ownerA = { ...createBlankOwner('ws-1'), id: 'o-1', name: 'Aiken' };
    const ownerB = { ...createBlankOwner('ws-1'), id: 'o-2', name: 'Zebra' };
    const lease1 = { ...createBlankLease('ws-1', 'o-2'), id: 'l-1', leaseName: 'Z1' };
    const lease2 = { ...createBlankLease('ws-1', 'o-2'), id: 'l-2', leaseName: 'Z2' };
    const lease3 = { ...createBlankLease('ws-1', 'o-1'), id: 'l-3', leaseName: 'A1' };
    useOwnerStore.setState({ owners: [ownerA, ownerB], leases: [lease1, lease2, lease3] });

    const result = await runTool(landroidTools.getLessorRoster, {});
    expect(result[0].name).toBe('Zebra');
    expect(result[0].leaseCount).toBe(2);
    expect(result[1].name).toBe('Aiken');
    expect(result[1].leaseCount).toBe(1);
  });

  it('searchInstruments matches grantor/grantee/docNo substrings', async () => {
    useWorkspaceStore.setState({
      nodes: [
        { ...createBlankNode('n1'), grantor: 'Famcor Oil, Inc.', grantee: 'Public', docNo: '11-769' },
        { ...createBlankNode('n2'), grantor: 'Elmore Family Partners, Ltd.', grantee: 'Famcor Oil, Inc.' },
        { ...createBlankNode('n3'), grantor: 'Billie Jo Trapp', grantee: 'Famcor Oil, Inc.' },
      ],
    });

    const result = await runTool(landroidTools.searchInstruments, {
      query: 'famcor',
      limit: 10,
    });
    expect(result).toHaveLength(3);

    const byDoc = await runTool(landroidTools.searchInstruments, {
      query: '11-769',
      limit: 10,
    });
    expect(byDoc).toHaveLength(1);
    expect(byDoc[0].nodeId).toBe('n1');
  });

  it('explainNode returns parent chain walking up to root', async () => {
    useWorkspaceStore.setState({
      deskMaps: [deskMap({ id: 'dm-1', nodeIds: ['root', 'child', 'grandchild'] })],
      nodes: [
        { ...createBlankNode('root'), grantor: 'State of TX', grantee: 'Patent Grantee' },
        { ...createBlankNode('child'), grantor: 'Patent Grantee', grantee: 'Bridges', parentId: 'root' },
        { ...createBlankNode('grandchild'), grantor: 'Bridges', grantee: 'Elmore', parentId: 'child' },
      ],
    });

    const result = await runTool(landroidTools.explainNode, { nodeId: 'grandchild' });
    expect(result).toMatchObject({
      nodeId: 'grandchild',
      grantor: 'Bridges',
      grantee: 'Elmore',
      hostingDeskMap: { id: 'dm-1', name: 'Tract 1' },
    });
    expect(result.parentChain).toHaveLength(2);
    expect(result.parentChain?.[0].grantee).toBe('Bridges');
    expect(result.parentChain?.[1].grantee).toBe('Patent Grantee');
  });

  it('explainNode returns error for unknown id', async () => {
    const result = await runTool(landroidTools.explainNode, { nodeId: 'nope' });
    expect(result).toMatchObject({ error: expect.stringContaining('nope') });
  });

  it('rejects malformed lease economics before AI-created leases enter active math', async () => {
    const owner = { ...createBlankOwner('ws-1'), id: 'owner-1', name: 'Owner One' };
    useOwnerStore.setState({ owners: [owner], leases: [] });

    const badRoyalty = await runTool(landroidTools.createLease, {
      ownerId: owner.id,
      royaltyRate: 'one eighth',
    });
    expect(badRoyalty).toMatchObject({
      ok: false,
      error: expect.stringContaining('Royalty rate'),
    });

    const badLeasedInterest = await runTool(landroidTools.createLease, {
      ownerId: owner.id,
      leasedInterest: 'all of it',
    });
    expect(badLeasedInterest).toMatchObject({
      ok: false,
      error: expect.stringContaining('Leased interest'),
    });
    expect(useOwnerStore.getState().leases).toEqual([]);
  });

  // Audit L-4: explicit empty strings must be rejected so a model can't save
  // a 0-royalty lease by passing royaltyRate=''. Missing keys remain valid
  // (the user can fill them in later); the error only fires for explicit ''.
  it('rejects explicit empty-string royaltyRate / leasedInterest from the AI', async () => {
    const owner = { ...createBlankOwner('ws-1'), id: 'owner-1', name: 'Owner One' };
    useOwnerStore.setState({ owners: [owner], leases: [] });

    const emptyRoyalty = await runTool(landroidTools.createLease, {
      ownerId: owner.id,
      royaltyRate: '',
    });
    expect(emptyRoyalty).toMatchObject({
      ok: false,
      error: expect.stringContaining('royaltyRate cannot be an empty string'),
    });

    const emptyLeasedInterest = await runTool(landroidTools.createLease, {
      ownerId: owner.id,
      leasedInterest: '',
    });
    expect(emptyLeasedInterest).toMatchObject({
      ok: false,
      error: expect.stringContaining('leasedInterest cannot be an empty string'),
    });
    expect(useOwnerStore.getState().leases).toEqual([]);
  });

  it('keeps non-Texas leases out of active AI lease creation and attachment', async () => {
    const owner = { ...createBlankOwner('ws-1'), id: 'owner-1', name: 'Owner One' };
    const mineralNode = {
      ...createBlankNode('node-1'),
      interestClass: 'mineral' as const,
      linkedOwnerId: owner.id,
    };
    const federalLease = createBlankLease('ws-1', owner.id, {
      id: 'lease-federal',
      jurisdiction: 'federal',
    });
    useOwnerStore.setState({ owners: [owner], leases: [federalLease] });
    useWorkspaceStore.setState({
      nodes: [mineralNode],
      deskMaps: [deskMap({ id: 'dm-1', nodeIds: [mineralNode.id] })],
      activeDeskMapId: 'dm-1',
    });

    const createdFederal = await runTool(landroidTools.createLease, {
      ownerId: owner.id,
      jurisdiction: 'federal',
    });
    expect(createdFederal).toMatchObject({
      ok: false,
      error: expect.stringContaining('Only Texas fee/state leases'),
    });

    const attachedFederal = await runTool(landroidTools.attachLease, {
      mineralNodeId: mineralNode.id,
      leaseId: federalLease.id,
    });
    expect(attachedFederal).toMatchObject({
      ok: false,
      error: expect.stringContaining('Only Texas fee/state leases'),
    });
    expect(useWorkspaceStore.getState().nodes).toHaveLength(1);
  });

  it('rejects attaching a lease to a mineral node linked to a different owner', async () => {
    const ownerOne = { ...createBlankOwner('ws-1'), id: 'owner-1', name: 'Owner One' };
    const ownerTwo = { ...createBlankOwner('ws-1'), id: 'owner-2', name: 'Owner Two' };
    const mineralNode = {
      ...createBlankNode('node-1'),
      interestClass: 'mineral' as const,
      linkedOwnerId: ownerOne.id,
    };
    const ownerTwoLease = createBlankLease('ws-1', ownerTwo.id, {
      id: 'lease-owner-two',
      jurisdiction: 'tx_fee',
    });
    useOwnerStore.setState({ owners: [ownerOne, ownerTwo], leases: [ownerTwoLease] });
    useWorkspaceStore.setState({
      nodes: [mineralNode],
      deskMaps: [deskMap({ id: 'dm-1', nodeIds: [mineralNode.id] })],
      activeDeskMapId: 'dm-1',
    });

    const result = await runTool(landroidTools.attachLease, {
      mineralNodeId: mineralNode.id,
      leaseId: ownerTwoLease.id,
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('does not match'),
    });
    expect(useWorkspaceStore.getState().nodes).toHaveLength(1);
  });

  // Audit M-3: deleteNode used to gate cascading deletes on a model-supplied
  // boolean, which the model could just set on its own. Now the AI tool
  // refuses cascades unconditionally; the user must perform them from the UI.
  it('refuses to cascade-delete a node with descendants regardless of the AI', async () => {
    const root = { ...createBlankNode('root-1'), interestClass: 'mineral' as const };
    const child = {
      ...createBlankNode('child-1'),
      parentId: 'root-1',
      interestClass: 'mineral' as const,
    };
    useWorkspaceStore.setState({
      nodes: [root, child],
      deskMaps: [deskMap({ id: 'dm-1', nodeIds: ['root-1', 'child-1'] })],
      activeDeskMapId: 'dm-1',
    });

    const refused = await runTool(landroidTools.deleteNode, { nodeId: 'root-1' });
    expect(refused).toMatchObject({
      ok: false,
      error: expect.stringContaining('Refusing cascading delete'),
      descendantCount: 1,
    });
    // Workspace untouched.
    expect(useWorkspaceStore.getState().nodes).toHaveLength(2);

    const preview = await runTool(landroidTools.previewDeleteNode, { nodeId: 'root-1' });
    expect(preview).toMatchObject({
      descendantCount: 1,
      cascadeRequiresUiApproval: true,
    });
  });

});
