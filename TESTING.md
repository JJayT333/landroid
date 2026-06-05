# LANDroid Testing Guide

Use this file to choose the smallest useful validation set for a change.

## Default Commands

```bash
npm run validate
```

`npm run validate` is the full local aggregate: root typecheck, root unit tests,
production build, Playwright e2e, backend spine audit/test/build, and AI proxy
audit/test/build. For targeted validation, run the narrower commands directly:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm run validate:backend
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
| Phase 0 inventory reconciliation | docs diff check, verify highest-risk inventory rows against code before marking them binding, and update `docs/rebuild-plan.md`, `docs/phase-0-inventory.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `SECURITY.md`, and `CONTINUATION-PROMPT.md` together |
| Backend-spine planning | docs diff check, threat-model/security review notes, data-flow/API boundary review, local/export contract review, backend-shaped local schema review, and explicit smallest implementation slice before backend coding |
| Minimal backend-spine implementation | `npm run lint`, targeted shared-schema/adapter/app-contract tests, `cd backend/spine && npm ci && npm audit --omit=dev && npm test && npm run build && npm run bundle`, `npm run deploy:check`, root `npm test` if frontend contract code changes, and no hosted-deploy claim without `DEPLOYMENT_STATE.md` plus smoke evidence |
| Project record schema foundation | `npm run lint`, `npm test -- src/backend-spine/__tests__/contracts.test.ts src/project-records/__tests__/workspace-record-adapter.test.ts src/storage/__tests__/workspace-shards.test.ts src/phase0/__tests__/vulcan-mesa-fixtures.test.ts`, then `npm test` and `npm run build` before handoff |
| v9 `.landroid` action-ledger format | `npm run lint`, `npm test -- src/project-records/__tests__/action-persistence.test.ts src/storage/__tests__/workspace-persistence.test.ts src/phase0/__tests__/vulcan-mesa-fixtures.test.ts`, `npm test`, and `npx tsx scripts/title-soak.ts` |
| Phase 0.5 storage sharding implementation | `npm run lint`, targeted storage migration/lock/lazy-blob tests, `.landroid` round-trip tests, side-store reset tests, `npm test`, `npm run build`, relevant e2e, and Phase 0 performance-baseline comparison for project open, autosave, document registry, and `.landroid` round trip |
| Evidence vault, OCR, packet, or AI citation implementation | `npm run lint`, `npm test -- src/project-records/__tests__/evidence-vault.test.ts src/project-records/__tests__/extraction-runs.test.ts src/project-records/__tests__/workspace-record-adapter.test.ts` plus relevant storage/document tests, package round-trip tests, citation-verifier tests, AI tests when answer behavior changes, and targeted browser/e2e smoke for impacted flows |
| ImportSession / staged-import implementation | `npm run lint`, `npm test -- src/project-records/__tests__/import-sessions.test.ts`, Phase 0 golden tests, then `npm test`; add storage/UI/e2e checks only if the implementation crosses the project-record boundary |
| AI context, tool, or provider change | `npm run lint`, AI app-context and hosted-context privacy tests, relevant wizard/tool tests, approval-queue tests, rollback check, root `npm test` if frontend policy changes, and `npm run build` before PR handoff |
| Hosted AI proxy/deploy change | `npm run deploy:check`, `cd backend/ai-proxy && npm test && npx tsc -p tsconfig.json --noEmit`, plus root `npm test` if frontend policy changes; run `bash scripts/smoke-test-hosted.sh` when network/AWS access is available |
| Release/checkpoint | `npm run validate` plus `npm run deploy:check` for hosted deploy candidates |

For hosted persistence-key changes, include
`npm test -- src/storage/__tests__/active-workspace-key.test.ts src/storage/__tests__/persistence-db-key.test.ts`.

## Current Known Warnings

- Vite may warn about chunks larger than 500 kB, especially AI chunks.
  That is not currently a blocking failure.
- GitHub Actions CI runs on Node.js 22 and covers root `npm ci`,
  `npm audit --omit=dev`, `npm run lint`, `npm test`, `npm run build`, plus
  backend AI proxy install, production audit, tests, and build.
- LLA-L02: Desk Map warning dots now derive from shared coverage/validation
  state instead of description text. Vulcan Mesa dots `VM2`, `VM3`, and `VM7`
  (previously `VM2` only) because `VM3` and `VM7` carry real lease-overlap
  coverage warnings.

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
- The working master behavior catalog is `docs/phase-0-inventory.md`. Treat it
  as a draft until high-risk rows are verified and uncertain rows are marked
  `needs verification`.
- AI-036 system-prompt rule integrity is frozen by
  `fixtures/phase-0/ai/system-prompt.snapshot.md` and guarded by
  `src/ai/__tests__/system-prompt.test.ts`.
- Phase 0 manual smoke checks are documented in
  `docs/phase-0-manual-smoke-checks.md`.
- Before Phase 0.5 starts, the catalog must identify committed or documented
  reference workspaces for the demo fixture, a Raven Forest-scale fixture, and a
  migration-stress `.landroid`; each needs a checksum policy and expected
  output plan. The W1 Vulcan Mesa fixture and first expected outputs live under
  `fixtures/phase-0/` and regenerate through
  `scripts/generate-phase-0-fixtures.ts`. W2 is documented as a rebuild
  stress-test recipe plus deterministic manifest/checksum instead of a
  committed full Raven Forest `.landroid` export.
- Runsheet golden masters must name the ordering/filter mode they protect. Do
  not treat one generic `demo.runsheet.csv` as the full Runsheet contract; the
  rebuild needs separate coverage for global instrument date, global file date,
  single-tract filtered export, grouped-by-tract export, and later manual/custom
  package order.
- Packet manifest golden masters must name the packet source mode they protect.
  Do not treat the full-registry `demo.packet-manifest.json` as proof for
  `Packet: Runsheet`, `Packet: Filter`, or `Packet: Selected`; each source can
  have a different item set and needs explicit expected output.
- Phase 0 closeout should not fake goldens for behavior LANDroid does not yet
  have. Implement goldens for current behavior before closeout; carry future
  contracts such as multi-tab locking, canvas viewport persistence, orphan-PDF
  recovery UI, named Runsheet ordering modes, named packet source modes, and
  automated Flowchart visual-diff proof into the phase that implements them.
- Phase 0 performance baselines are guarded by
  `src/phase0/__tests__/performance-baselines.test.ts`, which verifies PERF-01
  through PERF-08 are cataloged and linked to raw artifacts. Numeric drift
  comparison is a later CI policy/harness decision.

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
- sharded Dexie rows conform to the Phase 0.75 record envelope or are explicitly
  declared local-only projection/cache rows
- sharded workspace persistence preserves autosave and side-store reset behavior
- future-version rejection and rollback-safe import still work
- multi-tab or concurrent-writer behavior is blocked or conflict-visible
- autosave debounce behavior remains intentional and measured after sharding
- canvas viewport persistence is either preserved across reload or explicitly
  documented as intentionally volatile
- PWA/iPad persistent-storage requests are attempted where supported, with a
  visible fallback when the browser refuses
- PDF/document blobs are lazy-loaded; opening a project must not read every
  document blob into memory
- Raven Forest-scale fixtures meet the Phase 0.5 target of 1,000-3,000 title
  nodes and 200-1,000 document records/PDFs on iPad Pro-class hardware or a
  documented equivalent
- immutable original hashes remain stable across import/export/package round
  trips
- deleting a link does not delete shared documents or originals incorrectly
- OCR/text extraction failures leave originals usable
- extraction runs trace from document version to derivative artifacts and source
  citations
- selectable-PDF text extraction stays separate from scanned-PDF OCR in record
  mode, tooling expectations, and derivative object kinds
- cloud OCR records require explicit per-document opt-in risk fields and never
  run as an ambient fallback
- packet manifests, checksums, unresolved-issue files, and load-file sidecars
  are deterministic

For Phase 0.5 storage sharding specifically, start with targeted coverage for:

- pure shard building from current `WorkspaceData` into backend-spine manifest
  and Desk Map envelopes plus local-only compatibility rows
- Dexie v10 shard table/index definitions plus upgrade backfill tests
- v9 monolithic `workspaces.data` rows migrating into complete sharded rows
  without changing loaded `WorkspaceData`
- corrupt or incomplete shard rows falling back to the preserved monolithic
  backup with a visible startup warning
- pure shard-reader coverage for complete shard loads, monolith-only loads,
  incomplete/corrupt-shard fallback, and unrecoverable corruption
- runtime `loadWorkspaceFromDb` coverage proving shard-first load, monolith-only
  load, and incomplete-shard fallback warning under the active DB key
- sharded autosave preserving the extracted debounce timing and not rewriting
  every title row for focus-only changes
- `.landroid` v7/v8 import/export compatibility, future-version rejection, and
  rollback-safe side-store replacement after sharding
- first-tab writable, second-tab read-only, stale-lock expiry, explicit
  takeover, and blocked writes from a non-writable tab
- project open and registry listing loading document metadata/links without
  bulk-reading every PDF/blob
- W2/Raven Forest-scale project-open, document-registry, autosave, and
  `.landroid` round-trip metrics compared with the Phase 0 baseline artifacts

For minimal backend-spine work, tests should cover:

- unauthenticated requests fail closed
- authenticated session responses do not trust client-supplied user/project IDs
- health/session/record-validation response shapes match the shared schemas
- request body caps and unknown/future schema rejection are enforced
- local-only and mock adapters preserve offline app behavior
- hidden app contract checks send only health, session, and synthetic project-record validation
  probes, never real project records or document payloads
- hosted `/api/spine/*` wiring serves health, rejects unauthenticated session
  and validation requests, and packages the Lambda with `aws-jwt-verify` and
  `zod`
- backend-spine logs are structured and do not include request bodies or record
  payloads
- no document bytes, OCR text, owner PII, API keys, or full prompts are logged

For AI cited-answer work, tests should cover:

- pre-OCR answers cannot cite nonexistent document text spans
- every displayed material claim passes citation verification
- unsupported claims produce an unresolved/insufficient-evidence result
- open issues point to existing `CurativeIssue` records or typed proposed
  records
- suggested next actions are typed `ActionPlan` proposals or navigation hints
- every mutating tool that can change project state is covered by approval and
  undo policy; registry drift between tool definitions and undo/approval lists
  must fail a test

For Phase 3 import-session work, tests should cover:

- recurring runsheet packages preserve package series/occurrence metadata
- source rows and excerpts are immutable and content-hashed
- title-opinion-as-root imports produce `SourceAttestation` drafts before apply
- every staged candidate has confidence and can carry blocking questions
- malformed or ambiguous fraction fields become questions instead of guessed
  values
- dry-run `ActionPlan` previews exist before approval and explicitly mark the
  no-live-store/no-v8 boundary
- rejected candidates produce no target records, links, citations, action
  drafts, or other mutation residue
- approved candidates cite immutable source row IDs and source documents
- OCR/text side-by-side review appears only when extraction-run and vault-object
  evidence is available

For Phase 1 project-record schema foundations, tests should cover:

- every declared backend-spine `recordType` parsing through
  `BackendSpineCoreRecordSchema`
- serialization/round-trip validation through `ProjectRecordBundleSchema`
- current `WorkspaceData` projection into records without serializing blobs
- `MathInputView` preserving dual decimal/fraction display, lease allocation
  order, warning-only states, and Texas-only math isolation
- citation-verifier failure behavior before document text Q&A expands
- the existing Phase 0 golden-master tests that freeze current math/display
  outputs

For rebuild-scale performance gates, record:

- fixture name and checksum
- machine/runtime context
- command used
- baseline result
- acceptable drift or threshold

The Phase 0 capture walkthrough lives at
`scripts/capture-phase-0-baselines.md`, and the current status template lives at
`fixtures/phase-0/perf/baseline-status.json`. A PERF row is not complete until
its raw profile or command output is attached or referenced with checksum,
machine context, and reviewer/date.
The Phase 0 closeout captures now record PERF-01 through PERF-06 and PERF-08
under `fixtures/phase-0/perf/2026-05-24-codex-closeout/`, plus PERF-07 under
`fixtures/phase-0/perf/2026-05-25-codex-perf07/` using
`fixtures/phase-0/import-stress.csv`.
