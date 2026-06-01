# Phase 1 Record Schema Notes

Workstream: project record schema foundations.

Assumptions recorded during implementation:

- Phase 1 is additive. Current Zustand stores, UI components, math helpers, and
  `.landroid` import/export remain the runtime source of truth.
- `src/backend-spine/contracts.ts` is the canonical record contract; new record
  schemas extend the existing `RecordEnvelope` instead of forking a second
  schema layer.
- Current app rows do not contain enough data to materialize every future
  record instance. The workspace adapter builds records where current data has
  a source: project, parties, tracts, desk maps, documents, document versions,
  vault objects, document links, instruments, interest references, leases,
  active unit, and curative issues. Wellbore, lease-obligation, obligation-event,
  packet, packet-item, and packet-export schemas are defined but only produce
  rows when a later surface supplies data.
- Record IDs derived from current rows are deterministic and scoped by
  `workspaceId`; generated projection rows do not replace existing app IDs.
- Document records are metadata only. Blob bytes stay in existing package/store
  sections, and record rows reference document content through content hashes
  and vault object IDs.
- The workspace adapter fails if a blob-backed current document lacks a valid
  SHA-256 content hash. That is intentional; a record-bearing export should not
  invent evidence hashes.
- `MathInputView` is a new projection-layer contract. It reuses existing
  leasehold/coverage helpers for math output and does not rewire any live
  surface.
- Texas/federal/private isolation is enforced in the new `MathInputView`
  precondition by excluding non-Texas leases and blocking math rows when the
  active leasehold unit itself is non-Texas. Existing UI output is unchanged in
  this phase.
- The AI mutation guard is a projection-layer audit over the existing tool
  registries. It does not add new AI tools and does not relax the hosted
  read-only gate.
- Citation verification is structural only in Phase 1. It can verify record
  citation IDs and define failure behavior, but it does not claim OCR/page-span
  document Q&A support.

