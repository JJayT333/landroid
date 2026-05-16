# Claude Prompt — LANDroid Document Registry Parallel Build

Resume in `/Users/abstractmapping/projects/landroid`.

Use branch `claude/document-registry-build-2026-05-16`, created from
`codex/document-database-roadmap-2026-05-16`. Do not branch from `main`.
PR target remains `codex/hosted-hardening-2026-05-14`.

Before coding, read:

- `AGENTS.md`
- `PROJECT_CONTEXT.md`
- `docs/README.md`
- `CONTINUATION-PROMPT.md`
- `docs/document-database-roadmap.md`
- `docs/adr/0004-multi-doc-per-entity-persistence.md`
- `docs/phase-5-document-refactor.md`
- `docs/gis-data-catalog.md`

## Product Question

Explore the best version of LANDroid as a title-document database, using the
existing Runsheet idea as a lens rather than a separate silo.

The user is deciding whether document management should become the next major
feature. Build a concrete branch that answers: "Can LANDroid become the
document room for title work, while Dropbox remains the master vault?"

## Direction To Honor

- One flat registry should back everything.
- Runsheet should be a mineral-title saved view or mode of that registry.
- Project support, GIS/map support, federal reference, leasehold, curative, and
  research documents must stay visually/filterably separate from mineral title.
- LANDroid should keep its own working copy of relevant files so title-opinion
  packets can be exported without depending on Dropbox paths.
- Future Dropbox mapping should use durable external identity such as file ID,
  revision, and content hash; paths are display/convenience metadata.
- Future OCR/AI should index LANDroid document records and cite exact sources,
  but should not mutate title automatically.

## Outside Patterns To Borrow

- M-Files: metadata-driven views that behave like folders without trapping a
  document in one folder.
- SharePoint: document-library columns, filtering, grouping, and saved views.
- iManage/legal DMS: matter/project metadata and profile fields make documents
  searchable and context-aware.
- eDiscovery systems: export packets include native files, metadata/load file,
  extracted text, error reports, and summaries.
- Dropbox: content hashes can compare local and remote file contents without a
  full download; future sync should not be path-only.

## Build Scope

You may choose the best UI shape, but keep the change coherent and reviewable.
Good options:

- convert Runsheet into a `Records`/`Documents` hub with `Runsheet` as one
  saved view, or
- add a `Documents` tab and make `Runsheet` clearly depend on the same
  registry model.

Implement enough that the user can compare this branch against Codex's branch:

1. Registry/list of all current `DocumentRecord` rows.
2. Saved views or filters for:
   - Mineral Title / Runsheet
   - Project Support
   - Leasehold
   - Curative
   - Research
   - GIS / Map Support
   - Federal Reference
   - Unlinked
   - Missing metadata
   - Duplicates
   - Needs OCR
3. Metadata/profile editing for document area, instrument type, recording info,
   parties, dates, notes, and source reference.
4. Entity-link display from `document_attachments`.
5. Duplicate grouping by `contentHash`.
6. A title-opinion packet concept:
   - build from current filter or highlighted rows
   - include all relevant docs known to LANDroid
   - produce a preview of filenames, counts, total bytes, and warnings
   - optionally export manifest/ZIP if it is straightforward

## Design Constraints

- Dense, calm, title-work UI.
- No marketing page.
- No decorative hero.
- No oversized cards.
- Prefer table/list with inspector.
- Keep filters and saved views obvious.
- Make it feel safe for messy real projects with hundreds/thousands of docs.

## Guardrails

- Do not implement OCR yet.
- Do not implement cloud AI document search yet.
- Do not add Dropbox API auth yet.
- Do not import raw ArcGIS packages or BLOB attachments.
- Do not change Texas math, federal/private math, payout, or automatic title
  update behavior.
- New document-mutating AI tools, if any are introduced, must be blocked in
  hosted mode from the same commit. Prefer not adding AI tools in this branch.

## Validation

Run the smallest relevant tests as you build, then:

- `npm run lint`
- relevant `npm test -- ...`
- `npm run build`

Use Playwright if the UI/navigation is materially changed.

Update docs for the behavior you actually ship:

- `README.md`
- `USER_MANUAL.md`
- `TESTING.md`
- `CHANGELOG.md`
- `CONTINUATION-PROMPT.md`

Handoff with:

- the UI/model decision
- how your branch treats Runsheet vs Documents
- what the packet builder does now
- what should come next for Dropbox mapping, OCR, AI query, and title-opinion
  packet export

