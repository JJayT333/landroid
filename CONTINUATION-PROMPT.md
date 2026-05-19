# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, `docs/README.md`, and
`DEPLOYMENT_STATE.md` before touching code. Keep long history in
`CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`codex/sales-deck-native`.

Do not commit directly to `main`.

## Current Workstream

Native in-app Sales Deck MVP.

Completed in this branch:

- Replaced the user-facing `Pitch Deck` navigation label with `Sales Deck`
  while keeping the internal `pitch` view id for a small reversible change.
- Reworked `src/views/PitchDeckView.tsx` so the first screen is a native
  LANDroid slide experience with a slide rail, previous/next controls, and a
  legacy reference section for the bundled PDF/PPTX feature deck.
- Added `src/sales-deck/sales-deck-content.ts` to define ten polished slides
  and extract status bullets from `CHANGELOG.md`, `ROADMAP.md`,
  `CONTINUATION-PROMPT.md`, and `DEPLOYMENT_STATE.md` through Vite `?raw`
  imports at build time.
- Added targeted unit coverage for the Markdown extraction and generated deck
  structure.
- Updated `README.md`, `USER_MANUAL.md`, `ARCHITECTURE.md`, `ROADMAP.md`, and
  `CHANGELOG.md` for the native Sales Deck surface and helper data flow.

## Latest Validation

- `npm test -- src/sales-deck/__tests__/sales-deck-content.test.ts`
  passed: 1 file, 2 tests.
- `npm run lint` passed.
- `npm test` passed: 74 files, 609 tests. Existing intentional stderr coverage
  appeared for simulated Dexie/document-cascade failures.
- `npm run build` passed. Existing Vite warnings remained for dynamic imports
  that are also statically imported, chunk size, and Node `module.register()`
  deprecation.
- `git diff --check` passed.
- Browser smoke at `http://localhost:5173/` passed through the in-app Browser:
  app loaded as `LANDroid v2`, `Sales Deck` opened, `Next` advanced from the
  overview slide to workflow pain, legacy reference/download controls were
  present, the deck pane reset to scroll top on slide change, and browser
  error/warn logs were empty.

## Open Risks And Assumptions

- Sales Deck Markdown extraction is build-time only. It updates when the app is
  rebuilt, not live while the app is already open.
- The existing bundled assets under `src/assets/pitch/` remain intentional.
  Root `LANDroid-Features.pptx` remains untracked local noise and should not be
  touched unless explicitly requested.
- `dist/assets/xlsx-CkFp8p6R.js` remains intentionally absent and should not be
  restored.
- The first version is intentionally static-plus-small-helper. Deeper live doc
  editing, user-authored slide management, or backend deck publishing is not
  included.

## Likely Next Steps

- Finish lint, full tests, build, diff-check, and local browser smoke.
- Commit the Sales Deck branch and open a PR.
- After merge to `main`, Amplify should rebuild the frontend automatically.
- If the deck becomes a recurring sales artifact, consider adding a small
  single-source status metadata file instead of expanding Markdown parsing.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on branch
`codex/sales-deck-native`. Read `AGENTS.md`, `PROJECT_CONTEXT.md`,
`docs/README.md`, `DEPLOYMENT_STATE.md`, and `CONTINUATION-PROMPT.md` first.
Continue the native Sales Deck MVP. The branch replaces the user-facing
`Pitch Deck` tab with a native `Sales Deck` slide view, keeps the bundled
PDF/PPTX as a legacy reference section, and adds a small build-time Markdown
helper for recent status slides. Finish validation, browser smoke, commit, push,
and open a PR.
