import { describe, expect, it } from 'vitest';
import {
  createBlankResearchFormula,
  createBlankResearchProjectRecord,
  createBlankResearchQuestion,
  createBlankResearchSource,
  normalizeResearchFormula,
  normalizeResearchProjectRecord,
  normalizeResearchQuestion,
  normalizeResearchSource,
  sanitizeResearchLinks,
} from '../research';

describe('research types', () => {
  it('normalizes invalid enum values to safe source-of-truth defaults', () => {
    expect(
      normalizeResearchSource({
        id: 'source-1',
        workspaceId: 'ws-1',
        title: '  Source  ',
        sourceType: 'Bad Type' as never,
        context: 'Bad Context' as never,
      })
    ).toMatchObject({
      title: 'Source',
      sourceType: 'Project Note',
      context: 'General',
    });

    expect(
      normalizeResearchFormula({
        id: 'formula-1',
        workspaceId: 'ws-1',
        category: 'Bad Category' as never,
        status: 'Bad Status' as never,
      })
    ).toMatchObject({ category: 'Ownership', status: 'Draft' });

    expect(
      normalizeResearchProjectRecord({
        id: 'project-1',
        workspaceId: 'ws-1',
        recordType: 'Bad Record' as never,
        jurisdiction: 'Bad Jurisdiction' as never,
        status: 'Bad Status' as never,
      })
    ).toMatchObject({
      recordType: 'Federal Lease',
      jurisdiction: 'Federal / BLM',
      status: 'Under Review',
    });

    expect(
      normalizeResearchQuestion({
        id: 'question-1',
        workspaceId: 'ws-1',
        status: 'Bad Status' as never,
      })
    ).toMatchObject({ status: 'Draft' });
  });

  it('clears stale cross-record and app-object links', () => {
    const source = createBlankResearchSource('ws-1', {
      id: 'source-1',
      links: {
        deskMapId: 'missing-dm',
        nodeId: 'node-1',
        ownerId: 'owner-1',
        leaseId: 'missing-lease',
        mapAssetId: 'map-1',
        mapRegionId: 'missing-region',
        importId: 'import-1',
      },
    });
    const formula = createBlankResearchFormula('ws-1', {
      id: 'formula-1',
      sourceIds: ['source-1', 'missing-source'],
    });
    const projectRecord = createBlankResearchProjectRecord('ws-1', {
      id: 'project-1',
      sourceIds: ['source-1', 'missing-source'],
      mapAssetId: 'map-1',
      mapRegionId: 'missing-region',
    });
    const question = createBlankResearchQuestion('ws-1', {
      id: 'question-1',
      sourceIds: ['source-1', 'missing-source'],
      formulaIds: ['formula-1', 'missing-formula'],
      projectRecordIds: ['project-1', 'missing-project'],
    });

    const sanitized = sanitizeResearchLinks(
      {
        sources: [source],
        formulas: [formula],
        projectRecords: [projectRecord],
        questions: [question],
      },
      {
        deskMapIds: new Set(),
        nodeIds: new Set(['node-1']),
        ownerIds: new Set(['owner-1']),
        leaseIds: new Set(),
        mapAssetIds: new Set(['map-1']),
        mapRegionIds: new Set(),
        importIds: new Set(['import-1']),
        sourceIds: new Set(['source-1']),
        formulaIds: new Set(['formula-1']),
        projectRecordIds: new Set(['project-1']),
      }
    );

    expect(sanitized.sources[0]?.links).toEqual({
      deskMapId: null,
      nodeId: 'node-1',
      ownerId: 'owner-1',
      leaseId: null,
      mapAssetId: 'map-1',
      mapRegionId: null,
      importId: 'import-1',
    });
    expect(sanitized.formulas[0]?.sourceIds).toEqual(['source-1']);
    expect(sanitized.projectRecords[0]?.sourceIds).toEqual(['source-1']);
    expect(sanitized.projectRecords[0]?.mapAssetId).toBe('map-1');
    expect(sanitized.projectRecords[0]?.mapRegionId).toBeNull();
    expect(sanitized.questions[0]?.formulaIds).toEqual(['formula-1']);
    expect(sanitized.questions[0]?.projectRecordIds).toEqual(['project-1']);
  });
});
