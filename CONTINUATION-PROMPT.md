# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`main`.

The latest completed deploy is on `main` at:
`88a8967` (`Add native Sales Deck view (#80)`).

Do not commit directly to `main` unless the user explicitly asks for a direct
main push/deploy.

## Current Workstream

Sales Deck MVP is complete and deployed.

Completed:

- PR #80 replaced the user-facing `Pitch Deck` navigation label with
  `Sales Deck` while keeping the internal `pitch` view id for a small
  reversible change.
- `src/views/PitchDeckView.tsx` now opens as a native LANDroid slide
  experience with a slide rail, previous/next controls, scroll reset on slide
  change, and a legacy reference section for the bundled PDF/PPTX feature deck.
- `src/sales-deck/sales-deck-content.ts` defines ten polished slides and
  extracts status bullets from `CHANGELOG.md`, `ROADMAP.md`,
  `CONTINUATION-PROMPT.md`, and `DEPLOYMENT_STATE.md` through Vite `?raw`
  imports at build time.
- The Sales Deck branch was marked ready, merged to `main`, and the remote
  feature branch was deleted.
- Amplify served the updated custom-domain bundle after the merge.

## Latest Validation

- PR #80 GitHub Actions CI passed for both `Root app` and `AI proxy`.
- Main-branch CI for commit `88a8967` passed.
- Before merge, local validation passed:
  - `npm test -- src/sales-deck/__tests__/sales-deck-content.test.ts`
  - `npm run lint`
  - `npm test` (74 files, 609 tests; existing intentional stderr coverage for
    simulated Dexie/document-cascade failures)
  - `npm run build` (existing Vite dynamic/static import warnings, chunk-size
    warning, and Node `module.register()` deprecation remained)
  - `git diff --check`
- Local browser smoke passed at `http://localhost:5173/`: `Sales Deck` opened,
  `Next` advanced from overview to workflow pain, legacy reference/download
  controls were present, slide change reset the deck pane to top, and browser
  error/warn logs were empty.
- Hosted infrastructure smoke passed with
  `bash scripts/smoke-test-hosted.sh`: root HTML, security headers,
  unauthenticated AI rejection, SPA fallback, Cognito metadata, and JWKS.
- Hosted bundle check confirmed
  `https://landroid.abstractmapping.com/assets/index-imE3mt9i.js` contains the
  native Sales Deck code.

## Open Risks And Assumptions

- Sales Deck Markdown extraction is build-time only. It updates when the app is
  rebuilt, not live while the app is already open.
- The existing bundled assets under `src/assets/pitch/` remain intentional.
  Root `LANDroid-Features.pptx` remains untracked local noise and should not be
  touched unless explicitly requested.
- `dist/assets/xlsx-CkFp8p6R.js` remains intentionally absent and should not be
  restored.
- Manual signed-in hosted browser verification was not completed in this pass;
  the hosted bundle and infrastructure were verified without entering a Cognito
  session.

## Likely Next Steps

- Manually sign in at `https://landroid.abstractmapping.com` and confirm the
  `Sales Deck` tab renders in the authenticated hosted app.
- Load hosted Demo Data and re-test hosted AI against a populated Desk Map,
  specifically asking whether it can see the current map/context.
- Review the Phase 7A `Documents` registry MVP and capture only small,
  concrete fixes before opening a broader document-packet workstream.
- Test CSV row staging against one or two recurring spreadsheet formats and
  add only proven aliases or row-review fixes.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on `main`. Read
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`,
`DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first. Sales Deck PR #80
has been merged and the hosted custom-domain bundle now contains the native
Sales Deck code. Start with the next contained item: either manual signed-in
hosted verification, hosted AI populated Desk Map retest, Phase 7A Documents
registry review, or one real CSV row-staging test. Keep the work scoped and
avoid opening new product fronts.
