# Testing & Validation Strategy

## Primary test path
- `npm test`
- Runs local Node-based validation chain:
  1. `npm run test:smoke`
  2. `npm run test:storage`
  3. `npm run test:math-regression`
  4. `npm run test:title-scenarios`
  5. `npm run test:cross-surface`
  6. `npm run test:perf`

## Why this path
- LANDroid currently uses local Node scripts for regression and hardening checks in constrained environments.
- This keeps validation deterministic without external dependency installs.

## Individual checks
- `npm run test:smoke`
  - critical module export checks
  - audit log basic persistence behavior
  - sync op-log pending/synced summary behavior
  - dropbox metadata normalization seam
  - workspace domain save payload hygiene

- `npm run test:storage`
  - workspace persistence flow
  - save/load/sort/delete/deleteAll workflows

- `npm run test:math-regression`
  - deterministic branch-correction math scenarios
  - invariant checks (finite values, no negatives, no cycles, valid parents)

- `npm run test:title-scenarios`
  - canonical title workflow scenarios

- `npm run test:cross-surface`
  - Desk Map ↔ Title Ledger ↔ Flow source consistency checks on stress fixture

- `npm run test:perf`
  - lightweight performance benchmark on 5x200 stress workspace
  - reports timing regressions via warnings

## Recommended CI behavior
1. Run `npm test` once per change set that affects runtime behavior.
2. Treat any failure as blocking for correctness and hardening changes.
3. Track `test:perf` warnings over time and investigate sustained regressions.
4. Avoid repeated full reruns when code is unchanged; rerun only after a fix or when collecting the explicit 3-run perf snapshot for baseline comparison.
