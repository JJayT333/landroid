# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Branch

Current checked-out branch:
`codex/deskmap-doc-attachments-formula-cleanup`.

Current `main` head when this branch was created:
`8eea5b1 docs: record current hosted deployment state (#75)`.

Do not commit directly to `main`.

## Current Workstream

Product cleanup after PRs #72-#75.

Completed in this branch:

- Hosted smoke test passed again for
  `https://landroid.abstractmapping.com`: root HTML, security headers,
  unauthenticated `/api/ai/*` rejection, SPA fallback, Cognito metadata, and
  JWKS.
- Manual hosted browser check using Chrome confirmed the user remains signed in
  as `joshua@abstractmapping...`, the hosted Demo Data menu is visible, and
  Crackbaby Carnival loads with tract tabs and Desk Map cards.
- Manual hosted AI check opened the AI panel, submitted `hello`, and confirmed
  the request still stalls with no assistant response. The panel accepted the
  prompt and showed the user message/loading state. The header still showed the
  stale persisted local `OLLAMA · GPT-OSS:20B` label before this branch's
  frontend fix.
- Computer Use AWS Console check navigated Lambda/CloudWatch for
  `landroid-ai-proxy`. The newest same-day log streams at
  `2026-05-18T22:21:52Z`, `2026-05-18T21:49:18Z`, and
  `2026-05-18T21:05:21Z` all show fast `evt: "reject"` /
  `reason: "missing_bearer"` / `status: 401` events. No authenticated
  `evt: "request"` log for the hosted `hello` chat was found in those visible
  streams.
- Frontend hosted-AI polish now treats hosted mode as configured, hides local
  provider settings in hosted mode, displays `hosted · gpt-4o-mini`, and uses
  a direct `/api/ai/chat/completions` streaming fetch with the Cognito ID token
  instead of the generic OpenAI-compatible provider shim. This should make the
  hosted `hello` path reach Lambda as an authenticated request after deploy.
- `Attach Related Document` now supports optional PDF upload during related
  record creation. It pre-validates PDF size and magic bytes, then writes the
  file through the existing `attachDocToNode` document registry path.
- Formula popovers now render fixed to the viewport to avoid clipping inside
  constrained panels or overflow-hidden map surfaces.
- Desk Map now has a right-side `Formula Tray`: hover popovers remain
  temporary, and clicking a formula value pins a comparison card into the tray.
- The Unit Map Reference panel idea from `ROADMAP.md` is now implemented as a
  collapsible Desk Map reference rail sourced from `Maps`.
- Added a signed-in `Pitch Deck` tab that previews the LANDroid feature deck as
  a bundled PDF and provides the original `LANDroid-Features.pptx` for download.
  The PDF was generated with LibreOffice from the local deck file.
- Desk Map `Fit` now measures the actual rendered visible tree/chain and
  accounts for its offset inside the pan container before centering.
- Leasehold `Overview` now has an `Override Review` strip for NPRI branches,
  ORRI overrides, WI assignments, retained WI, and included/tracked record
  counts, plus tract cards now show WI split counts beside NPRI/ORRI counts.
- Desk Map now has a collapsible `Unit Map Reference` rail. It previews a
  `Maps` asset linked to any tract in the active unit, then falls back to the
  featured map asset. This is reference-only and does not attempt coordinate
  underlay. The rail labels whether the map is `Unit-linked`,
  `Featured fallback`, or the first available asset.
- Hosted AI now includes a compact read-only app context packet in each
  authenticated `/api/ai/chat/completions` request. The packet includes the
  active view, project, unit/tract, visible Desk Map card summaries, linked
  lease summaries, and deterministic mineral coverage totals so the hosted
  assistant can answer questions like "Can you see the Desk Map?" without
  receiving edit tools.
- The stale tracked generated asset `dist/assets/xlsx-CkFp8p6R.js` is now
  intentionally removed instead of restored. It was the only tracked file under
  `dist/`, came from the old vulnerable Excel parser build path, and is no
  longer emitted now that spreadsheet review is CSV-only.

## Latest Validation

Automated:

- `bash scripts/smoke-test-hosted.sh` passed against
  `https://landroid.abstractmapping.com`.
- `npm run lint` passed.
- `npm test -- src/components/leasehold/__tests__/leasehold-summary.test.ts src/views/__tests__/view-helpers.test.ts`
  passed: 2 files, 26 tests.
- `npm test -- src/store/__tests__/map-store.test.ts src/views/__tests__/view-helpers.test.ts`
  passed: 2 files, 12 tests.
- `npm test -- src/views/__tests__/view-helpers.test.ts src/ai/__tests__/runChat-hosted.test.ts src/auth/__tests__/session.test.ts src/ai/__tests__/settings-store.test.ts src/ai/__tests__/read-only-tools.test.ts src/store/__tests__/workspace-store-doc-actions.test.ts`
  passed: 6 files, 46 tests.
- `npm test -- src/ai/__tests__/runChat-hosted.test.ts` passed after adding
  hosted Desk Map context coverage: 1 file, 4 tests.
- `npm run build` passed. Known warnings remain:
  - Node emitted the local `module.register()` deprecation warning.
  - `src/storage/db.ts` is both dynamically and statically imported.
  - chunks over 500 kB after minification.
- `git diff --check` passed after the latest Leasehold Overview/doc updates.

Browser/manual:

- Computer Use Chrome check confirmed hosted Demo Data and Crackbaby Carnival.
- Computer Use Chrome check confirmed hosted AI still stalls after submitting
  `hello`.
- Computer Use Chrome/AWS Console check confirmed the Lambda Function URL is
  reachable and enforcing bearer auth, but the hosted manual chat request did
  not show up as an authenticated CloudWatch request in the same-day streams.
- Local Playwright smoke against `http://127.0.0.1:5174/` confirmed clicking a
  formula pins one card into the `Formula Tray` with no lingering tooltip and
  no console/page errors.
- Local Playwright smoke confirmed the `Attach Related Document` modal opens
  from a Desk Map `ATTACH` action and exposes `+ Attach PDF`.
- The deck file converted successfully to
  `src/assets/pitch/LANDroid-Features.pdf` with `soffice --headless
  --convert-to pdf --outdir src/assets/pitch LANDroid-Features.pptx`.
- Local Playwright smoke confirmed the `Pitch Deck` tab loads, exposes the PDF
  preview iframe and PowerPoint download link, and has no console/page errors.
- Local Playwright smoke against `http://127.0.0.1:5174/` loaded the
  Combinatorial demo, opened Leasehold `Overview`, and confirmed the rendered
  page shows `Override Review`, NPRI branch, ORRI override, WI assignment,
  retained WI, and tract `WI splits` text with no console/page errors.
- Local Playwright smoke uploaded an image asset through `Maps`, returned to
  Desk Map, and confirmed the `UNIT MAP REFERENCE` rail rendered, showed the
  reference-only copy, and collapsed to `Map Ref`. The direct upload-to-route
  smoke logged transient `net::ERR_FILE_NOT_FOUND` image resource errors while
  leaving the Maps route; the rail still rendered and toggled correctly.

Development server:

- `npm run dev -- --host 127.0.0.1 --port 5174` was started for local browser
  checks and stopped afterward.

## Open Risks And Assumptions

- Hosted AI still needs hosted browser confirmation after this branch deploys.
  Lambda is reachable and rejecting unauthenticated smoke probes correctly; the
  branch now changes the hosted frontend request path and sends read-only app
  context with the signed-in request, so Desk Map questions should produce an
  authenticated CloudWatch `evt: "request"` with useful context instead of only
  `missing_bearer` smoke probes. If backend code changes are needed later,
  manual Lambda bundle upload remains required.
- `aws` CLI is not installed in this repo shell, so CloudWatch logs were not
  inspected from the terminal.
- `LANDroid-Features.pptx` remains intentionally untracked local noise in the
  repo root. The bundled copy under `src/assets/pitch/` is intentional.
- `dist/assets/xlsx-CkFp8p6R.js` is intentionally deleted in this branch. Do
  not restore it unless the source parser path is intentionally changed back to
  emit an Excel-parser chunk.
- True coordinate map underlay remains out of scope; the current Desk Map map
  rail is a reference preview only.
- The bundled `Pitch Deck` assets are appropriate for signed-in POC navigation
  but are not strong private-file hosting. Static frontend assets can still be
  fetched if someone has the built asset URL; true private deck hosting would
  need authenticated backend storage.

## Likely Next Steps

- Re-test hosted AI after this branch is deployed: ask `Can you see the Desk
  Map?` and confirm the answer references the active project/tract context, then
  confirm CloudWatch shows an authenticated `evt: "request"` rather than only
  `missing_bearer` smoke probes.
- Re-run hosted AI manually after deploying this branch if frontend polish is
  merged.
- Continue product cleanup order: re-test hosted AI after deploy, then choose
  the next small correctness/audit visibility cleanup.
- Stage the intentional source/docs/test changes plus the
  `dist/assets/xlsx-CkFp8p6R.js` deletion, but leave root
  `LANDroid-Features.pptx` untracked.
- Run full relevant validation before opening/merging a PR if new code changes
  are added.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on branch
`codex/deskmap-doc-attachments-formula-cleanup`. Read `AGENTS.md`,
`PROJECT_CONTEXT.md`, `docs/README.md`, `DEPLOYMENT_STATE.md`, and
`CONTINUATION-PROMPT.md` first. Continue the product cleanup after PRs #72-#75.
Hosted smoke and hosted Demo Data/Crackbaby Carnival are confirmed; hosted AI
initially stalled after `hello`, then later responded but could not see the
Desk Map. This branch now fixes hosted AI label/settings visibility, replaces
the hosted provider shim with a direct authenticated
`/api/ai/chat/completions` streaming fetch, and adds a read-only app context
packet for the current view/project/unit/tract/Desk Map coverage.
CloudWatch previously showed only same-day `missing_bearer` 401 smoke-style
Lambda events, not an authenticated hosted chat request. Desk Map
related-document attach now supports PDF upload, formula popovers avoid
clipping, formula click pins to a side tray, Desk Map Fit measures the visible
tree, Leasehold Overview has clearer override visibility, and Desk Map has a
collapsible Unit Map Reference rail sourced from Maps. Next, re-test hosted AI
after deploying this frontend branch by asking whether it can see the Desk Map,
then choose the next small correctness/audit visibility cleanup.
