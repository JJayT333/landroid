# LANDroid Testing Guide

Use this file to choose the smallest useful validation set for a change.

## Default Commands

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## When To Run What

| Change Type | Minimum Validation |
| --- | --- |
| Docs only | `git diff --check -- *.md docs/**/*.md` |
| Pure utility or type change | `npm run lint` and targeted `npm test -- <name>` |
| Engine/math/store change | `npm run lint`, targeted tests, then `npm test` |
| UI workflow change | `npm run lint`, targeted tests, `npm run build`, relevant e2e if available |
| Import/export/persistence change | `npm run lint`, storage tests, `npm test`, and manual risk note |
| AI tool/provider change | `npm run lint`, AI tests, relevant wizard/tool tests, and rollback check |
| Release/checkpoint | full default commands |

## Current Known Warnings

- AI settings tests may emit Zustand persist warnings because test storage is not
  browser `localStorage`. Treat this as known noise until the storage mock is
  cleaned up.
- Vite may warn about chunks larger than 500 kB, especially AI/workbook chunks.
  That is not currently a blocking failure.
- `npm audit --omit=dev` currently reports high-severity `xlsx` issues with no
  available patched version. Track mitigation in `PATCH_PLAN.md`.

## E2E Status

As of the current handoff:

- 4 Playwright workflows are active.
- 5 workflows are intentionally skipped while they are retargeted to the current
  Combinatorial - Raven Forest fixture.

Do not describe skipped workflows as verified in user-facing docs.

## Fixture Policy

- Do not regenerate large fixtures unless explicitly requested.
- If a fixture is regenerated, report why, expected impact, and runtime/size
  cost.
- Keep real-workbook fixtures under `tests/fixtures` documented with a README.

## Regression Expectations

For graph, tree, ownership, math, or recalculation logic, tests should cover:

- no negative fractions
- finite numeric values
- no cycles
- valid parent references
- expected warning-only states
- predecessor insert and recalculation
- attach/graft and recalculation
- rebalance and recalculation

For AI/import work, tests should cover:

- invalid input does not silently mutate state
- rollback snapshot expectations
- row-level validation errors
- malformed workbook/import failure states
- prompt-injection-like workbook cells treated as data
