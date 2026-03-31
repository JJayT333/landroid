import { describe, expect, it } from 'vitest';
import type { Node, Edge } from '@xyflow/react';
import { createBlankNode } from '../../types/node';
import {
  buildCanvasAutosavePayload,
  buildWorkspaceAutosavePayload,
  canvasAutosaveStateChanged,
  captureCanvasAutosaveSnapshot,
  captureWorkspaceAutosaveSnapshot,
  workspaceAutosaveStateChanged,
} from '../autosave-change-detection';

describe('autosave-change-detection', () => {
  it('treats unchanged workspace references as no-op autosave state', () => {
    const nodes = [
      {
        ...createBlankNode('node-1', null),
        grantee: 'Root',
        initialFraction: '1.000000000',
        fraction: '1.000000000',
        numerator: '1',
      },
    ];
    const deskMaps = [
      {
        id: 'dm-1',
        name: 'Tract 1',
        code: 'T1',
        tractId: null,
        grossAcres: '',
        pooledAcres: '',
        description: '',
        nodeIds: ['node-1'],
      },
    ];
    const state = {
      workspaceId: 'ws-1',
      projectName: 'Demo',
      nodes,
      deskMaps,
      leaseholdUnit: {
        name: 'Raven Bend Unit',
        description: 'Unit description',
        operator: 'Operator A',
        effectiveDate: '2024-01-01',
      },
      leaseholdAssignments: [
        {
          id: 'assignment-1',
          assignor: 'Operator A',
          assignee: 'Unit Partner',
          scope: 'unit' as const,
          deskMapId: null,
          workingInterestFraction: '1/2',
          effectiveDate: '2024-03-01',
          sourceDocNo: 'ASG-1',
          notes: '',
        },
      ],
      leaseholdOrris: [
        {
          id: 'orri-1',
          payee: 'Override Partners',
          scope: 'unit' as const,
          deskMapId: null,
          burdenFraction: '1/32',
          burdenBasis: 'gross_8_8' as const,
          effectiveDate: '2024-02-01',
          sourceDocNo: 'ORRI-1',
          notes: '',
        },
      ],
      leaseholdTransferOrderEntries: [
        {
          id: 'to-1',
          sourceRowId: 'royalty-dm-1-node-1',
          ownerNumber: '001',
          status: 'ready' as const,
          notes: 'Ready for payout setup',
        },
      ],
      activeDeskMapId: 'dm-1',
      instrumentTypes: ['Deed'],
    };

    const snapshot = captureWorkspaceAutosaveSnapshot(state);

    expect(workspaceAutosaveStateChanged(snapshot, state)).toBe(false);
    expect(
      workspaceAutosaveStateChanged(snapshot, {
        ...state,
        nodes: [...nodes],
      })
    ).toBe(true);
    expect(
      workspaceAutosaveStateChanged(snapshot, {
        ...state,
        leaseholdAssignments: [...state.leaseholdAssignments],
      })
    ).toBe(true);
    expect(
      workspaceAutosaveStateChanged(snapshot, {
        ...state,
        leaseholdOrris: [...state.leaseholdOrris],
      })
    ).toBe(true);
    expect(
      workspaceAutosaveStateChanged(snapshot, {
        ...state,
        leaseholdTransferOrderEntries: [...state.leaseholdTransferOrderEntries],
      })
    ).toBe(true);
    expect(buildWorkspaceAutosavePayload(state)).toEqual(state);
  });

  it('tracks canvas autosave changes by references and persisted primitives', () => {
    const nodes: Node[] = [
      {
        id: 'n1',
        type: 'ownership',
        position: { x: 0, y: 0 },
        data: {},
      },
    ];
    const edges: Edge[] = [
      {
        id: 'e1',
        source: 'n1',
        target: 'n1',
      },
    ];
    const state = {
      nodes,
      edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      gridCols: 4,
      gridRows: 2,
      orientation: 'landscape' as const,
      pageSize: 'ansi-a' as const,
      horizontalSpacingFactor: 1,
      verticalSpacingFactor: 1,
      snapToGrid: false,
      gridSize: 20,
    };

    const snapshot = captureCanvasAutosaveSnapshot(state);

    expect(canvasAutosaveStateChanged(snapshot, state)).toBe(false);
    expect(
      canvasAutosaveStateChanged(snapshot, {
        ...state,
        viewport: { x: 10, y: 0, zoom: 1 },
      })
    ).toBe(true);
    expect(
      canvasAutosaveStateChanged(snapshot, {
        ...state,
        nodes: [...nodes],
      })
    ).toBe(true);
    expect(buildCanvasAutosavePayload(state)).toEqual(state);
  });
});
