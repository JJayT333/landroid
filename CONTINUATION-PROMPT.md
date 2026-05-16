# LANDroid - Continuation Prompt

Use this file to resume the active workstream in a new chat. Read it with
`AGENTS.md`, `PROJECT_CONTEXT.md`, and `docs/README.md` before touching code.
Keep long history in `CHANGELOG.md`.

## Current Branch

Current checkpoint branch: `codex/document-packet-export-2026-05-16`.

This branch was created from
`codex/document-storage-reconciliation-2026-05-16`, which was created from
`origin/codex/document-registry-build-2026-05-16` after confirming
`codex/github-actions-ci-2026-05-16` was the separate CI branch. The PR target
remains `codex/hosted-hardening-2026-05-14`, not `main`.

Do not commit directly to `main`.

## Current Workstream

Phase 7A.6 packet export hardening is being implemented on top of the Phase
7A.5 document storage/registry reconciliation branch.

LANDroid now treats Runsheet as a saved mineral-title view over the broader
document registry rather than a separate storage model. Dropbox/local folders
remain future raw-file vault options; LANDroid keeps its own document copy,
metadata, entity links, content hashes, and packet state.

Implemented through Phase 7A:

- `Documents` navigation surface backed by existing Dexie v8 `documents` and
  `document_attachments` tables.
- Flat one-row-per-document registry with saved-view filters for All,
  Inbox/Needs review, Runsheet/Mineral Title, Leasehold, Curative, Research,
  GIS/Map Support, Federal Reference, Unlinked, Missing metadata, Duplicates,
  and Needs OCR.
- Document metadata editing for display title, area, kind, instrument type,
  county/state, recording references, instrument/recording dates, structured
  parties, source ref, OCR status, and notes.
- Linked-entity display for node attachments, with a Desk Map jump.
- Duplicate surfacing by `contentHash`.
- Packet-builder preview from the current filter, selected/highlighted row, or
  Runsheet/Mineral Title view.
- `.landroid` round-trip preservation for optional registry metadata.

Phase 7A.5 reconciles storage and registry metadata:

- New writes and packet manifests use canonical `area`, `sourceRef`, and
  structured `parties`.
- Legacy field names still import/read correctly: `documentArea`,
  `sourceReference`, `effectiveDate`, `grantor`, and `grantee`.
- `externalRefs` preserve supported external IDs, URLs, and file paths.
- `Needs OCR` only counts documents explicitly marked `not_started` or
  `failed`; unknown legacy rows are not claimed as needing OCR.
- The Documents surface has a left saved-view rail and richer packet preview
  counts for unique hashes, warnings, area mix, source refs, and ready rows.

Phase 7A.6 adds local packet export hardening:

- Packet preview still supports `Manifest JSON` for metadata-only export.
- `Packet ZIP` builds a local ZIP with `manifest.json`, `manifest.csv`, and
  native stored document files under `documents/` using stable packet-order
  filenames.
- ZIP export fails when a packet row is missing its stored native document
  blob, instead of silently producing an incomplete package.
- The export helper is dependency-free and lives under `src/documents`.

Explicitly not implemented: OCR engine, Dropbox sync, ArcGIS import, AI
document query, federal/private math, automatic title updates, PDF packet
assembly, saved packet sets, ZIP export beyond the selected packet, or
attach-to-non-node UI.

Follow-up launcher/docs change from the prior checkpoint:

- `LANDroid.command` checks for Node.js/npm, installs npm dependencies on first
  run when `node_modules/.bin/vite` is missing, and keeps the Terminal window
  open with a clear startup error.

## Latest Validation

Completed on `codex/document-packet-export-2026-05-16`:

- `npm test -- src/documents/__tests__/packet-export.test.ts src/documents/__tests__/document-registry.test.ts`
  passed: 2 files, 9 tests.
- `npm run lint` passed.
- `npm test` passed: 71 files, 590 tests. Known intentional noise remains the
  post-v8 backup error-path log.
- `npm run build` passed. Known Vite dynamic-import and chunk-size warnings
  remain.
- `npm run test:e2e` passed: 11 Playwright workflows, including the packet ZIP
  download assertion.
- Browser smoke for Documents packet export controls passed after starting Vite
  on `127.0.0.1:5174`: Raven Forest demo loaded, Documents opened, saved-view
  rail visible, Runsheet/Mineral Title view selected, `Manifest JSON` and
  `Packet ZIP` enabled, and no browser console/page errors. The first Browser
  plugin attempt hit a macOS Chromium bootstrap sandbox permission issue, so the
  smoke was rerun with a one-off escalated Playwright command.
- `git diff --check` passed.

## Open Risks And Assumptions

- Packet ZIP export is local packaging only. It does not assemble a PDF packet,
  save named packet sets, or upload/sync to external storage.
- Metadata is user-maintained in Phase 7A. No OCR or automatic title updates
  should be inferred from registry edits.
- `Needs OCR` is a manual status marker until a real OCR/text layer exists.
- Linked-entity display is node-focused. Owner, lease, curative, research, and
  GIS attachment UI should be a separate small phase.
- Duplicate detection uses existing `contentHash`; it does not perform fuzzy
  matching or OCR text comparison.
- Existing Vite build warnings are unchanged and non-blocking.
- A fresh GitHub ZIP still requires Node.js/npm to already be installed; the
  launcher can install project dependencies, but not Node itself.

## Likely Next Steps

- Finish full validation for Phase 7A.6 and checkpoint the branch.
- Review the Phase 7A registry and packet export UX with real project
  documents.
- Expand entity document links beyond Desk Map nodes only after the node-linked
  MVP is accepted.
- Design OCR/text indexing as a separate read/search layer, not a mutation path
  into title math.
- Keep AI document query read-only and citation-grounded when that phase
  starts.

## Paste-Ready Next Chat Prompt

Resume in `/Users/abstractmapping/projects/landroid` on branch
`codex/document-packet-export-2026-05-16`. Read `AGENTS.md`,
`PROJECT_CONTEXT.md`, `docs/README.md`, and `CONTINUATION-PROMPT.md` first.
Phase 7A.6 adds packet ZIP export on top of the canonical document registry:
`Manifest JSON` remains metadata-only, and `Packet ZIP` packages native stored
document files with JSON/CSV manifests while failing if a stored blob is
missing. Continue with validation, review, polish, or the next explicitly
requested phase without adding OCR, Dropbox sync, ArcGIS import, AI document
query, federal/private math, automatic title updates, PDF packet assembly,
saved packet sets, or attach-to-non-node UI.
