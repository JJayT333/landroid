# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`codex/reset-side-store-cleanup`.

Do not commit directly to `main`.

## Current Workstream

Cleanup before the next major AI/document-intake phase.

Completed in this branch:

- Added `src/storage/workspace-side-store-reset.ts` as the shared replacement
  path for workspace side stores.
- Demo loads now reset owner, document, curative, map, research, and transient
  AI approval/undo state before seeding fixture data.
- `.landroid` imports now route through the same side-store replacement path,
  using the file payload where present and empty data where a section is absent.
- CSV imports now create a fresh workspace and explicitly clear documents plus
  transient AI approval/undo state, in addition to the existing owner,
  curative, map, and research reset.
- `Clear Map` and branch deletion now remove owner and lease records only when
  those records were linked exclusively to deleted Desk Map nodes. Records still
  linked by surviving nodes in other tracts are preserved.
- Updated `README.md`, `USER_MANUAL.md`, `ARCHITECTURE.md`, and `CHANGELOG.md`
  for the new reset behavior.

## Latest Validation

- `npm test -- src/store/__tests__/workspace-store.test.ts src/storage/__tests__/workspace-side-store-reset.test.ts`
  passed: 2 files, 15 tests.
- `npm run lint` passed.

## Open Risks And Assumptions

- Tract-level `Clear Map` is intentionally scoped. It clears active-tract cards
  and node-linked side records, but it does not wipe unrelated project-level
  Maps, Research, Curative, or owner records used by other tracts.
- Root `LANDroid-Features.pptx` remains untracked local noise. The bundled copy
  under `src/assets/pitch/` is intentional.
- `dist/assets/xlsx-CkFp8p6R.js` remains intentionally removed from Git as stale
  generated output from the retired Excel parser path.
- Hosted AI still needs a populated hosted-browser re-test after this branch is
  merged/deployed, specifically asking whether it can see the Desk Map and
  confirming CloudWatch shows an authenticated `evt: "request"`.

## Likely Next Steps

- Run `npm run build`.
- Run `git diff --check`.
- Commit, push, open PR, merge, and let Amplify deploy from `main`.
- Re-test hosted Demo Data and hosted AI with a populated Desk Map after deploy.
- After this reset cleanup lands, plan the next AI/document-intake phase around
  deterministic document registry review, CSV row staging, and read-only AI
  context before any mutating AI proposals.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on branch
`codex/reset-side-store-cleanup`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, `DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first.
Continue the cleanup before the next AI/document-intake phase. This branch
centralizes workspace side-store replacement for demo loads, `.landroid`
imports, and CSV imports, and tightens Desk Map clearing so owner/lease records
are removed only when exclusively linked to deleted nodes. Run build and
diff-check, then commit/PR/merge/deploy if validation stays green.
