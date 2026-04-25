/**
 * Web Worker for xlsx/csv parsing.
 *
 * Audit L-2 / H2-full: the `xlsx` package has open prototype-pollution and
 * ReDoS advisories with no upstream fix. Running the parser in a Worker
 * isolates a malicious workbook from the main thread — even if a payload
 * triggers the bug, only the worker's heap is corrupted and the caller
 * terminates the worker on timeout / error.
 */
/// <reference lib="webworker" />

import { parseWorkbookSync, type ParsedWorkbook } from './parse-workbook-impl';

export type ParseWorkerRequest = {
  fileName: string;
  buffer: ArrayBuffer;
};

export type ParseWorkerResponse =
  | { ok: true; parsed: ParsedWorkbook }
  | { ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener('message', (event: MessageEvent<ParseWorkerRequest>) => {
  const { fileName, buffer } = event.data;
  try {
    const parsed = parseWorkbookSync(fileName, buffer);
    const response: ParseWorkerResponse = { ok: true, parsed };
    ctx.postMessage(response);
  } catch (err) {
    const response: ParseWorkerResponse = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    ctx.postMessage(response);
  }
});
