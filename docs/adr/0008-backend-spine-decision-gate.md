# ADR 0008: Backend Spine Decision Gate

## Status

Accepted for rebuild planning; implementation deferred.

## Context

LANDroid is local-first today, but the expected growth path includes large
document vaults, OCR, packet exports, AI/RAG over evidence, multi-device use,
backup, and possible future collaboration. A backend could make those concerns
more durable, but it also adds API contracts, schema migrations, auth,
deployment, cloud cost, monitoring, and new failure modes.

The rebuild should not build the backend before Phase 0 captures current
behavior, fixtures, scale, and workflow risks. The architecture decision can be
made now because the product direction is clear: LANDroid should be a hosted web
app with PWA/iPad support, while remaining local-first and exportable.

## Decision

Approve the backend spine in principle at Phase 0.75, but defer backend
implementation until a hard trigger appears: OCR/search at document scale,
multi-device sync, live sharing, second-user access, or browser storage limits.

Phase 0.5 through Phase 6 must be local-first and backend-ready. That means
stable record IDs, `workspaceId` scoping, `lastModified` / version fields where
needed, content-hash blob addressing, and sharded local records rather than a
single opaque workspace payload.

The backend is a spine, not a wholesale SaaS rewrite. It may own:

- durable project-record storage
- object storage for originals, derivatives, and packet artifacts
- signed document access URLs
- OCR, extraction, indexing, and packet-export background jobs
- exact/keyword search and later vector recall
- server-controlled AI/RAG retrieval and provider policy
- durable action/audit records
- backup and multi-device sync
- future multi-user permissions
- future cross-project party identity indexes

The backend must not remove local-first project semantics. Complete `.landroid`
package export remains mandatory.

Likely starting shape when triggered:

```text
Frontend: React/Vite LANDroid
Local cache: Dexie
Backend API: Node/Fastify or similar
Database: Postgres
Object storage: S3/R2-compatible
Jobs: OCR, indexing, packet export
Search: Postgres FTS first, vector later
Auth: Cognito or replacement auth provider
AI gateway: server-controlled provider access and policy
Export: .landroid package remains mandatory
```

## Consequences

- No backend implementation starts before Phase 0 evidence and a documented
  hard trigger.
- Backend work must update security, deployment, testing, and architecture docs
  before implementation.
- Phase 0.5 storage sharding remains the next storage step and must preserve
  backend-ready record shape.
- Hosted web/PWA is the product direction. Native iOS and desktop installers
  remain deferred unless a later decision gate proves they are necessary.
- The backend adds complexity, but it may avoid larger migration costs if
  LANDroid becomes document-heavy, OCR-heavy, AI/RAG-heavy, multi-project, or
  multi-device.
