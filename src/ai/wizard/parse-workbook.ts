/**
 * Deterministic xlsx/csv parsing for the AI wizard.
 *
 * Two entry points:
 *
 *  - `parseWorkbook` — synchronous; runs in the calling thread. Used by
 *    tests and by tools that don't need worker isolation.
 *
 *  - `parseWorkbookInWorker` — async; spawns a dedicated Web Worker so a
 *    malicious workbook can't pollute the main thread (audit L-2 / H2-full
 *    response to the unfixed `xlsx` advisories). Wraps the worker with a
 *    30-second timeout; the worker is terminated on timeout, error, or
 *    successful completion.
 *
 * Both entry points share the same parsing implementation in
 * `./parse-workbook-impl`, so caps and behaviour are identical.
 */
export type {
  ParsedSheet,
  ParsedWorkbook,
} from './parse-workbook-impl';
export {
  MAX_PARSE_BYTES,
  MAX_SHEETS,
  MAX_CELLS_PER_SHEET,
  parseWorkbookSync as parseWorkbook,
  renderWorkbookForPrompt,
} from './parse-workbook-impl';

import type { ParsedWorkbook } from './parse-workbook-impl';
import type { ParseWorkerRequest, ParseWorkerResponse } from './parse-workbook.worker';
// Vite resolves `?worker` to a Worker constructor at build time.
// eslint-disable-next-line import/no-unresolved
import ParseWorker from './parse-workbook.worker?worker';

const PARSE_WORKER_TIMEOUT_MS = 30_000;

/**
 * Parse a workbook in a dedicated Web Worker.
 *
 * The worker is single-shot: spawned for the call and terminated as soon
 * as the response (or timeout / error) resolves. Callers do not need to
 * track the worker lifecycle.
 */
export async function parseWorkbookInWorker(
  fileName: string,
  buffer: ArrayBuffer
): Promise<ParsedWorkbook> {
  const worker = new ParseWorker() as Worker;
  return new Promise<ParsedWorkbook>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      fn();
    };
    const timer = setTimeout(() => {
      settle(() =>
        reject(
          new Error(
            `Workbook parsing timed out after ${PARSE_WORKER_TIMEOUT_MS / 1000}s. The file may be malformed or too complex; try saving as CSV and re-uploading.`
          )
        )
      );
    }, PARSE_WORKER_TIMEOUT_MS);

    worker.addEventListener('message', (event: MessageEvent<ParseWorkerResponse>) => {
      clearTimeout(timer);
      const response = event.data;
      if (response.ok) {
        settle(() => resolve(response.parsed));
      } else {
        settle(() => reject(new Error(response.error)));
      }
    });
    worker.addEventListener('error', (event: ErrorEvent) => {
      clearTimeout(timer);
      settle(() =>
        reject(new Error(event.message || 'Workbook parser worker crashed.'))
      );
    });

    const request: ParseWorkerRequest = { fileName, buffer };
    // Transfer the buffer into the worker so we don't pay the structured-clone
    // copy cost for large files. The original ArrayBuffer becomes detached;
    // callers shouldn't reuse it.
    worker.postMessage(request, [buffer]);
  });
}
