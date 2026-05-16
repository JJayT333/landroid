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
| Document registry or packet-preview/export change | `npm run lint`, `npm test -- src/documents/__tests__/document-registry.test.ts src/documents/__tests__/packet-export.test.ts`, storage round-trip tests when metadata shape changes, and browser smoke for navigation/inspector/download changes |
| AI tool/provider change | `npm run lint`, AI tests, relevant wizard/tool tests, and rollback check |
| Hosted AI proxy/deploy change | `npm run deploy:check`, `cd backend/ai-proxy && npm test && npx tsc -p tsconfig.json --noEmit`, plus root `npm test` if frontend policy changes; run `bash scripts/smoke-test-hosted.sh` when network/AWS access is available |
| Release/checkpoint | full default commands plus `npm run deploy:check` for hosted deploy candidates |

For hosted persistence-key changes, include
`npm test -- src/storage/__tests__/active-workspace-key.test.ts src/storage/__tests__/persistence-db-key.test.ts`.

## Current Known Warnings

- Vite may warn about chunks larger than 500 kB, especially AI/workbook chunks.
  That is not currently a blocking failure.
- `npm audit --omit=dev` currently reports high-severity `xlsx` issues with no
  available patched version. Track mitigation in `PATCH_PLAN.md`.

## E2E Status

As of the current handoff:

- 11 Playwright workflows are active.
- No Phase 5 Playwright workflows remain intentionally skipped.
- Browser coverage includes multi-document Desk Map chips opening the correct
  PDF by `attachmentId`, v8 `.landroid` export/import document round-trip,
  branch-scoped lease deletion through the shared confirmation modal, curative
  linkage, research linkage, the document registry saved-view rail,
  canonical metadata, packet-preview smoke path, and packet ZIP download,
  federal leasing, and Research home surfacing.
- The combinatorial demo loader and `.landroid` import workflow now exercise
  typed destructive confirmations before replacing the active workspace.

Do not describe a workflow as verified unless it is active in
`tests/e2e/landroid-workflows.spec.ts` and has passed locally or in CI.

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
- strict parser warning surfacing for malformed non-blank economic inputs
- predecessor insert and recalculation
- attach/graft and recalculation
- rebalance and recalculation

For AI/import work, tests should cover:

- invalid input does not silently mutate state
- rollback snapshot expectations
- row-level validation errors
- malformed workbook/import failure states
- prompt-injection-like workbook cells treated as data
