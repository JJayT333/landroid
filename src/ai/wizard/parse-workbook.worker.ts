/**
 * Web Worker for CSV parsing.
 *
 * Binary Excel parsing is intentionally disabled until a safer parser is
 * chosen. The worker keeps larger CSV files from blocking the main thread.
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
