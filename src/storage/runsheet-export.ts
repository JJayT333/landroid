import type { OwnershipNode } from '../types/node';
import type { ColInfo } from 'xlsx';

const SHEET_NAME = 'Leasehold';
const XLSX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

const RUNSHEET_COLUMN_WIDTHS: ColInfo[] = [
  { wch: 15.33 },
  { wch: 14 },
  { wch: 8.5 },
  { wch: 42.66 },
  { wch: 6.83 },
  { wch: 7 },
  { wch: 12.33 },
  { wch: 12 },
  { wch: 11.5 },
  { wch: 47 },
  { wch: 47 },
  { wch: 52.83 },
  { wch: 55.33 },
] as const;

function buildImagePath(docNo: string) {
  return `TORS_Documents\\${docNo}.pdf`;
}

function sanitizeFileNamePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ');
}

export async function buildRunsheetWorkbook(nodes: OwnershipNode[]) {
  const XLSX = await import('xlsx');
  const sheetRows = [
    [...RUNSHEET_HEADERS],
    ...nodes.map((node, index) => [
      index + 1,
      node.instrument || '',
      index + 1,
      buildImagePath(node.docNo || ''),
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

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  worksheet['!cols'] = [...RUNSHEET_COLUMN_WIDTHS];
  worksheet['!autofilter'] = {
    ref: `A1:M${Math.max(sheetRows.length, 1)}`,
  };

  for (let rowNumber = 2; rowNumber <= nodes.length + 1; rowNumber += 1) {
    const orderByDate = rowNumber - 1;
    const node = nodes[orderByDate - 1];

    worksheet[`A${rowNumber}`] = {
      t: 'n',
      f: `HYPERLINK(D${rowNumber},C${rowNumber})`,
      v: orderByDate,
    };
    worksheet[`D${rowNumber}`] = {
      t: 's',
      f: `CONCATENATE("TORS_Documents\\",G${rowNumber},".pdf")`,
      v: buildImagePath(node.docNo || ''),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  return workbook;
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

  return `${parts.join('-')}.xlsx`;
}

export async function exportRunsheetWorkbook(nodes: OwnershipNode[]) {
  const workbook = await buildRunsheetWorkbook(nodes);
  const XLSX = await import('xlsx');
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
  });
  return new Blob([buffer], { type: XLSX_MIME_TYPE });
}

export async function downloadRunsheetWorkbook(
  nodes: OwnershipNode[],
  {
    projectName,
    tractLabel,
  }: {
    projectName: string;
    tractLabel?: string | null;
  }
) {
  const blob = await exportRunsheetWorkbook(nodes);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildRunsheetDownloadName(projectName, tractLabel);
  a.click();
  URL.revokeObjectURL(url);
}
