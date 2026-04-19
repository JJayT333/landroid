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

## Repository safety rules
- Never commit directly to main.
- Prefer small, reversible change sets.
- Do not remove or rewrite working behavior unless required for the task.
- Do not add dependencies unless clearly justified.
- Never hardcode secrets, tokens, credentials, or sensitive data.
- Do not expose or move sensitive data outside the repository unless explicitly requested.
- Do not hand-edit generated build artifacts under `/dist` or `/dist-node` unless explicitly requested.

## Instruction precedence
- If instructions conflict, follow this order:
  1. system/developer/user chat instructions
  2. AGENTS.md
  3. PROJECT_CONTEXT.md

## Delivery process

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
2. Safety and preview UX for math-changing actions
3. Audit visibility and explainability
4. Optimization and hardening
5. Additional features only if clearly needed
