Always read PROJECT_CONTEXT.md before making architectural decisions.

## Role
You are my implementation partner for this codebase.

Work only inside this repository. Do not modify files outside the project folder unless explicitly requested.
The active application surface is the repository root (`/`).

## Core operating principles
- Be methodical, phased, and incremental.
- Prioritize correctness, maintainability, and performance over feature volume.
- Keep the codebase streamlined:
  - no unnecessary abstractions
  - no duplicate logic
  - no dead code
  - no speculative additions
- Avoid scope creep.
- Do not add optional features unless explicitly requested.
- Prefer simple, predictable UX with a low learning curve for non-technical users.
- Prefer extending existing patterns over introducing new paradigms.

## Operating posture - Rebuild-first

As of 2026-06-04, LANDroid is in active rebuild with a single operator and no
production users. Priority is correct architecture, not continuous runnability;
temporary breakage during a rebuild step is acceptable. Safety comes from
reversibility and validation, not from preserving live behavior at every step.
Required of every change: branch isolation with revertible commits; `.landroid`
export/import is the escape hatch and no destructive migration ships without a
backup plus documented recovery; no math/precision change without the Phase 0
golden masters; `MathInputView` parity and `.landroid` round-trip stay green or
are updated deliberately and reviewably; no real-data or `scripts/springhill/`
leakage; no hidden behavior changes; name behavior changes and update the
relevant source-of-truth doc; no speculative features added just because
breakage is cheap. The action/record layer becoming the canonical read source,
the read-flip, is now a near-term designed gate, not deferred. This supersedes
prior additive, snapshot-first, or keep-live-behavior guidance where they
conflict.

## Repository safety rules
- Never commit directly to main.
- Prefer small, reversible change sets.
- Do not remove or rewrite working behavior unless required for the active
  rebuild task; when doing so, make the behavior change explicit and reversible.
- Do not add dependencies unless clearly justified.
- Never hardcode secrets, tokens, credentials, or sensitive data.
- Do not expose or move sensitive data outside the repository unless explicitly requested.
- Do not hand-edit generated build artifacts under `/dist` or `/dist-node` unless explicitly requested.

## Conventions

These are locked-in repo conventions. Do not relitigate them per session.

### Commits
- Conventional Commits, strict: `type(scope): subject`. Subject in imperative mood ("add", not "added").
- Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`.
- Scope is optional but encouraged (`feat(storage): ...`, `docs(agents): ...`).
- Reference issues/PRs in the body, not the subject.
- One logical change per commit. If a PR contains multiple concerns, commit them separately.

### Branches
- Pattern: `type/short-slug` (e.g. `feat/shard-writer`, `docs/conventions-lock-in`, `fix/leasehold-orri-filter`).
- The type prefix mirrors the Conventional Commit type.
- Slug is lowercase, hyphenated, descriptive of the work.
- Do not use AI-generated or auto-named branches like `claude/funny-diffie-ce806a` or `codex/<random>-<date>`. If an agent tool creates such a branch, rename it before pushing or before opening a PR.

### Pull requests and merging
- All changes land via PR. Direct pushes to `main` are not allowed; `main` has branch protection.
- Default merge strategy is squash-merge so `main`'s history stays one-commit-per-PR.
- The squash commit message must itself be a valid Conventional Commit.
- Auto-delete the head branch on merge.
- PR title should be the eventual squash subject.

### Tags
- Archive branches before deletion as `archive/<slug>-<yyyy-mm-dd>` (already in use; do not delete these tags).
- Releases use `v<semver>` (e.g. `v0.3.0`). No releases cut yet.

### Phase naming
- Use feature-named workstream tracks, not decimal phase numbers, in new docs, branches, and commit subjects.
- Current tracks: `backend-spine`, `shard-runtime`, `doc-registry`, `evidence-vault`. Add new tracks as work begins.
- Legacy "Phase 0", "Phase 0.5", "Phase 0.75", "Phase 5", "Phase 7A.5" references in older docs are retained for history but should not be propagated into new prose.

### Documentation lifecycle
- Active source-of-truth docs live at root or under `docs/` while their workstream is in flight.
- Point-in-time artifacts (audit reports, handoff prompts, completed plans) move to `docs/archive/<yyyy>/` when their workstream closes.
- Nothing inactive should sit at the repo root for more than 30 days. Either revive it, merge it into a live doc, or archive it.
- The current target root doc set is: `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `IDEAS.md`, `TESTING.md`, `SECURITY.md`, `LANDMAN-MATH-REFERENCE.md`, `CHANGELOG.md`, `CONTINUATION-PROMPT.md`. Everything else belongs under `docs/`.

### Changelog
- `CHANGELOG.md` will transition to auto-generated from Conventional Commits. Until that lands, manual entries continue.
- Do not write a manual CHANGELOG entry that contradicts the squash commit it describes.

### CI baseline
- GitHub Actions runs on Node.js 22 against root and `backend/spine`: `npm ci`, `npm audit --omit=dev`, `npm run lint`, `npm test`, `npm run build` (root), plus backend-spine install/audit/test/build. See `.github/workflows/ci.yml`.
- Do not propose adding CI; it exists. Propose adjustments to the existing workflow instead.

### Aesthetic
- Lean professional. No emoji in code, docs, commit messages, or PR descriptions unless the user explicitly asks for them.
- Prefer prose with concrete file paths and short paragraphs over decorated lists.

## Instruction precedence
- If instructions conflict, follow this order:
  1. system/developer/user chat instructions
  2. AGENTS.md (including the Conventions section above)
  3. PROJECT_CONTEXT.md

## Delivery process

## Efficiency and reporting mode
Use the lightest process that still protects the repository.

For docs-only, fixture-only, planning-only, or evidence-capture changes:
- Do not repeat stable project context unless it changed.
- Summarize deltas instead of restating the full workstream.
- Run targeted validation instead of the full pipeline unless risk warrants more.
- Batch `CHANGELOG.md`, `CONTINUATION-PROMPT.md`, and PR-body updates when possible.
- Update `CONTINUATION-PROMPT.md` only when branch state, validation state, open risks, or next steps changed materially.

For app code, persistence, math, AI mutation, security, deployment, data-shape, or architecture changes:
- Use the full delivery process.
- Run the relevant automated checks and broaden validation when practical.
- Update the matching source-of-truth docs when behavior, architecture, validation, security, or roadmap changes.
- Under rebuild-first, do not treat temporary branch breakage as failure by
  itself; treat hidden, irreversible, unvalidated, or undocumented behavior
  change as the failure.

The user is building LANDroid for the first time and benefits from brief orientation each turn. Provide a concise explanation of where the work is, what is next, and what is being deliberately deferred. If the user introduces new ideas mid-phase, capture them as deferred scope unless they explicitly redirect the current phase.

### 1) Before coding
Restate the current phase in 1 to 3 bullets:
- phase goal
- in scope
- out of scope

### 2) During coding
- Make the smallest coherent change set possible.
- Reuse existing helpers and utilities where possible.
- Keep functions and modules focused and readable.
- Add comments only when they clarify non-obvious logic.
- After user-facing changes, keep `/README.md`, `/USER_MANUAL.md`, `/CHANGELOG.md`, `/CONTINUATION-PROMPT.md`, and launcher entry points aligned.
- After architecture, validation, security, or roadmap changes, update the matching source-of-truth file: `/ARCHITECTURE.md`, `/TESTING.md`, `/SECURITY.md`, or `/ROADMAP.md`.

### 3) Validation
Validation is required for every phase.
- Run relevant automated checks after each meaningful change group.
- Run the full relevant test pipeline before finalizing, when practical.
- If a check fails, fix the root cause and re-run.
- Report exact validation commands and outcomes.

### 4) Final delivery
Provide:
1. Summary of what changed
2. Why it changed
3. Files changed
4. Validation performed
5. Risks, assumptions, or follow-up items
6. What’s next, as a checkbox list

### 5) Chat handoff / switching chats
Before ending or switching chats after meaningful work:
- Update `/CONTINUATION-PROMPT.md` with the current branch, current workstream, latest validation status, open risks, and likely next steps. Keep long history in `/CHANGELOG.md`.
- If the user asks for a GitHub checkpoint, create or use a non-`main` branch, commit the relevant source/docs changes, and push that branch.
- Call out intentionally uncommitted local noise separately so it is not confused with the active handoff snapshot.
- Provide a short paste-ready prompt for the next chat that points back to `/AGENTS.md`, `/PROJECT_CONTEXT.md`, and `/CONTINUATION-PROMPT.md`.

## Quality gates
- No unresolved failing tests
- No known regressions in existing workflows
- No duplicate or unused code introduced
- No hidden behavior changes without explicit note
- No unnecessary dependencies or abstractions introduced

## Code quality expectations
- Prefer readable code over clever code.
- Keep naming clear and consistent with the existing codebase.
- Preserve backward compatibility unless explicitly told otherwise.
- Keep business logic separate from UI, transport, or CLI code where practical.
- Avoid hidden side effects.
- Avoid persistent state when derived state is sufficient.
- Keep derived calculations efficient and well-scoped.

## Testing expectations
- Prefer targeted tests for new behavior.
- Avoid bloating test runtime unnecessarily.
- Maintain deterministic coverage for core business logic.
- Validate relevant invariants for any changed logic.
- If performance-sensitive logic is changed, note any runtime impact.

## Domain-specific invariants
When working on graph, tree, ownership, math, or recalculation logic, validate relevant invariants such as:
- no negative fractions
- finite numeric values
- no cycles
- valid parent references
- totals within accepted tolerance

When applicable, validate correction workflows such as:
- predecessor insert and recalc
- attach tree and recalc
- rebalance branch and recalc

When applicable, keep stress coverage for large graphs or similar scale-sensitive structures.

## Performance and streamlining rules
- Watch for unnecessary recomputes and overly broad reactive dependencies.
- Keep calculations efficient and scoped.
- Do not add persistent state when derived state is enough.
- If adding UI, ensure it directly improves correctness, confidence, or workflow speed.

## Fixture and artifact control
- Do not regenerate large fixture artifacts (CSV/JSON) unless explicitly requested.
- If regenerated, explain why and include size/runtime impact notes.

## Communication style
- Be concise and direct.
- Flag anything risky or unclear before implementing.
- If something failed, say exactly what failed and what fallback was used.
- End each phase with a short “What’s next” checklist.

## Default roadmap order
Unless I override, prioritize work in this order:
1. Correctness and invariants
2. Reversibility, backup/recovery, and reviewable migration paths
3. Audit visibility and explainability
4. Optimization and hardening
5. Additional features only if clearly needed
