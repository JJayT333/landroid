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
| Document registry or packet-preview change | `npm run lint`, `npm test -- src/documents/__tests__/document-registry.test.ts src/storage/__tests__/document-store.test.ts src/storage/__tests__/workspace-persistence.test.ts src/storage/__tests__/document-migration.test.ts src/store/__tests__/workspace-store-doc-actions.test.ts`, plus browser smoke for navigation/inspector changes |
| Rebuild schema/storage/vault planning change | docs diff check, then update `docs/rebuild-plan.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `TESTING.md`, `SECURITY.md`, and `CONTINUATION-PROMPT.md` together |
| Phase 0 inventory lane | document current behavior, identify existing tests, list missing tests, define golden-master fixture expectations, record manual smoke steps, and run the smallest existing validation command that proves the inspected behavior |
| Backend architecture decision | docs diff check, threat-model/security review notes, data-flow/API boundary review, local/export contract review, and explicit go/no-go before backend implementation |
| Evidence vault, OCR, packet, or AI citation implementation | `npm run lint`, relevant storage/document tests, package round-trip tests, citation-verifier tests, AI tests when answer behavior changes, and targeted browser/e2e smoke for impacted flows |
| AI tool/provider change | `npm run lint`, AI tests, relevant wizard/tool tests, approval-queue tests, and rollback check |
| Hosted AI proxy/deploy change | `npm run deploy:check`, `cd backend/ai-proxy && npm test && npx tsc -p tsconfig.json --noEmit`, plus root `npm test` if frontend policy changes; run `bash scripts/smoke-test-hosted.sh` when network/AWS access is available |
| Release/checkpoint | full default commands plus `npm run deploy:check` for hosted deploy candidates |

For hosted persistence-key changes, include
`npm test -- src/storage/__tests__/active-workspace-key.test.ts src/storage/__tests__/persistence-db-key.test.ts`.

## Current Known Warnings

- Vite may warn about chunks larger than 500 kB, especially AI chunks.
  That is not currently a blocking failure.
- GitHub Actions CI runs on Node.js 22 and covers root `npm ci`,
  `npm audit --omit=dev`, `npm run lint`, `npm test`, `npm run build`, plus
  backend AI proxy install, production audit, tests, and build.

## E2E Status

As of the current handoff:

- 11 Playwright workflows are active.
- No Phase 5 Playwright workflows remain intentionally skipped.
- Browser coverage includes multi-document Desk Map chips opening the correct
  PDF by `attachmentId`, v8 `.landroid` export/import document round-trip,
  branch-scoped lease deletion through the shared confirmation modal, curative
  linkage, research linkage, the document registry metadata/packet smoke path,
  federal leasing, and Research home surfacing.
- The combinatorial demo loader and `.landroid` import workflow now exercise
  typed destructive confirmations before replacing the active workspace.

Do not describe a workflow as verified unless it is active in
`tests/e2e/landroid-workflows.spec.ts` and has passed locally or in CI.

## Fixture Policy

- Do not regenerate large fixtures unless explicitly requested.
- If a fixture is regenerated, report why, expected impact, and runtime/size
  cost.
- Keep real spreadsheet fixtures under `tests/fixtures` documented with a README.
- Phase 0 rebuild fixtures should include frozen reference workspaces,
  checksums, expected math/output JSON where practical, and documented
  performance baselines. If a fixture is too large to check in, document its
  generation source, checksum, and local storage path policy.
- Phase 0 should be executed lane by lane under one master behavior catalog.
  Secondary agent reviews are useful only as read-only lane reviews; the lead
  inventory thread should reconcile findings into the source-of-truth docs.

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
- malformed spreadsheet/import failure states
- prompt-injection-like spreadsheet cells treated as data

For rebuild storage and evidence-vault work, tests should cover:

- existing `.landroid` workspaces still load after migration
- sharded workspace persistence preserves autosave and side-store reset behavior
- future-version rejection and rollback-safe import still work
- multi-tab or concurrent-writer behavior is blocked or conflict-visible
- immutable original hashes remain stable across import/export/package round
  trips
- deleting a link does not delete shared documents or originals incorrectly
- OCR/text extraction failures leave originals usable
- extraction runs trace from document version to derivative artifacts and source
  citations
- packet manifests, checksums, unresolved-issue files, and load-file sidecars
  are deterministic

For AI cited-answer work, tests should cover:

- pre-OCR answers cannot cite nonexistent document text spans
- every displayed material claim passes citation verification
- unsupported claims produce an unresolved/insufficient-evidence result
- open issues point to existing `CurativeIssue` records or typed proposed
  records
- suggested next actions are typed `ActionPlan` proposals or navigation hints

For rebuild-scale performance gates, record:

- fixture name and checksum
- machine/runtime context
- command used
- baseline result
- acceptable drift or threshold
