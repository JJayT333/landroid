# Phase 0.75 Minimal Backend Spine Threat Model

Status: Phase 0.75 note updated for the app startup contract check.

This note covers only the minimal backend-spine slice: shared contracts,
adapter boundary, health/session proof, record-validation endpoint, and the
non-user-facing app startup contract check. It does not approve durable backend
project storage, object storage, document upload, OCR/search jobs, sync,
sharing, collaboration, or multi-user permissions.

## Assets

- Cognito ID tokens and verified Cognito `sub` values.
- Project/workspace IDs and backend-shaped record metadata.
- Document metadata, hashes, and vault-object references.
- Action/audit metadata.
- `.landroid` package/export continuity.

The minimal spine must not receive document bytes, OCR text, embeddings, owner
PII beyond metadata needed for record validation, cloud provider keys, or full
AI prompts.

## Actors

- Local single user in browser/Dexie mode.
- Hosted authenticated user with a Cognito ID token.
- Unauthenticated browser or script caller.
- Future backend service code using the same contracts.

Future second-user, sharing-link, collaboration, admin, and support roles are
out of scope for this slice.

## Trust Boundaries

- Browser local state to backend adapter.
- Hosted request to backend endpoint.
- Amplify rewrite to the backend-spine Lambda Function URL.
- Cognito token verification boundary.
- Record payload validation boundary.
- Local `.landroid` package import/export boundary.

The backend must derive user identity from the verified token. It must not
trust client-supplied user IDs, tenant IDs, project owner IDs, or permission
claims.

## Controls Required Now

- Health endpoint can be unauthenticated but returns no project data.
- Session and record-validation endpoints require a bearer token in hosted
  mode.
- The hosted `/api/spine/*` path is a separate minimal Lambda package; it must
  not share the AI proxy's OpenAI key or usage-store responsibilities.
- Request bodies are size-limited before JSON/schema work.
- Request payloads use strict schemas; unknown keys and future schema versions
  fail closed.
- Validation responses can report schema paths and messages, but must not echo
  raw sensitive payloads in logs.
- Hosted spine logs use JSON request/reject events with route, status, reason,
  issue counts, and verified `sub` where available. They must not log request
  bodies, record payloads, document names, owner data, OCR text, or AI prompts.
- The app-side startup check sends only health, session, and a synthetic
  project-record validation probe with placeholder IDs; it must not include
  real project records or document payloads.
- Local-only and mock adapters preserve offline operation and do not require a
  network path.
- `.landroid` export remains complete even if backend validation is unavailable.

## Deferred Controls

- Object-storage bucket/container policy, signed URLs, encryption-at-rest
  verification, and document upload scanning.
- Durable project-record database authorization and row-level access checks.
- Sync conflict resolution and stale-write prevention.
- Sharing links, revocation, collaboration presence, and multi-user role maps.
- OCR/search job isolation, provider retention policy, and index deletion.
- Per-user rate limits or budget checks for hosted `/api/spine/validate-records`.
- Incident-response runbooks for hosted project storage.

These controls must be designed before later backend expansion.

## Validation

Phase 0.75 minimal-spine tests should prove:

- unauthenticated session/validation requests fail closed
- verified token `sub` is used instead of client-supplied identity fields
- health/session/record-validation responses match shared schemas
- the app startup contract check is non-blocking and sends no project records
- request body caps are enforced
- unknown/future schemas fail closed
- local-only and mock adapters do not break offline behavior
