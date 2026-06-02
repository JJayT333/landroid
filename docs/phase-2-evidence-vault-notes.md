# Evidence Vault Notes

Workstream: document vault and packet model.

Assumptions recorded during implementation:

- This slice is additive and rollback-safe. Existing v8 `.landroid` package
  shape, IndexedDB side stores, Documents view, Desk Map document chips, and
  current packet preview remain the runtime source of truth.
- The unified model is projected under `src/project-records/evidence-vault.ts`.
  It does not delete, rewrite, or migrate owner documents, map assets, research
  imports, or registry documents in Dexie.
- Existing registry `DocumentRecord.contentHash` values must already be valid
  SHA-256 hashes. Blob-backed owner docs, map assets, and research imports do
  not have persisted hashes yet, so the projection computes SHA-256 from their
  current blobs when building evidence-vault records.
- Document records are stable project entities; each original gets a
  `document`, `document_version`, and original `vault_object`, while links are
  represented by `document_link` rows.
- Link deletion in the project-record layer removes only `document_link` rows.
  Documents, versions, and vault objects are not auto-deleted by record-layer
  link removal. The live document store keeps its existing cascade behavior:
  node/tract deletes remove affected links and delete a document only when that
  same removal leaves no surviving links.
- Registry attachment ordering is preserved from
  `document_attachments.position`. Side-store links use deterministic
  source-order positions scoped by `workspaceId`, `entityKind`, and `entityId`.
- Map asset `deskMapId` links project as `tract` links using the current
  `DeskMap.tractId` when available, falling back to the Desk Map id.
- Research imports project as `import_row` links and also link to research
  sources/project records that reference the import.
- Attorney packet export is modeled as deterministic JSON manifest records,
  packet item/export records, source-citation sidecars, unresolved-issue
  summaries, and optional eDiscovery load-file sidecars. A native ZIP/PDF
  writer is still a later packaging step.
- `VaultObject.derivedFromVaultObjectId` is optional and backward-compatible;
  no derivative objects are emitted until OCR/text/packet-copy artifacts exist.

## OCR/Text Citation Foundation

The OCR/text citation workstream is still additive and rollback-safe:

- `src/backend-spine/contracts.ts` now includes an `extraction_run` record type,
  OCR/text derivative object kinds, citation `createdAt` / `createdBy`, and
  citation-anchor `vaultObjectId` plus polygon support.
- `src/project-records/extraction-runs.ts` is a pure record builder only. It
  records local extraction lineage and derivative vault objects but does not
  invoke OCR tools, mutate originals, write Dexie rows, change `.landroid`
  package format, or call any cloud service.
- Selectable-PDF extraction is modeled separately from scanned-PDF OCR:
  `selectable_pdf_text` emits text derivatives, while `scanned_pdf_ocr` can emit
  searchable PDF, hOCR JSON, text JSON/text file, and page-image derivatives.
- Every derivative vault object emitted by the builder references the original
  object through `derivedFromVaultObjectId`; original vault objects are never
  replaced.
- Failed or canceled runs are allowed to emit only the failed `extraction_run`
  record. Derivative vault objects and citations are rejected for failed or
  canceled runs.
- Source citations produced from document text carry `documentVersionId`,
  `extractionRunId`, page, quoted-text hash, and one or more `citation_anchor`
  records with page and character span.

Local Mac tooling checkpoint from this workspace on 2026-06-01:

- Present: Tesseract 5.5.2 with `eng`, `osd`, and `snum` language data.
- Present: Poppler 26.04.0 tools `pdftotext`, `pdfimages`, and `pdftoppm`.
- Present: qpdf 12.3.2.
- Present: Ghostscript 10.07.0.
- Present: Python 3.13.9 from Anaconda.
- Missing: `ocrmypdf`.
- Missing: `mutool`.

Implementation implication:

- `pdftotext` is the local default path for embedded/selectable PDF text.
- `pdftoppm`/`pdfimages` plus Tesseract are the local default path for scanned
  PDF OCR text/hOCR/page images.
- Searchable PDF output should wait for `ocrmypdf` or an equivalent local
  pipeline before engine integration claims that derivative.
- Cloud OCR remains interface-only. No upload path exists. Any future cloud
  provider must be explicit per document and must record provider name,
  user approval, data-residency warning acceptance, and retention-policy
  acknowledgement before upload.
