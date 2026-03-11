# Hardening Exit Report (Math Engine)

## Phase intent
This phase focused on correctness guardrails, cross-surface consistency checks, and lightweight performance gating before additional feature work.

## What is now in place
- Deterministic large stress fixture (5 desk maps x 200 records).
- Cross-surface parity checks for Desk Map, Title Ledger, and Flow source selection.
- Performance benchmark gate (`test:perf`) for scale-sensitive derivations.
- Default test pipeline includes correctness + cross-surface + perf checks.

## Validation status
- `npm test`: PASS
  - smoke: PASS
  - storage: PASS
  - math-regression: PASS
  - title-scenarios: PASS
  - cross-surface: PASS
  - perf benchmark: PASS (warnings: 0)

## Performance baseline snapshot (5x200 fixture)
Collected from 3 consecutive `npm run -s test:perf` runs.

| Metric | Run 1 (ms) | Run 2 (ms) | Run 3 (ms) | Observed range (ms) |
|---|---:|---:|---:|---:|
| load_fixture | 14.62 | 14.02 | 14.48 | 14.02 - 14.62 |
| derive_runsheet_all | 9.40 | 8.06 | 7.34 | 7.34 - 9.40 |
| derive_ledger_views_all | 27.34 | 27.00 | 34.15 | 27.00 - 34.15 |
| derive_flow_all | 2.09 | 1.99 | 2.04 | 1.99 - 2.09 |
| derive_runsheet_active | 0.47 | 0.41 | 0.44 | 0.41 - 0.47 |
| derive_flow_active | 0.35 | 0.40 | 0.33 | 0.33 - 0.40 |

Fixture integrity during baseline:
- maps: 5
- total nodes: 1000
- all runsheet nodes: 1000
- flow all edges: 990

## Risk notes
- `npm` emits `Unknown env config "http-proxy"` warnings in this environment; checks still pass.
- Perf thresholds are conservative by design and should be monitored over time for sustained drift.

## Safe-to-proceed recommendation
**Yes — safe to proceed to next scoped work items** as long as `npm test` remains green and perf warnings remain stable.

## Next checklist
- [ ] Run this baseline again after next optimization slice and compare ranges.
- [ ] Keep feature additions behind phase gates unless required for correctness/performance.
- [ ] If perf warnings begin trending upward across multiple commits, pause and investigate root cause.
