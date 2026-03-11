# LANDroid Math-Engine Phase Gate Checklist

Use this checklist before starting each new hardening/feature phase.

## 1) Scope Gate (Go / No-Go)
- [ ] Changes are tightly scoped to hardening/performance/correctness.
- [ ] No new large feature surface is introduced unless required for correctness or measurable performance.

## 2) Regression Gate (Go / No-Go)
- [ ] `npm test` passes.
- [ ] `npm run test:cross-surface` passes against `testdata/deskmap-stress-5x200.workspace.json`.

## 3) Performance Gate (Go / No-Go)
- [ ] No widened dependencies in hot memo paths (runsheet derivation, audit log derivation, flow source selection).
- [ ] No duplicate O(n) render work for unchanged values in core views.
- [ ] Any perf-sensitive refactor includes before/after timing notes when practical.

## 4) Cross-Surface Consistency Gate (Go / No-Go)
- [ ] Desk Map counts match Title Ledger all-record view.
- [ ] Conveyance-only ledger filter excludes related + unlinked as expected.
- [ ] Flow Chart import source modes (`active`, `all`, selected map) match desk map selection semantics.
- [ ] Flow edges only reference valid non-unlinked parents.

## 5) Audit + UX Parity Gate (Go / No-Go)
- [ ] `branch_recalculated` audit events still emit for predecessor/attach-conveyance/rebalance paths.
- [ ] Runsheet “Recent Math Change Log” still renders latest branch recalculation events.
- [ ] Ownership health indicator behavior remains unchanged.

## 6) Exit Criteria
- [ ] Known risks and follow-up recommendations are documented in PR summary.
- [ ] Validation commands and results are included in PR body.
