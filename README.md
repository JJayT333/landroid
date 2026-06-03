# LANDroid

LANDroid is a local-first React/Vite/TypeScript app for Texas oil-and-gas title,
lease, ownership, research, and land workflow review.

The repository root is the active application surface.

## Scope

Texas math is the active calculation baseline. LANDroid currently calculates
Texas fee and Texas state lease/title math only. Federal/BLM and private records
can be tracked as reference data in Federal Leasing and Research, but they must
not affect Desk Map, Leasehold, payout, NPRI, ORRI, WI, or transfer-order math
until the explicit Phase 2 federal/private math gate opens.

See `PROJECT_CONTEXT.md` and `docs/adr/0002-texas-only-active-math.md`.

## Quick Start

### Launchers

- macOS: double-click `LANDroid.command`. On a fresh GitHub ZIP, the launcher
  installs dependencies first, then starts LANDroid and opens the browser.
- Windows: `LANDroid.bat`

If macOS blocks the downloaded ZIP script, open Terminal in the extracted
folder and run:

```bash
chmod +x LANDroid.command
xattr -dr com.apple.quarantine .
./LANDroid.command
```

### Terminal

Use Node.js 22 LTS for local development and CI. Node.js 20 is no longer a
supported runtime target for this project.

```bash
cd /path/to/landroid
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Validation

```bash
npm run validate
```

`npm run validate` runs the full local validation set: root typecheck, root
unit tests, production build, Playwright e2e, backend spine audit/test/build,
and AI proxy audit/test/build. For narrower local checks:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
npm run validate:backend
```

`npm run test:e2e` uses Playwright Chromium and starts the local Vite server
automatically. Current e2e status is tracked in `TESTING.md`; as of the current
handoff, all 11 Playwright workflows are active after the document/PDF
persistence refactor, fixture retargeting, and document-registry smoke path.

## Key Docs

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Rules for AI coding agents working in this repo. |
| `PROJECT_CONTEXT.md` | Domain, architecture, and scope invariants. |
| `ARCHITECTURE.md` | Runtime stack, state ownership, module boundaries, and data flow. |
| `TESTING.md` | Validation commands, known warnings, and test policy. |
| `SECURITY.md` | Local-first security model, AI/key handling, and upload risks. |
| `DEPLOYMENT_PLAN.md` | Hosted deployment architecture, security controls, and rollout phases. |
| `DEPLOYMENT_GUIDE.md` | Step-by-step walkthrough for deploying to `landroid.abstractmapping.com` (Cognito + Amplify + Lambda AI proxy). |
| `DEPLOY_TEST_CHECKLIST.md` | Preflight, AWS console, smoke-test, and go/no-go checklist for the test deploy. |
| `USER_MANUAL.md` | User-facing workflow guide. |
| `LANDMAN-MATH-REFERENCE.md` | Landman-facing math formulas and review conventions. |
| `ROADMAP.md` | Current, next, and later work. |
| `IDEAS.md` | Brainstorming inbox for ideas that are not yet roadmap commitments. |
| `CHANGELOG.md` | Completed meaningful changes. |
| `CONTINUATION-PROMPT.md` | Short handoff for resuming the active workstream. |
| `docs/document-database-roadmap.md` | Phase 7 document registry, OCR/search, storage-vault, and AI-query direction. |

See `docs/README.md` for the full documentation map.

## Current App Surfaces

- `Desk Map`: title-chain editing, ownership review, and a collapsible unit-map
  reference rail sourced from `Maps`.
- `Leasehold`: unit-focused acreage, lease, ORRI, WI, NPRI payout, and transfer-order review.
- `Flowchart`: presentation and print layout.
- `Runsheet`: chronology review and CSV export.
- `Documents`: flat document registry with saved views, metadata editing,
  duplicate surfacing, linked-node display, and packet manifest preview.
- `Owners`: unit-filtered owner, lease, contact, and document records.
- `Curative`: title issue and curative tracking.
- `Maps`: project map assets, regions, references, and the featured/unit-linked
  map shown in Desk Map.
- `Sales Deck`: signed-in native status/sales slides for the current LANDroid
  story, recent progress, hosted POC state, and next milestones, with the
  bundled PDF/PPTX feature deck retained as a legacy reference.
- `Federal Leasing`: reference-only federal/BLM lease tracking.
- `Research`: source records, formulas, project records, saved questions, and RRC imports.
- `Ask LANDroid AI`: local-first assistant workflows and CSV row review, with
  Ollama as the local default provider, hosted proxy mode for the POC site, and
  approval-gated AI edits. Hosted chat posts directly to the Lambda-backed
  `/api/ai/chat/completions` proxy with the signed-in Cognito session and a
  compact read-only packet of the current app/Desk Map context.

Leasehold math strictly validates legacy/imported lease royalty, ORRI burden, and
WI assignment fractions; malformed non-blank values are treated as 0 and surfaced
as input warnings in the leasehold focus that they affect.

## Demo Data

Use `Demo Data -> Vulcan Mesa` or the Raven Forest sample to load the
current sample workspaces. The hosted POC site keeps Demo Data visible for
signed-in fixture review. Demo loading replaces the active browser workspace,
so it requires the typed phrase `LOAD DEMO` before it runs. Demo loading resets
owner, document, curative, map, research, and transient AI approval/undo state
before seeding the selected fixture.
Older stress and 8-tract leasehold demos have been retired.

## Persistence Notes

- Browser autosave keeps the active workspace and flowchart canvas locally.
- `.landroid` files are the main named backup/export format. The current v9
  format keeps the workspace snapshot authoritative and can carry a validated
  title action/audit ledger for durability.
- Phase 5 stores document blobs, content hashes, and attachments in the local
  workspace database. Phase 7A adds the `Documents` registry so LANDroid can
  edit document metadata, group documents by saved view/area, surface duplicate
  hashes, and preview title-opinion packet manifests. Dropbox/local folders or
  later object storage remain optional raw-file vaults rather than the only
  database. Removing a document from a card detaches that link; shared document
  blobs remain until no entity links reference them.
- `.landroid` imports validate the top-level workspace graph before loading;
  corrupt embedded action ledgers are dropped with a warning so the snapshot can
  still open.
- CSV imports create a fresh workspace and intentionally start with empty owner,
  document, curative, map, research, and transient AI side state.
- `.landroid` and CSV loads require the typed phrase `LOAD WORKSPACE` because
  they replace the active browser workspace.

## Repo Notes

- `dist/` is generated browser-ready output from `npm run build`.
- `dist-node/` is generated TypeScript config output from the composite build.
- `playwright-report/` and `test-results/` are generated by Playwright browser QA.

## Hosted Deployment

- Full walkthrough: `DEPLOYMENT_GUIDE.md` (AWS + GoDaddy, ~60 min first time).
- Local hosted preflight: `npm run deploy:check`.
- Test deploy checklist: `DEPLOY_TEST_CHECKLIST.md`.
- Paste-ready Amplify rewrites: `amplify-rewrites.json`.
- Post-deploy verification: `bash scripts/smoke-test-hosted.sh`.
- Lambda AI proxy source: `backend/ai-proxy/`.
- Minimal backend-spine Lambda source: `backend/spine/`; this is contract proof
  only, not project storage or sync.
