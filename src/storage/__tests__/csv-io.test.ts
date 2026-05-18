import { describe, expect, it } from 'vitest';
import { importCSV } from '../csv-io';

interface RawNodeFixture {
  id: string;
  parentId: string | null;
  type: 'conveyance' | 'related';
  fraction: number | string;
  initialFraction: number | string;
  instrument?: string;
  grantee?: string;
  landDesc?: string;
}

function buildCsvFromNodes(nodes: RawNodeFixture[]): string {
  const deskMaps = [
    {
      id: 'dm-1',
      name: 'Imported Tract',
      code: 'T1',
      tractId: 'T1',
      grossAcres: '160',
      pooledAcres: '120',
      description: 'Imported tract description',
      nodes,
    },
  ];
  const encodedDeskMaps = JSON.stringify(deskMaps).replace(/"/g, '""');
  const body = nodes
    .map(
      (n) =>
        `"${n.id}","${n.parentId ?? ''}","${n.type}","${n.fraction}","${n.initialFraction}","${encodedDeskMaps}","dm-1"`
    )
    .join('\n');
  return [
    'INTERNAL_ID,INTERNAL_PID,INTERNAL_TYPE,INTERNAL_REMAINING_FRACTION,INTERNAL_INITIAL_FRACTION,INTERNAL_DESKMAPS,INTERNAL_ACTIVE_DESKMAP_ID',
    body,
  ].join('\n');
}

function buildCsv() {
  return buildCsvFromNodes([
    {
      id: 'root-1',
      parentId: null,
      type: 'conveyance',
      fraction: 1,
      initialFraction: 1,
      instrument: 'Patent',
      grantee: 'Root Owner',
      landDesc: 'Section 1',
    },
  ]);
}

describe('csv-io', () => {
  it('creates a fresh workspace id for imported CSV workspaces', () => {
    const first = importCSV(buildCsv());
    const second = importCSV(buildCsv());

    expect(first.workspaceId).toBeTruthy();
    expect(second.workspaceId).toBeTruthy();
    expect(first.workspaceId).not.toBe(second.workspaceId);
    expect(first.nodes[0]?.linkedOwnerId).toBeNull();
    expect(first.deskMaps[0]?.pooledAcres).toBe('120');
    expect(first.leaseholdAssignments).toEqual([]);
    expect(first.leaseholdOrris).toEqual([]);
    expect(first.leaseholdTransferOrderEntries).toEqual([]);
  });

  it('rejects duplicate node IDs instead of silently dropping (audit M4)', () => {
    const csv = buildCsvFromNodes([
      {
        id: 'root-1',
        parentId: null,
        type: 'conveyance',
        fraction: 1,
        initialFraction: 1,
        instrument: 'Patent',
        grantee: 'Root Owner',
      },
      {
        id: 'root-1',
        parentId: null,
        type: 'conveyance',
        fraction: 0.5,
        initialFraction: 0.5,
        instrument: 'Deed',
        grantee: 'Colliding Duplicate',
      },
    ]);
    expect(() => importCSV(csv)).toThrow(/duplicate node IDs/i);
  });

  it('rejects invalid fraction values instead of coercing to 0 (audit M4)', () => {
    const csv = buildCsvFromNodes([
      {
        id: 'root-1',
        parentId: null,
        type: 'conveyance',
        fraction: 'not-a-number',
        initialFraction: 1,
        instrument: 'Patent',
        grantee: 'Broken Fraction',
      },
    ]);
    expect(() => importCSV(csv)).toThrow(/invalid fraction/i);
  });

  it('rejects negative fractions (audit M4)', () => {
    const csv = buildCsvFromNodes([
      {
        id: 'root-1',
        parentId: null,
        type: 'conveyance',
        fraction: -0.5,
        initialFraction: 1,
        instrument: 'Patent',
        grantee: 'Negative Fraction',
      },
    ]);
    expect(() => importCSV(csv)).toThrow(/invalid fraction/i);
  });

  it('accepts fraction literals like "1/2" (audit M4)', () => {
    const csv = buildCsvFromNodes([
      {
        id: 'root-1',
        parentId: null,
        type: 'conveyance',
        fraction: '1/2',
        initialFraction: '1/2',
        instrument: 'Patent',
        grantee: 'Half Owner',
      },
    ]);
    const result = importCSV(csv);
    expect(result.nodes[0]?.fraction).toBe('0.500000000');
  });
});
