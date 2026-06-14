/**
 * Compatibility shim.
 *
 * The leasehold unit summary, decimal rows, and transfer-order review now live
 * in the unified title-math engine under `src/title-math`. This module
 * re-exports the same public surface so existing consumers keep their import
 * path. Implementation: src/title-math/calculators/leasehold.ts.
 */
export * from '../../title-math/calculators/leasehold';
