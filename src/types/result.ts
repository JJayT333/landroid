/** Result envelope — every math engine operation returns this. */

export interface Audit {
  action: string;
  affectedCount: number;
  scaleFactor?: string;
  oldInitialFraction?: string;
  newInitialFraction?: string;
  oldRootFraction?: string;
  newRootFraction?: string;
  restoredParentId?: string | null;
  restoredFraction?: string;
}

/**
 * A non-blocking warning attached to a successful operation. DA-M1: an
 * over-conveyance (a deed reciting more than the grantor holds) is BOOKED at the
 * grantor's remainder but the stated amount is captured verbatim and surfaced
 * here so the store can raise a title issue rather than reject the record.
 */
export interface ResultWarning {
  code: string;
  message: string;
  details?: unknown;
}

export interface ResultOk<T> {
  ok: true;
  data: T;
  audit: Audit;
  warning?: ResultWarning;
}

export interface ResultErr {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type Result<T> = ResultOk<T> | ResultErr;
