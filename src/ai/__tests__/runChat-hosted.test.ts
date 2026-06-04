import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OwnershipNode } from '../../types/node';
import type { Lease } from '../../types/owner';

async function loadHostedChat() {
  vi.resetModules();
  vi.doMock('../../utils/deploy-env', () => ({
    isHostedMode: () => true,
  }));
  const [{ runChatTurn }, session] = await Promise.all([
    import('../runChat'),
    import('../../auth/session'),
  ]);
  return { runChatTurn, session };
}

function streamResponse(chunks: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }
  );
}

describe('runChatTurn hosted proxy path', () => {
  afterEach(() => {
    vi.doUnmock('../../utils/deploy-env');
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('posts directly to the hosted proxy with the Cognito ID token and streams text deltas', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    session.setIdToken('id.jwt.token');
    const fetchMock = vi.fn(async () =>
      streamResponse([
        'data: {"choices":[{"delta":{"content":"Hel"}}]}\r\n\r\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const onDelta = vi.fn();

    const result = await runChatTurn({
      messages: [{ role: 'user', content: 'hello' }],
      onDelta,
    });

    expect(result).toMatchObject({ text: 'Hello', toolCalls: [] });
    expect(onDelta).toHaveBeenNthCalledWith(1, 'Hel');
    expect(onDelta).toHaveBeenNthCalledWith(2, 'lo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/ai/chat/completions');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer id.jwt.token');
    const body = JSON.parse(String(init.body)) as {
      stream?: unknown;
      messages?: Array<{ role: string; content: string }>;
    };
    expect(body.stream).toBe(true);
    expect(body.messages?.[0]?.content).toContain(
      'Hosted read-only context counts as project context'
    );
    expect(body.messages?.[1]?.content).toContain('Read-only LANDroid app context (minimal)');
    expect(body.messages?.at(-1)).toEqual({ role: 'user', content: 'hello' });
  });

  it('defaults hosted requests to minimal context without project details', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    const [{ useWorkspaceStore }, { useUIStore }, { useOwnerStore }] = await Promise.all([
      import('../../store/workspace-store'),
      import('../../store/ui-store'),
      import('../../store/owner-store'),
    ]);
    session.setIdToken('id.jwt.token');
    useUIStore.setState({ view: 'chart' });
    useWorkspaceStore.setState({
      projectName: 'Vulcan Mesa - Demo',
      activeDeskMapId: 'dm-vm1',
      activeUnitCode: 'JFU',
      deskMaps: [
        {
          id: 'dm-vm1',
          name: 'Apollo Draw',
          code: 'VM1',
          tractId: 'tract-vm1',
          grossAcres: '160',
          pooledAcres: '160',
          description: '',
          unitName: 'Jupiter Flats Unit',
          unitCode: 'JFU',
          nodeIds: ['root-1', 'lease-node-1'],
        },
      ],
      nodes: [
        makeNode({
          id: 'root-1',
          grantor: 'Front State of Texas',
          grantee: 'P. T. Broncus',
          instrument: 'Patent',
          docNo: '1473-01-15',
          linkedOwnerId: 'owner-1',
        }),
        makeNode({
          id: 'lease-node-1',
          type: 'related',
          grantor: 'P. T. Broncus',
          grantee: 'Vulcan Mesa Petroleum, LLC',
          instrument: 'Oil & Gas Lease',
          parentId: 'root-1',
          fraction: '0',
          initialFraction: '0',
          linkedLeaseId: 'lease-1',
          relatedKind: 'lease',
        }),
      ],
    });
    useOwnerStore.setState({
      leases: [
        makeLease({
          id: 'lease-1',
          ownerId: 'owner-1',
          leaseName: 'Apollo Draw Lease',
          lessee: 'Vulcan Mesa Petroleum, LLC',
        }),
      ],
    });
    const fetchMock = vi.fn(async () => streamResponse(['data: [DONE]\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    await runChatTurn({ messages: [{ role: 'user', content: 'Can you see the Desk Map?' }] });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages?: Array<{ role: string; content: string }>;
    };
    const context = body.messages?.find((message) =>
      message.content.startsWith('# Read-only LANDroid app context')
    )?.content;
    expect(context).toContain('Read-only LANDroid app context (minimal)');
    expect(context).toContain('Workspace counts: 1 tract map, 2 title cards');
    expect(context).toContain('Visible card counts: 2 total');
    expect(context).not.toContain('Vulcan Mesa - Demo');
    expect(context).not.toContain('P. T. Broncus');
    expect(context).not.toContain('Vulcan Mesa Petroleum');
    expect(context).not.toContain('Apollo Draw Lease');
    expect(context).not.toContain('1/1');
  });

  it('includes full current Desk Map state only after workspace disclosure acceptance', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    const [
      { useWorkspaceStore },
      { useUIStore },
      { useOwnerStore },
      { useAISettingsStore },
    ] = await Promise.all([
      import('../../store/workspace-store'),
      import('../../store/ui-store'),
      import('../../store/owner-store'),
      import('../settings-store'),
    ]);
    session.setIdToken('id.jwt.token');
    useUIStore.setState({ view: 'chart' });
    useWorkspaceStore.setState({
      workspaceId: 'ws-hosted-full',
      projectName: 'Vulcan Mesa - Demo',
      activeDeskMapId: 'dm-vm1',
      activeUnitCode: 'JFU',
      deskMaps: [
        {
          id: 'dm-vm1',
          name: 'Apollo Draw',
          code: 'VM1',
          tractId: 'tract-vm1',
          grossAcres: '160',
          pooledAcres: '160',
          description: '',
          unitName: 'Jupiter Flats Unit',
          unitCode: 'JFU',
          nodeIds: ['root-1', 'lease-node-1'],
        },
      ],
      nodes: [
        makeNode({
          id: 'root-1',
          grantor: 'Front State of Texas',
          grantee: 'P. T. Broncus',
          instrument: 'Patent',
          docNo: '1473-01-15',
          linkedOwnerId: 'owner-1',
        }),
        makeNode({
          id: 'lease-node-1',
          type: 'related',
          grantor: 'P. T. Broncus',
          grantee: 'Vulcan Mesa Petroleum, LLC',
          instrument: 'Oil & Gas Lease',
          parentId: 'root-1',
          fraction: '0',
          initialFraction: '0',
          linkedLeaseId: 'lease-1',
          relatedKind: 'lease',
        }),
      ],
    });
    useOwnerStore.setState({
      leases: [
        makeLease({
          id: 'lease-1',
          ownerId: 'owner-1',
          leaseName: 'Apollo Draw Lease',
          lessee: 'Vulcan Mesa Petroleum, LLC',
        }),
      ],
    });
    useAISettingsStore.getState().setHostedContextMode('full');
    useAISettingsStore.getState().acceptHostedFullContextDisclosure('ws-hosted-full');
    const fetchMock = vi.fn(async () => streamResponse(['data: [DONE]\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    await runChatTurn({ messages: [{ role: 'user', content: 'Can you see the Desk Map?' }] });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      messages?: Array<{ role: string; content: string }>;
    };
    const context = body.messages?.find((message) =>
      message.content.startsWith('# Read-only LANDroid app context')
    )?.content;
    expect(context).toContain('Active view: Desk Map');
    expect(context).toContain('Project: Vulcan Mesa - Demo');
    expect(context).toContain('Active unit: Jupiter Flats Unit (JFU) (1 tract)');
    expect(context).toContain('Active tract: VM1 - Apollo Draw');
    expect(context).toContain('Visible Desk Map cards: 2');
    expect(context).toContain('Found in chain: 1/1 (100.00%)');
    expect(context).toContain('Front State of Texas -> P. T. Broncus');
    expect(context).toContain('Apollo Draw Lease to Vulcan Mesa Petroleum, LLC');
  });

  it('blocks hosted full context until the active workspace disclosure is accepted', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    const [{ useWorkspaceStore }, { useAISettingsStore }] = await Promise.all([
      import('../../store/workspace-store'),
      import('../settings-store'),
    ]);
    session.setIdToken('id.jwt.token');
    useWorkspaceStore.setState({ workspaceId: 'ws-needs-acceptance' });
    useAISettingsStore.getState().setHostedContextMode('full');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      runChatTurn({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/requires disclosure acceptance/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws before fetch when hosted auth has no ID token', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    session.setIdToken(null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      runChatTurn({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/missing a Cognito ID token/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('triggers the unauthorized handler on proxy 401s', async () => {
    const { runChatTurn, session } = await loadHostedChat();
    session.setIdToken('expired.jwt.token');
    const unauthorized = vi.fn();
    session.setUnauthorizedHandler(unauthorized);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'Invalid or expired token.' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    await expect(
      runChatTurn({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow('Invalid or expired token.');
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});

function makeNode(fields: Partial<OwnershipNode>): OwnershipNode {
  return {
    id: 'node-1',
    type: 'conveyance',
    instrument: 'Warranty Deed',
    vol: '',
    page: '',
    docNo: '',
    fileDate: '',
    date: '',
    grantor: '',
    grantee: '',
    landDesc: '',
    remarks: '',
    fraction: '1',
    initialFraction: '1',
    parentId: null,
    conveyanceMode: 'all',
    splitBasis: 'initial',
    numerator: '1',
    denominator: '1',
    manualAmount: '',
    isDeceased: false,
    obituary: '',
    graveyardLink: '',
    attachments: [],
    linkedOwnerId: null,
    linkedLeaseId: null,
    relatedKind: null,
    interestClass: 'mineral',
    royaltyKind: null,
    fixedRoyaltyBasis: null,
    depthRange: 'all_depths',
    isCollapsed: false,
    ...fields,
  };
}

function makeLease(fields: Partial<Lease>): Lease {
  return {
    id: 'lease-1',
    workspaceId: 'workspace-1',
    ownerId: 'owner-1',
    leaseName: 'Lease',
    lessee: 'Lessee',
    royaltyRate: '1/4',
    leasedInterest: '1',
    effectiveDate: '2026-01-01',
    expirationDate: '',
    status: 'Active',
    docNo: '',
    notes: '',
    jurisdiction: 'tx_fee',
    depthRange: 'all_depths',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...fields,
  };
}
