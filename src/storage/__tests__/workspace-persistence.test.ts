import { describe, expect, it } from 'vitest';
import type { CanvasSaveData } from '../../store/canvas-store';
import { createBlankNode } from '../../types/node';
import {
  exportLandroidFile,
  importLandroidFile,
  type LandroidFileData,
} from '../workspace-persistence';

function buildCanvas(): CanvasSaveData {
  return {
    nodes: [
      {
        id: 'flow-root',
        type: 'ownership',
        position: { x: 100, y: 40 },
        data: { label: 'Root' },
      },
    ],
    edges: [],
    viewport: { x: 12, y: 24, zoom: 0.75 },
    gridCols: 6,
    gridRows: 3,
    orientation: 'portrait',
    pageSize: 'ansi-b',
    horizontalSpacingFactor: 1.5,
    verticalSpacingFactor: 1.25,
    snapToGrid: true,
    gridSize: 24,
  };
}

function buildWorkspace(canvas: CanvasSaveData | null): LandroidFileData {
  return {
    projectName: 'Audit Roundtrip',
    nodes: [createBlankNode('node-1')],
    deskMaps: [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: 'T1',
        nodeIds: ['node-1'],
      },
    ],
    activeDeskMapId: 'dm-1',
    instrumentTypes: ['Deed'],
    canvas,
  };
}

describe('workspace-persistence', () => {
  it('round-trips canvas state through .landroid export/import', async () => {
    const original = buildWorkspace(buildCanvas());
    const blob = exportLandroidFile(original);
    const file = new File([await blob.text()], 'audit.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.projectName).toBe(original.projectName);
    expect(imported.nodes).toEqual(original.nodes);
    expect(imported.deskMaps).toEqual(original.deskMaps);
    expect(imported.canvas).toEqual(original.canvas);
  });

  it('keeps backward compatibility when older files omit canvas state', async () => {
    const legacyPayload = {
      version: 1,
      projectName: 'Legacy Workspace',
      nodes: [createBlankNode('node-1')],
      deskMaps: [],
      activeDeskMapId: null,
      instrumentTypes: ['Deed'],
    };
    const file = new File([JSON.stringify(legacyPayload)], 'legacy.landroid', {
      type: 'application/json',
    });

    const imported = await importLandroidFile(file);

    expect(imported.projectName).toBe('Legacy Workspace');
    expect(imported.canvas).toBeNull();
  });
});
