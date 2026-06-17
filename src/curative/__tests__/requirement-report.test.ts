import { describe, expect, it } from 'vitest';
import { buildCurativeRequirementReport } from '../requirement-report';
import { createBlankTitleIssue, type TitleIssue } from '../../types/title-issue';
import { createBlankNode, type DeskMap, type OwnershipNode } from '../../types/node';
import {
  createBlankLease,
  createBlankOwner,
  type Lease,
  type Owner,
} from '../../types/owner';

const WS = 'ws-report';

function ctx() {
  const deskMaps: DeskMap[] = [
    {
      id: 'dm-1',
      name: 'Tract One',
      code: 'T1',
      tractId: null,
      grossAcres: '',
      pooledAcres: '',
      description: '',
      nodeIds: ['n1'],
    } as DeskMap,
  ];
  const nodes: OwnershipNode[] = [
    { ...createBlankNode('n1'), grantee: 'Heir A', interestClass: 'mineral' },
  ];
  const owners: Owner[] = [createBlankOwner(WS, { id: 'o1', name: 'Acme Minerals' })];
  const leases: Lease[] = [
    createBlankLease(WS, 'o1', {
      id: 'l1',
      leaseName: 'Lease X',
      lessee: 'Operator',
      docNo: '123',
    }),
  ];
  return { deskMaps, nodes, owners, leases };
}

function issue(overrides: Partial<TitleIssue>): TitleIssue {
  return createBlankTitleIssue(WS, { priority: 'Medium', status: 'Open', ...overrides });
}

describe('buildCurativeRequirementReport', () => {
  it('numbers requirements in order and resolves affected entities to labels', () => {
    const report = buildCurativeRequirementReport(
      [
        issue({
          id: 'i1',
          title: 'Cure the heirship',
          issueType: 'Probate / heirship',
          priority: 'Critical',
          status: 'Open',
          affectedDeskMapId: 'dm-1',
          affectedNodeId: 'n1',
          requiredCurativeAction: 'Obtain affidavit of heirship',
          responsibleParty: 'Counsel',
          dueDate: '2026-07-01',
        }),
        issue({ id: 'i2', title: 'Missing lease', priority: 'High', status: 'Open', affectedOwnerId: 'o1' }),
        issue({
          id: 'i3',
          title: 'Lien release',
          status: 'Resolved',
          affectedLeaseId: 'l1',
          resolutionNotes: 'Released 2026-06',
        }),
      ],
      ctx()
    );

    expect(report.totalCount).toBe(3);
    expect(report.openCount).toBe(2);
    expect(report.criticalOpenCount).toBe(1);

    const [first, second, third] = report.requirements;
    expect(first.number).toBe(1);
    expect(first.title).toBe('Cure the heirship');
    expect(first.isOpen).toBe(true);
    expect(first.affected).toEqual(['Tract: T1 • Tract One', 'Branch: Heir A (Mineral)']);
    expect(first.requiredCurativeAction).toBe('Obtain affidavit of heirship');

    expect(second.number).toBe(2);
    expect(second.affected).toEqual(['Owner: Acme Minerals']);

    expect(third.number).toBe(3);
    expect(third.isOpen).toBe(false);
    expect(third.affected).toEqual(['Lease: Lease X • Operator • 123']);
    expect(third.resolutionNotes).toBe('Released 2026-06');
  });

  it('falls back to "Untitled requirement" for a blank title and reports no affected links when unlinked', () => {
    const report = buildCurativeRequirementReport(
      [issue({ id: 'x', title: '   ' })],
      ctx()
    );
    expect(report.requirements[0].title).toBe('Untitled requirement');
    expect(report.requirements[0].affected).toEqual([]);
  });

  it('resolves a dangling reference to its "Unlinked …" label rather than throwing', () => {
    const report = buildCurativeRequirementReport(
      [issue({ id: 'd', affectedDeskMapId: 'gone', affectedOwnerId: 'gone' })],
      ctx()
    );
    expect(report.requirements[0].affected).toEqual(['Tract: Unlinked tract', 'Owner: Unlinked owner']);
  });
});
