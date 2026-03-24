import type { PageOrientation, PageSizeId } from '../types/flowchart';

const DPI = 96;

interface PageSizeDefinition {
  id: PageSizeId;
  label: string;
  widthIn: number;
  heightIn: number;
}

export const DEFAULT_PAGE_SIZE: PageSizeId = 'ansi-a';

export const PAGE_SIZE_DEFINITIONS: PageSizeDefinition[] = [
  { id: 'ansi-a', label: 'ANSI A (Letter)', widthIn: 8.5, heightIn: 11 },
  { id: 'ansi-b', label: 'ANSI B (Tabloid/Ledger)', widthIn: 11, heightIn: 17 },
  { id: 'ansi-c', label: 'ANSI C', widthIn: 17, heightIn: 22 },
  { id: 'ansi-d', label: 'ANSI D', widthIn: 22, heightIn: 34 },
  { id: 'ansi-e', label: 'ANSI E', widthIn: 34, heightIn: 44 },
  { id: 'arch-a', label: 'Arch A', widthIn: 9, heightIn: 12 },
  { id: 'arch-b', label: 'Arch B', widthIn: 12, heightIn: 18 },
  { id: 'arch-c', label: 'Arch C', widthIn: 18, heightIn: 24 },
  { id: 'arch-d', label: 'Arch D', widthIn: 24, heightIn: 36 },
  { id: 'arch-e1', label: 'Arch E1', widthIn: 30, heightIn: 42 },
  { id: 'arch-e', label: 'Arch E', widthIn: 36, heightIn: 48 },
];

export function getPageSizeDefinition(pageSize: PageSizeId): PageSizeDefinition {
  return (
    PAGE_SIZE_DEFINITIONS.find((definition) => definition.id === pageSize) ??
    PAGE_SIZE_DEFINITIONS[0]
  );
}

function formatInches(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function getPageSizeOptionLabel(pageSize: PageSizeId) {
  const definition = getPageSizeDefinition(pageSize);
  return `${definition.label} - ${formatInches(definition.widthIn)}" x ${formatInches(definition.heightIn)}"`;
}

export function getPageDimensions(pageSize: PageSizeId, orientation: PageOrientation) {
  const definition = getPageSizeDefinition(pageSize);
  const baseWidth = definition.widthIn * DPI;
  const baseHeight = definition.heightIn * DPI;

  if (orientation === 'landscape') {
    return {
      pw: Math.max(baseWidth, baseHeight),
      ph: Math.min(baseWidth, baseHeight),
      widthIn: Math.max(definition.widthIn, definition.heightIn),
      heightIn: Math.min(definition.widthIn, definition.heightIn),
    };
  }

  return {
    pw: Math.min(baseWidth, baseHeight),
    ph: Math.max(baseWidth, baseHeight),
    widthIn: Math.min(definition.widthIn, definition.heightIn),
    heightIn: Math.max(definition.widthIn, definition.heightIn),
  };
}

export function getPrintPageSize(pageSize: PageSizeId, orientation: PageOrientation) {
  const { widthIn, heightIn } = getPageDimensions(pageSize, orientation);
  return `${widthIn}in ${heightIn}in`;
}
