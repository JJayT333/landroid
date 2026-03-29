import { describe, expect, it } from 'vitest';
import { importCSV } from '../csv-io';

function buildCsv() {
  const deskMaps = [
    {
      id: 'dm-1',
      name: 'Imported Tract',
      code: 'T1',
      tractId: 'T1',
      nodes: [
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
      ],
    },
  ];
  const encodedDeskMaps = JSON.stringify(deskMaps).replace(/"/g, '""');

  return [
    'INTERNAL_ID,INTERNAL_PID,INTERNAL_TYPE,INTERNAL_REMAINING_FRACTION,INTERNAL_INITIAL_FRACTION,INTERNAL_DESKMAPS,INTERNAL_ACTIVE_DESKMAP_ID',
    `"root-1","","conveyance","1","1","${encodedDeskMaps}","dm-1"`,
  ].join('\n');
}

describe('csv-io', () => {
  it('creates a fresh workspace id for imported CSV workspaces', () => {
    const first = importCSV(buildCsv());
    const second = importCSV(buildCsv());

    expect(first.workspaceId).toBeTruthy();
    expect(second.workspaceId).toBeTruthy();
    expect(first.workspaceId).not.toBe(second.workspaceId);
    expect(first.nodes[0]?.linkedOwnerId).toBeNull();
  });
});
