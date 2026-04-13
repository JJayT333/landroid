import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBlankResearchFormula,
  createBlankResearchImport,
  createBlankResearchProjectRecord,
  createBlankResearchQuestion,
  createBlankResearchSource,
} from '../../types/research';

const mocks = vi.hoisted(() => ({
  loadResearchWorkspaceData: vi.fn(),
  replaceResearchWorkspaceData: vi.fn(),
  saveResearchImport: vi.fn(),
  deleteResearchImport: vi.fn(),
  saveResearchSource: vi.fn(),
  deleteResearchSource: vi.fn(),
  saveResearchFormula: vi.fn(),
  deleteResearchFormula: vi.fn(),
  saveResearchProjectRecord: vi.fn(),
  deleteResearchProjectRecord: vi.fn(),
  saveResearchQuestion: vi.fn(),
  deleteResearchQuestion: vi.fn(),
  normalizeResearchWorkspaceData: vi.fn((_workspaceId, data) => ({
    imports: data.imports ?? [],
    sources: data.sources ?? [],
    formulas: data.formulas ?? [],
    projectRecords: data.projectRecords ?? [],
    questions: data.questions ?? [],
  })),
}));

vi.mock('../../storage/research-persistence', () => ({
  loadResearchWorkspaceData: mocks.loadResearchWorkspaceData,
  replaceResearchWorkspaceData: mocks.replaceResearchWorkspaceData,
  saveResearchImport: mocks.saveResearchImport,
  deleteResearchImport: mocks.deleteResearchImport,
  saveResearchSource: mocks.saveResearchSource,
  deleteResearchSource: mocks.deleteResearchSource,
  saveResearchFormula: mocks.saveResearchFormula,
  deleteResearchFormula: mocks.deleteResearchFormula,
  saveResearchProjectRecord: mocks.saveResearchProjectRecord,
  deleteResearchProjectRecord: mocks.deleteResearchProjectRecord,
  saveResearchQuestion: mocks.saveResearchQuestion,
  deleteResearchQuestion: mocks.deleteResearchQuestion,
  normalizeResearchWorkspaceData: mocks.normalizeResearchWorkspaceData,
}));

import { useResearchStore } from '../research-store';

describe('research-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useResearchStore.setState({
      workspaceId: null,
      imports: [],
      sources: [],
      formulas: [],
      projectRecords: [],
      questions: [],
      _hydrated: false,
    });
  });

  it('loads workspace-scoped research imports', async () => {
    const researchImport = createBlankResearchImport(
      'ws-a',
      new Blob(['api,data'], { type: 'text/csv' }),
      {
        fileName: 'production.csv',
        mimeType: 'text/csv',
        datasetId: 'production-data-query-dump',
        overrides: { id: 'rrc-1', title: 'Production Dump' },
      }
    );
    mocks.loadResearchWorkspaceData.mockResolvedValueOnce({
      imports: [researchImport],
      sources: [],
      formulas: [],
      projectRecords: [],
      questions: [],
    });

    await useResearchStore.getState().setWorkspace('ws-a');

    expect(useResearchStore.getState().workspaceId).toBe('ws-a');
    expect(useResearchStore.getState().imports[0]?.id).toBe('rrc-1');
  });

  it('stores imports in the active workspace and removes them cleanly', async () => {
    const researchImport = createBlankResearchImport(
      'wrong-ws',
      new Blob(['{}'], { type: 'application/json' }),
      {
        fileName: 'skim.json',
        mimeType: 'application/json',
        datasetId: 'p18-skim-report',
        overrides: { id: 'rrc-2', title: 'Skim Report' },
      }
    );
    mocks.saveResearchImport.mockResolvedValue(undefined);
    mocks.deleteResearchImport.mockResolvedValue(undefined);
    useResearchStore.setState({ workspaceId: 'ws-active' });

    await useResearchStore.getState().addImport(researchImport);

    expect(mocks.saveResearchImport).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rrc-2',
        workspaceId: 'ws-active',
      })
    );
    expect(useResearchStore.getState().imports[0]?.workspaceId).toBe('ws-active');

    await useResearchStore.getState().removeImport('rrc-2');

    expect(mocks.deleteResearchImport).toHaveBeenCalledWith('rrc-2');
    expect(useResearchStore.getState().imports).toEqual([]);
  });

  it('stores source-of-truth records in the active workspace', async () => {
    mocks.saveResearchSource.mockResolvedValue(undefined);
    mocks.saveResearchFormula.mockResolvedValue(undefined);
    mocks.saveResearchProjectRecord.mockResolvedValue(undefined);
    mocks.saveResearchQuestion.mockResolvedValue(undefined);
    useResearchStore.setState({ workspaceId: 'ws-active' });

    const source = createBlankResearchSource('wrong-ws', {
      id: 'source-1',
      title: 'Division order statute',
    });
    const formula = createBlankResearchFormula('wrong-ws', {
      id: 'formula-1',
      title: 'NRI',
    });
    const projectRecord = createBlankResearchProjectRecord('wrong-ws', {
      id: 'project-1',
      name: 'Federal Lease NMNM 000000',
    });
    const question = createBlankResearchQuestion('wrong-ws', {
      id: 'question-1',
      question: 'What source supports this formula?',
    });

    await useResearchStore.getState().addSource(source);
    await useResearchStore.getState().addFormula(formula);
    await useResearchStore.getState().addProjectRecord(projectRecord);
    await useResearchStore.getState().addQuestion(question);

    expect(useResearchStore.getState().sources[0]?.workspaceId).toBe('ws-active');
    expect(useResearchStore.getState().formulas[0]?.workspaceId).toBe('ws-active');
    expect(useResearchStore.getState().projectRecords[0]?.workspaceId).toBe('ws-active');
    expect(useResearchStore.getState().questions[0]?.workspaceId).toBe('ws-active');
  });
});
