# ADR 0008: Backend Spine Decision Gate

## Status

Proposed for rebuild planning.

## Context

LANDroid is local-first today, but the expected growth path includes large
document vaults, OCR, packet exports, AI/RAG over evidence, multi-device use,
backup, and possible future collaboration. A backend could make those concerns
more durable, but it also adds API contracts, schema migrations, auth,
deployment, cloud cost, monitoring, and new failure modes.

The rebuild should not guess blindly before Phase 0 captures current behavior,
fixtures, scale, and workflow risks.

## Decision

Add a Phase 0.75 backend architecture decision gate after Phase 0 and before
Phase 0.5 storage work or Phase 1 schema implementation.

If approved, the backend is a spine, not a wholesale SaaS rewrite. It may own:

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

Likely starting shape if approved:

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

- No backend implementation starts before Phase 0 evidence and a written
  backend go/no-go.
- If approved, backend work must update security, deployment, testing, and
  architecture docs before implementation.
- If rejected or deferred, Phase 0.5 storage sharding remains the next storage
  step.
- The backend adds complexity, but it may avoid larger migration costs if
  LANDroid becomes document-heavy, OCR-heavy, AI/RAG-heavy, multi-project, or
  multi-device.
