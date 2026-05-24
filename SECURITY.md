# LANDroid Security Notes

LANDroid is currently designed as a single-user, local-first browser app. This
file records the security assumptions future changes should preserve or revisit.

## Current Security Model

- The app normally runs locally through Vite or the launcher scripts.
- Workspace data is stored in browser IndexedDB and exported through `.landroid`
  files.
- The user is assumed to control the local machine and browser profile.
- Hosted deployment is a POC surface: Cognito gates the app, AI calls go
  through the Lambda proxy, and workspace autosave remains browser IndexedDB
  scoped by Cognito `sub` rather than a shared backend project database.
- Rebuild planning keeps LANDroid local-first. The backend architecture is
  approved in principle, but backend implementation is deferred until OCR,
  search, sync, sharing, multi-user, or storage scale forces it. Workspace
  sharding, evidence-vault packaging, backend-ready record shapes, and citation
  verification come first.
- Backend sync must not become an excuse to remove offline core workflows or
  complete `.landroid` package export. A backend spine must have an explicit
  threat model before implementation and must preserve complete local
  project-package export.
- PWA/iPad support is a product target. Browser storage must be treated as
  evictable unless persistent storage is requested and granted; the app should
  surface storage/export health instead of hiding durability risk.

## Sensitive Data

Treat these as sensitive:

- title chains and ownership fractions
- owner/contact information
- lease records and economics
- PDFs and source documents
- research notes and project records
- AI prompts and chat context
- cloud provider API keys

## Rebuild Security Direction

The planned rebuild direction should be more secure than the current app only
if the safety gates in the rebuild plan are implemented. The current app has
good local containment, but it still depends heavily on one browser profile and
manual `.landroid` exports. That is a durability risk, not a privacy win.

Security improvements the rebuild should preserve or add:

- sharded local records instead of one opaque workspace blob
- stable record IDs, `workspaceId` scoping, and `lastModified` / version fields
  for future sync conflict detection
- content-hash addressing for document blobs and packet artifacts
- immutable original document bytes plus derivative OCR/index records
- visible storage health: last saved, last exported, browser storage status,
  and backup/export warnings
- rolling `.landroid` auto-export where the browser platform supports it
- persistent-storage requests for PWA/iPad use, with visible fallback when the
  browser refuses
- multi-tab or concurrent-writer protection before sharded storage is treated
  as production-safe
- private backend object storage, signed URLs, server-side authorization, and
  encryption at rest when a backend is triggered
- citation-verified AI answers and approval-gated mutations with undo

Security risks that do not disappear just because LANDroid is hosted:

- cloud storage creates custody duties for title documents, leases, owner
  contact information, and AI context
- OCR, embeddings, and search indexes become sensitive derived data
- sharing links require authorization, expiry, and revocation rules
- multi-device sync creates stale-write and conflict risks
- cloud AI can disclose project context to third-party providers unless each
  provider path is explicitly approved
- server logs can accidentally retain sensitive prompts, owner data, or document
  references if logging is too broad

Before backend implementation starts, create a threat model for the actual
backend design. At minimum, cover assets, actors, trust boundaries, document
upload/download paths, sync conflicts, backup/export, AI provider calls, OCR
jobs, sharing links, audit events, and incident recovery.

## AI Providers

- Ollama/local models are the preferred default.
- OpenAI and Anthropic keys are session-only and should not persist to browser
  storage.
- Cloud provider use can send prompt context and project data to third parties.
  Use cloud AI only when that is acceptable for the current project.
- Hosted/cloud mode uses a backend proxy with server-held keys. Keep Cognito
  JWT verification, server-side model policy, durable token-ceiling tracking,
  request body caps, body-field allowlisting, client-supplied tool-schema
  rejection, and structured request logging covered by proxy tests before
  broadening access.
- Hosted browser persistence is keyed by the Cognito `sub` claim. Signed-out
  hosted state must not read or write the local `default` workspace/canvas rows;
  the persistence key helpers now stay locked until a real `sub` is available.
- AI mutating tools are app-gated through the approval queue. Tool calls create
  pending proposals; only the user approval button applies a proposal, and each
  approved batch captures one undo snapshot. Proposal cards include typed
  before/after previews and graph-validation previews; blocked previews cannot
  be approved. Undo snapshot capture fails closed if document workspace export
  fails, so LANDroid must not approve an AI edit with an empty fallback document
  snapshot. Approved proposal results are recorded in an in-memory action/result
  journal and summarized into future local model turns; treat that journal as AI
  context, not a durable audit log. Hosted AI still receives only
  `readOnlyLandroidTools` until the hosted approval path is reviewed, and the
  hosted proxy rejects client-supplied `tools` / `tool_choice` bodies.
- Phase 5 added document persistence and UI, but no AI document-mutating tools.
  If tools such as `saveDoc`, `deleteDoc`, `renameDoc`, `attachDocToEntity`, or
  `detachDocFromEntity` land later, add them to `HOSTED_BLOCKED_TOOL_NAMES`
  in the same change set.
- The hosted AI proxy currently uses a Lambda Function URL with auth type
  `NONE`; the security boundary is handler-side Cognito ID-token verification.
  Function URL CORS reduces accidental browser misuse but is not a stolen-token
  replay defense.

## File Uploads

Treat all imported files as untrusted:

- `.landroid`
- `.csv`
- `.xlsx` / `.xls`
- PDFs, images, ZIPs, GeoJSON, TXT, and RRC source files

Known risk:

- Binary Excel parsing is disabled in the AI import path because the previous
  production `xlsx` dependency had unresolved high-severity advisories. AI
  spreadsheet review currently accepts CSV only; `.xlsx` / `.xls` files may be
  stored only as unparsed uploaded documents until a safer parser is selected.
- CSV cells rendered into AI prompts are labeled as untrusted user data. Cells
  that contain instructions must be treated as spreadsheet text, not commands.
- Document-registry PDFs are treated as PDF-only content. New node-document
  uploads are magic-byte checked, `.landroid` document rows and legacy PDF rows
  are rejected unless the decoded bytes begin with a PDF header, stored PDF
  MIME is normalized to `application/pdf`, and PDF iframe previews are
  sandboxed without same-origin privileges. Document attachments are
  workspace-scoped on the link row as well as on the blob row. UI document
  removal detaches only the current link, while branch/tract document cleanup
  deletes only documents that have no surviving attachment links. Owner and
  Research uploads use explicit extension allowlists plus the shared size
  limits before saving.
- Map asset uploads also use an explicit passive-file allowlist and validate
  PDF magic bytes before saving or previewing PDF maps.
- Imported or legacy lease royalty, ORRI burden, and WI assignment fractions are
  strict-parsed before leasehold math. Malformed non-blank values must stay
  warning-visible and treated as 0 until corrected, not silently clamped.
- Persisted `.landroid` node fraction fields and explicit lease jurisdiction
  values are strict. Missing legacy jurisdiction still defaults to `tx_fee`, but
  an explicit unknown jurisdiction now blocks import/normalization instead of
  silently entering Texas math.
- `.landroid` imports from future schema versions are rejected instead of being
  partially normalized by an older app build. Side-store replacement for
  `.landroid` loads snapshots the previous active side stores and rolls them
  back if replacement fails before the core workspace is swapped.

## Document Database / OCR Planning

- Phase 7 planning treats LANDroid as the document registry and query index;
  Dropbox, local folders, or later object storage are raw-file vault options,
  not substitutes for structured metadata, entity links, hashes, OCR status,
  and citations.
- The rebuild target treats document originals as evidence. Original bytes
  should be immutable after import, content-hashed, MIME/magic validated, and
  tracked separately from OCR PDFs, page images, text, hOCR, embeddings, and
  packet copies.
- `DocumentVersion`, `VaultObject`, `ExtractionRun`, and `SourceCitation`
  records are security-relevant because they prove which original file,
  derivative, OCR engine/version, page, and span supported a claim.
- Meaningful vault, packet, import, AI-approval, and destructive actions should
  be able to write append-only audit events with hash continuity. Attorney
  packets should include deterministic manifests and SHA-256 checksums; signed
  or Merkle-rooted manifests are a later hardening option.
- OCR text is sensitive because it can expose full title instruments, owner
  names, lease economics, and legal descriptions. Do not send documents or OCR
  text to cloud OCR or cloud AI without an explicit provider/security decision.
- OCR text, extracted JSON, hOCR, embeddings, and vector/keyword indexes are
  sensitive derived data. Treat them as project data even if they can be
  rebuilt from originals.
- Cloud OCR must be per-document opt-in, with provider, retention, logging,
  training-use, region/data-residency, and deletion expectations documented
  before upload.
- Backend object storage, if added later, must use private buckets/containers,
  server-side authorization, short-lived signed URLs where needed, encryption at
  rest, and manifest/hash verification. Do not make browser-public object paths
  part of the trust model.
- Backend-ready local records should include stable IDs, `workspaceId` scoping,
  `lastModified` / version metadata where needed, and content hashes for blobs
  before any sync engine is implemented. These fields are security-relevant
  because they constrain accidental cross-project bleed, stale writes, and
  unverifiable document replacement.
- AI document query should be read-only by default and return cited source
  references. Automatic title updates from OCR or AI remain out of scope until
  separately designed.
- AI answers must pass a structural citation-verification gate before display.
  If a claim cannot trace to a source citation, record ID, deterministic math
  result, approved action record, or explicit curative issue, LANDroid should
  report insufficient evidence instead of showing a plausible answer.
- Pre-OCR AI may cite structured records and source attestations, but must not
  cite document text spans that LANDroid has not extracted and anchored.

## Browser Security

If LANDroid is deployed beyond localhost, define a real content-security policy.
At minimum, review:

- `script-src`
- `style-src`
- `font-src`
- `connect-src` for Ollama and cloud AI endpoints
- Cognito Hosted UI plus user-pool issuer metadata/JWKS endpoints
- `img-src` / `media-src` for document previews

Do not assume local-first safety carries over to hosted deployments.

## Practical Rules For Future Work

- Never hardcode secrets.
- Do not log API keys, owner PII, source documents, or full AI prompts unless
  the user explicitly asks for debugging output.
- Keep cloud keys out of persistent browser storage.
- Keep federal/private records reference-only until the Phase 2 math gate opens.
- Add validation and size limits to import paths before broadening file support.
- Do not add backend storage, OCR jobs, cloud object storage, server-side RAG,
  sharing links, sync, or multi-user permissions without updating the security
  model, threat model, deployment docs, and validation plan in the same phase.
