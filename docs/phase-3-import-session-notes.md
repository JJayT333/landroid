# Phase 3 Import Session Notes

Status: ready for Claude review on `feat/phase-3-import-session`.

## Scope

Phase 3 turns uploaded source packages into reviewable staged work. It does not
apply staged imports to the live Zustand stores, does not write `.landroid` v8,
and does not introduce a runtime import UI.

Implemented surface:

- `src/project-records/import-sessions.ts`
  - immutable source package, row, and excerpt models
  - recurring-runsheet package metadata
  - title-opinion-as-root `SourceAttestation` drafts
  - staged candidates with confidence and questions
  - `ActionPlan` dry-run previews
  - batch approval into typed action drafts
  - approval-time source citations and citation anchors
  - rejection with zero target-record/action/citation residue
  - source-row plus OCR/text side-by-side review projections

## Assumptions

- Source rows and excerpts are Phase 3 staging evidence, not live project
  records. They are immutable, content-hashed, and referenced by candidate ID,
  source row ID, and excerpt ID.
- Approval creates typed `ActionRecord`-shaped drafts, not durable
  `action_record` rows. The Phase 1 `ActionRecord` schema only models applied,
  failed, or undone records, so real durable action records remain Phase 4
  application work.
- Approved candidates create source-citation and citation-anchor records behind
  the project-record boundary. They still do not create instruments, interests,
  leases, tracts, or live-store writes.
- Ambiguity is represented as blocking candidate questions. The current
  deterministic ambiguity check covers malformed/missing fractions for interest
  candidates and malformed lease fraction fields.
- OCR/text review uses existing Phase 2.5 extraction-run and vault-object
  records when available. The helper does not execute OCR, read files, or write
  derivatives.
- AI-proposed candidates use the same dry-run and approval path as imported
  candidates. There is no auto-apply path.

## Exit Gate Evidence

- Dry-run preview: `buildImportSessionDryRunActionPlan` emits a Phase 1
  `ActionPlan` record with `dryRun: true`, candidate IDs, typed actions,
  questions, and explicit no-live-store/no-v8 flags.
- Questions: malformed fractions become blocking questions and approval throws
  until they are resolved.
- Rejection: `rejectImportSessionCandidates` removes rejected candidates from
  the staged session and returns no records, action drafts, target drafts,
  citations, or mutation count.
- Citations: `approveImportSessionCandidates` creates source-citation records
  whose `citedRecordId` is the immutable source row ID and whose `documentId`
  points back to the source document; OCR/text excerpts also produce
  citation-anchor records when page/span/vault data is present.

## Open Questions

- Should Phase 4 persist `ActionRecord` drafts as a new draft-capable schema, or
  keep drafts outside durable `action_record` rows until apply time?
- Should source rows/excerpts become first-class backend-spine record types
  before hosted storage, or remain immutable sidecar evidence under
  `ImportSession`?
- Which recurring runsheet identifiers should be canonical in production:
  package series/occurrence keys, source file hashes, or user-named package
  labels?
- How should answered questions be represented in Phase 4: candidate revision,
  supplemental source citation, or separate audit event?
