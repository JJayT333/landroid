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

## Sensitive Data

Treat these as sensitive:

- title chains and ownership fractions
- owner/contact information
- lease records and economics
- PDFs and source documents
- research notes and project records
- AI prompts and chat context
- cloud provider API keys

## AI Providers

- Ollama/local models are the preferred default.
- OpenAI and Anthropic keys are session-only and should not persist to browser
  storage.
- Cloud provider use can send prompt context and project data to third parties.
  Use cloud AI only when that is acceptable for the current project.
- Hosted/cloud mode uses a backend proxy with server-held keys. Keep Cognito
  JWT verification, server-side model policy, durable token-ceiling tracking,
  request body caps, body-field allowlisting, and structured request logging
  covered by proxy tests before broadening access.
- Hosted AI currently receives only `readOnlyLandroidTools`; `HOSTED_BLOCKED_TOOL_NAMES`
  also excludes persisted-focus tools such as `setActiveDeskMap` until an
  approval boundary exists.
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

- The production `xlsx` dependency has unresolved high-severity advisories.
  Keep workbook parsing local, add size/timeout containment, and replace or
  isolate the read path when practical.
- Imported or legacy lease royalty, ORRI burden, and WI assignment fractions are
  strict-parsed before leasehold math. Malformed non-blank values must stay
  warning-visible and treated as 0 until corrected, not silently clamped.

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
