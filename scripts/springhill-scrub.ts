/**
 * .landroid de-identification / sample-prep tool (operator-run, writes a NEW file).
 *
 * Produces a shareable sample from a `.landroid` by:
 *   1. faking every owner `mailingAddress`,
 *   2. replacing every embedded PDF blob with a single blank form (default: the
 *      repo's Producers 88), so the document viewer still renders something but
 *      no real recorded-instrument image (names / signatures / SSNs) ships, and
 *   3. leaving names, nodes, fractions, and math untouched (the structure is the
 *      point of the sample).
 *
 * Non-PDF blobs (e.g. map images) are LEFT and reported, not silently replaced
 * (swapping a map raster for a PDF would break rendering). Review the report and
 * re-run with a wider rule if you want those gone too.
 *
 * This NEVER overwrites the input. It operates on the raw JSON so the file's
 * version and structure are preserved exactly apart from the scrubbed fields.
 *
 * Usage (raise the heap for large files):
 *   NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/springhill-scrub.ts \
 *     --in "/abs/path/source.landroid" --out "/abs/path/sample.landroid"
 *   [--pdf docs/lease-generator/Producers_88.pdf]
 */
import { readFile, writeFile, stat } from 'node:fs/promises';

const DEFAULT_PDF = 'docs/lease-generator/Producers_88.pdf';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function fakeAddress(index: number): string {
  return `${100 + index} Example Ave, Sample City, TX 75001`;
}

interface SerializedBlobLike {
  base64: string;
  mimeType?: string;
}

function isSerializedBlob(value: unknown): value is SerializedBlobLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { base64?: unknown }).base64 === 'string'
  );
}

interface Report {
  ownersAddressFaked: number;
  pdfBlobsReplaced: number;
  blobsLeftByMime: Record<string, number>;
}

function walkAndReplaceBlobs(node: unknown, pdfBase64: string, report: Report): void {
  if (Array.isArray(node)) {
    for (const item of node) walkAndReplaceBlobs(item, pdfBase64, report);
    return;
  }
  if (typeof node !== 'object' || node === null) return;

  if (isSerializedBlob(node)) {
    const mime = node.mimeType ?? '(none)';
    if (node.mimeType === 'application/pdf') {
      node.base64 = pdfBase64;
      report.pdfBlobsReplaced += 1;
    } else {
      report.blobsLeftByMime[mime] = (report.blobsLeftByMime[mime] ?? 0) + 1;
    }
    return; // a blob has no nested blobs
  }

  for (const value of Object.values(node)) {
    walkAndReplaceBlobs(value, pdfBase64, report);
  }
}

async function main(): Promise<void> {
  const inPath = arg('--in');
  const outPath = arg('--out');
  const pdfPath = arg('--pdf') ?? DEFAULT_PDF;
  if (!inPath || !outPath) {
    throw new Error('Usage: --in <source.landroid> --out <sample.landroid> [--pdf <form.pdf>]');
  }
  if (inPath === outPath) {
    throw new Error('Refusing to overwrite the input; choose a different --out.');
  }

  const pdfBase64 = Buffer.from(await readFile(pdfPath)).toString('base64');
  const inStat = await stat(inPath);
  const parsed = JSON.parse(await readFile(inPath, 'utf8')) as Record<string, unknown>;

  const report: Report = { ownersAddressFaked: 0, pdfBlobsReplaced: 0, blobsLeftByMime: {} };

  // 1) Fake owner mailing addresses.
  const ownerData = parsed.ownerData as { owners?: Array<Record<string, unknown>> } | undefined;
  if (Array.isArray(ownerData?.owners)) {
    ownerData.owners.forEach((owner, index) => {
      if ('mailingAddress' in owner) {
        owner.mailingAddress = fakeAddress(index);
        report.ownersAddressFaked += 1;
      }
    });
  }

  // 2) Replace every embedded PDF blob with the blank form.
  walkAndReplaceBlobs(parsed, pdfBase64, report);

  // 3) Write the new file (input untouched).
  await writeFile(outPath, JSON.stringify(parsed, null, 2));
  const outStat = await stat(outPath);

  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  console.log('LANDroid scrub / sample-prep');
  console.log(`  in                 : ${inPath} (${mb(inStat.size)} MB)`);
  console.log(`  out                : ${outPath} (${mb(outStat.size)} MB)`);
  console.log(`  form PDF           : ${pdfPath}`);
  console.log(`  owner addresses    : ${report.ownersAddressFaked} faked`);
  console.log(`  PDF blobs replaced : ${report.pdfBlobsReplaced}`);
  const left = Object.entries(report.blobsLeftByMime);
  if (left.length === 0) {
    console.log('  non-PDF blobs left : (none)');
  } else {
    console.log('  non-PDF blobs left :');
    for (const [mime, count] of left) console.log(`      ${mime}: ${count}`);
  }
}

void main().catch((err) => {
  console.error('[springhill-scrub] aborted:', err);
  process.exit(1);
});
