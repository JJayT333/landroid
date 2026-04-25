import { describe, expect, it } from 'vitest';
import type { DeskMap } from '../../types/node';
import {
  filterDeskMapsByUnitCode,
  generateUniqueUnitCode,
  getDeskMapUnitOptions,
  resolveActiveUnitCode,
} from '../desk-map-units';

function deskMap(fields: Partial<DeskMap> & Pick<DeskMap, 'id'>): DeskMap {
  return {
    id: fields.id,
    name: fields.name ?? fields.id,
    code: fields.code ?? fields.id,
    tractId: fields.tractId ?? null,
    grossAcres: fields.grossAcres ?? '',
    pooledAcres: fields.pooledAcres ?? '',
    description: fields.description ?? '',
    nodeIds: fields.nodeIds ?? [],
    unitName: fields.unitName,
    unitCode: fields.unitCode,
  };
}

describe('desk-map-units', () => {
  it('builds ordered unit options from desk map unit tags', () => {
    const options = getDeskMapUnitOptions([
      deskMap({ id: 'a-1', unitName: 'Raven Forest Unit A', unitCode: 'A' }),
      deskMap({ id: 'b-1', unitName: 'Raven Forest Unit B', unitCode: 'B' }),
      deskMap({ id: 'a-2', unitName: 'Raven Forest Unit A', unitCode: 'A' }),
      deskMap({ id: 'loose' }),
    ]);

    expect(options).toEqual([
      {
        unitCode: 'A',
        unitName: 'Raven Forest Unit A',
        deskMapIds: ['a-1', 'a-2'],
        tractCount: 2,
      },
      {
        unitCode: 'B',
        unitName: 'Raven Forest Unit B',
        deskMapIds: ['b-1'],
        tractCount: 1,
      },
    ]);
  });

  it('resolves active unit from preference, active desk map, then first unit', () => {
    const deskMaps = [
      deskMap({ id: 'a-1', unitName: 'Raven Forest Unit A', unitCode: 'A' }),
      deskMap({ id: 'b-1', unitName: 'Raven Forest Unit B', unitCode: 'B' }),
    ];

    expect(resolveActiveUnitCode(deskMaps, 'B', 'a-1')).toBe('B');
    expect(resolveActiveUnitCode(deskMaps, 'missing', 'b-1')).toBe('B');
    expect(resolveActiveUnitCode(deskMaps, null, null)).toBe('A');
  });

  it('filters by selected unit and generates expandable codes', () => {
    const deskMaps = [
      deskMap({ id: 'a-1', unitCode: 'A' }),
      deskMap({ id: 'b-1', unitCode: 'B' }),
    ];

    expect(filterDeskMapsByUnitCode(deskMaps, 'B').map((item) => item.id)).toEqual([
      'b-1',
    ]);
    expect(generateUniqueUnitCode('Raven Forest Unit C', ['A', 'B'])).toBe('C');
  });
});
