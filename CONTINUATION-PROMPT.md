# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Branch

Current checkpoint branch: `codex/document-registry-build-2026-05-16`.

This branch was created from `codex/document-database-roadmap-2026-05-16`.
The PR target remains `codex/hosted-hardening-2026-05-14`, not `main`.

Do not commit directly to `main`.

## Current Workstream

Phase 7A document registry MVP is implemented. A follow-up launcher polish pass
also hardened `LANDroid.command` for fresh GitHub ZIP downloads.

LANDroid now treats Runsheet as a saved mineral-title view over the broader
document registry rather than a separate storage model. Dropbox/local folders
remain future raw-file vault options; LANDroid keeps its own document copy,
metadata, entity links, content hashes, and packet-preview state.

Implemented in this branch:

- `Documents` navigation surface backed by existing Dexie v8 `documents` and
  `document_attachments` tables.
- Flat one-row-per-document registry with saved-view filters for All,
  Inbox/Needs review, Runsheet/Mineral Title, Leasehold, Curative, Research,
  GIS/Map Support, Federal Reference, Unlinked, Missing metadata, Duplicates,
  and Needs OCR.
- Document metadata editing for display title, document area, kind,
  instrument type, county, instrument number, volume/page, effective date,
  recording date, grantor, grantee/lessor/lessee, source reference, OCR
  status, and notes.
- Linked-entity display for node attachments, with a Desk Map jump.
- Duplicate surfacing by `contentHash`.
- Packet-builder preview from the current filter, selected/highlighted row,
  or Runsheet/Mineral Title view, plus JSON manifest download.
- `.landroid` round-trip preservation for the optional registry metadata.

Explicitly not implemented: OCR, Dropbox API sync, ArcGIS import, AI document
query, federal/private math, and automatic title updates.

Follow-up launcher/docs change:

- `LANDroid.command` now checks for Node.js/npm, installs npm dependencies on
  first run when `node_modules/.bin/vite` is missing, and keeps the Terminal
  window open with a clear startup error.
- README and user manual troubleshooting now call out the GitHub ZIP flow,
  macOS quarantine/execute-bit fixes, and the first-run dependency install.
- `IDEAS.md` is now the lightweight idea inbox. The docs map marks stale
  audit/report/prompt files as archived historical context under
  `docs/archive/`.

## Latest Validation

Completed on `codex/document-registry-build-2026-05-16`:

- `npm test -- src/documents/__tests__/document-registry.test.ts src/storage/__tests__/workspace-persistence.test.ts`
  passed: 2 files, 18 tests.
- `npm run lint` passed.
- `npm test` passed: 70 files, 582 tests. Known intentional noise remains the
  post-v8 backup error-path log.
- `npm run build` passed. Known Vite dynamic-import and chunk-size warnings
  remain.
- `npm run test:e2e` passed: 11 Playwright workflows.
- In-app Browser smoke passed for loading the Raven Forest demo, opening
  Documents, using the Runsheet saved view, selecting a row, switching packet
  preview to Selected, and checking console warnings/errors. Browser screenshot
  capture timed out, so the rendered record is the DOM/interaction/log pass
  plus Playwright coverage.

Run `git diff --check` and `git status` immediately before final handoff or
checkpoint.

Latest launcher-docs validation after this follow-up:

- `bash -n LANDroid.command` passed.
- `git diff --check` passed.

## Open Risks And Assumptions

- Packet export is intentionally a preview plus JSON manifest, not a ZIP/PDF
  production package.
- Metadata is user-maintained in Phase 7A. No OCR or automatic title updates
  should be inferred from registry edits.
- Linked-entity display is node-focused. Owner, lease, curative, research, and
  GIS attachment UI should be a separate small phase.
- Duplicate detection uses existing `contentHash`; it does not perform fuzzy
  matching or OCR text comparison.
- Existing Vite build warnings are unchanged and non-blocking.
- A fresh GitHub ZIP still requires Node.js/npm to already be installed; the
  launcher can install project dependencies, but not Node itself.

## Likely Next Steps

- Review the Phase 7A registry UX with real project documents.
- Harden packet export into a ZIP/native-file package with manifest CSV/JSON.
- Add owner, lease, curative, research, and GIS link surfaces only after the
  node-linked MVP is accepted.
- Design OCR/text indexing as a separate read/search layer, not a mutation path
  into title math.
- Keep AI document query read-only and citation-grounded when that phase starts.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on branch
`codex/document-registry-build-2026-05-16`. Read `AGENTS.md`,
`PROJECT_CONTEXT.md`, `docs/README.md`, and `CONTINUATION-PROMPT.md` first.
Phase 7A document registry MVP is implemented and validated; continue with
review, polish, or the next explicitly requested phase without adding OCR,
Dropbox sync, ArcGIS import, AI document query, federal/private math, or
automatic title updates.
