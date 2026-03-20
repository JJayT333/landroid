/** Result envelope — every math engine operation returns this. */

export interface Audit {
  action: string;
  affectedCount: number;
  scaleFactor?: string;
  oldInitialFraction?: string;
  newInitialFraction?: string;
  oldRootFraction?: string;
  newRootFraction?: string;
}

export interface ResultOk<T> {
  ok: true;
  data: T;
  audit: Audit;
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
