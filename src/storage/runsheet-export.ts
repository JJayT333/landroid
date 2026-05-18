import type { OwnershipNode } from '../types/node';

const CSV_MIME_TYPE = 'text/csv;charset=utf-8';

const RUNSHEET_HEADERS = [
  'Documents Hyperlinked to TORS_Documents Folder',
  'Instrument',
  'Order by Date',
  'Image Path',
  'Vol',
  'Page',
  'Instrument No.\nSan Jacinto',
  'File Date',
  'Inst./Eff. Date',
  'Grantor/Assignor / Lessor',
  'Grantee/Assignee / Lessee',
  'Land Desc.',
  'Remarks',
] as const;

function buildImagePath(node: OwnershipNode) {
  const docNo = node.docNo.trim();
  // Phase 5: a node "has a document" when its v8 attachments[] is
  // non-empty. The legacy `hasDoc` flag was dropped in A4c.
  return node.attachments.length > 0 && docNo ? `TORS_Documents\\${docNo}.pdf` : '';
}

function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ');
}

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildRunsheetRows(nodes: OwnershipNode[]) {
  return [
    [...RUNSHEET_HEADERS],
    ...nodes.map((node, index) => [
      index + 1,
      node.instrument || '',
      index + 1,
      buildImagePath(node),
      node.vol || '',
      node.page || '',
      node.docNo || '',
      node.fileDate || '',
      node.date || '',
      node.grantor || '',
      node.grantee || '',
      node.landDesc || '',
      node.remarks || '',
    ]),
  ];
}

export function buildRunsheetCsv(nodes: OwnershipNode[]) {
  return buildRunsheetRows(nodes)
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
}

export function buildRunsheetDownloadName(
  projectName: string,
  tractLabel?: string | null
) {
  const parts = [
    sanitizeFileNamePart(projectName || 'workspace'),
    tractLabel ? sanitizeFileNamePart(tractLabel) : '',
    'runsheet',
  ].filter(Boolean);

  return `${parts.join('-')}.csv`;
}

export function exportRunsheetCsv(nodes: OwnershipNode[]) {
  return new Blob([`\uFEFF${buildRunsheetCsv(nodes)}`], { type: CSV_MIME_TYPE });
}

export function downloadRunsheetCsv(
  nodes: OwnershipNode[],
  {
    projectName,
    tractLabel,
  }: {
    projectName: string;
    tractLabel?: string | null;
  }
) {
  const blob = exportRunsheetCsv(nodes);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildRunsheetDownloadName(projectName, tractLabel);
  a.click();
  URL.revokeObjectURL(url);
}
