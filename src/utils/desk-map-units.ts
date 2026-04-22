import type { DeskMap } from '../types/node';

export interface DeskMapUnitOption {
  unitCode: string;
  unitName: string;
  deskMapIds: string[];
  tractCount: number;
}

function normalizeUnitCodeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function getDeskMapUnitOptions(deskMaps: DeskMap[]): DeskMapUnitOption[] {
  const order: string[] = [];
  const byCode = new Map<string, { unitName: string; deskMapIds: string[] }>();

  for (const deskMap of deskMaps) {
    const unitCode = normalizeUnitCodeText(deskMap.unitCode);
    if (!unitCode) continue;

    if (!byCode.has(unitCode)) {
      order.push(unitCode);
      byCode.set(unitCode, {
        unitName: deskMap.unitName?.trim() || `Unit ${unitCode}`,
        deskMapIds: [],
      });
    }

    const group = byCode.get(unitCode)!;
    if (!group.unitName && deskMap.unitName?.trim()) {
      group.unitName = deskMap.unitName.trim();
    }
    group.deskMapIds.push(deskMap.id);
  }

  return order.map((unitCode) => {
    const group = byCode.get(unitCode)!;
    return {
      unitCode,
      unitName: group.unitName || `Unit ${unitCode}`,
      deskMapIds: group.deskMapIds,
      tractCount: group.deskMapIds.length,
    };
  });
}

export function resolveActiveUnitCode(
  deskMaps: DeskMap[],
  preferredUnitCode: string | null | undefined,
  activeDeskMapId?: string | null
): string | null {
  const options = getDeskMapUnitOptions(deskMaps);
  if (options.length === 0) {
    return null;
  }

  const preferred = normalizeUnitCodeText(preferredUnitCode);
  if (preferred && options.some((option) => option.unitCode === preferred)) {
    return preferred;
  }

  const activeDeskMap = activeDeskMapId
    ? deskMaps.find((deskMap) => deskMap.id === activeDeskMapId) ?? null
    : null;
  const activeUnitCode = normalizeUnitCodeText(activeDeskMap?.unitCode);
  if (activeUnitCode && options.some((option) => option.unitCode === activeUnitCode)) {
    return activeUnitCode;
  }

  return options[0]?.unitCode ?? null;
}

export function filterDeskMapsByUnitCode(
  deskMaps: DeskMap[],
  unitCode: string | null | undefined
): DeskMap[] {
  const normalizedUnitCode = normalizeUnitCodeText(unitCode);
  if (!normalizedUnitCode) {
    return deskMaps;
  }
  return deskMaps.filter((deskMap) => deskMap.unitCode === normalizedUnitCode);
}

export function findUnitOption(
  deskMaps: DeskMap[],
  unitCode: string | null | undefined
): DeskMapUnitOption | null {
  const normalizedUnitCode = normalizeUnitCodeText(unitCode);
  if (!normalizedUnitCode) {
    return null;
  }
  return (
    getDeskMapUnitOptions(deskMaps).find(
      (option) => option.unitCode === normalizedUnitCode
    ) ?? null
  );
}

export function makeUnitOptionLabel(option: DeskMapUnitOption): string {
  return option.unitName === `Unit ${option.unitCode}`
    ? option.unitName
    : `${option.unitName} (${option.unitCode})`;
}

export function generateUniqueUnitCode(
  unitName: string,
  existingUnitCodes: Iterable<string>
): string {
  const existing = new Set([...existingUnitCodes].map((code) => code.trim()));
  const trimmedName = unitName.trim();
  const unitSuffix = trimmedName.match(/\bunit\s+([A-Za-z0-9][A-Za-z0-9-]*)\b/i)?.[1];
  const acronym = trimmedName
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, '').charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase();
  const candidates = [
    unitSuffix?.toUpperCase(),
    acronym,
    `U${existing.size + 1}`,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  const base = candidates[0] ?? 'UNIT';
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
