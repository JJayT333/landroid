## System overview
This project provides tools for land/title workflows, ownership calculations, and related data processing.

The system prioritizes:
- correctness of calculations
- transparent auditability
- deterministic behavior
- predictable workflows for non-technical users

Performance and maintainability are prioritized over rapid feature expansion.
The active application surface currently lives at the repository root.

## Repository structure (current)
The active codebase is currently centered around:

- `/src`
  - Active LANDroid runtime modules, UI, business logic, storage, and tests.
- `/dist`
  - Generated browser-ready build output from `npm run build`; it is not the source of truth.
- `/dist-node`
  - Generated TypeScript config build output from the composite build.
- `/TORS_Documents`
  - Local PDF companions used by the current runsheet workflow.
- `/docs`
  - Active architecture notes, process docs, and phase-gate references.
- `/PROJECT_CONTEXT.md` and `/AGENTS.md`
  - Repository-level operating rules and architectural context.

The repository root now serves as both the active app root and the coordination layer for repo-wide docs, launchers, and validation commands.

## Core domain concepts
Important domain concepts include:

- ownership graphs or trees
- fractions or proportional interests
- recalculation of derived ownership values
- parent/child relationships between entities
- correction workflows for historical chains

These operations must remain deterministic and auditable.

## Key invariants
The following must always hold true when applicable:

- no negative fractional ownership values
- all numeric values must remain finite
- no cycles in ownership graphs
- valid parent references
- totals must remain within accepted tolerance

Any change affecting calculations must preserve these invariants.

## Performance considerations
The system may process large ownership graphs.

Avoid:
- unnecessary recomputation
- overly broad reactive dependencies
- redundant derived-state calculations

Favor efficient, scoped calculations.

## Testing expectations
Changes affecting calculations or ownership logic should include targeted tests.

Tests should verify:
- deterministic results
- invariant preservation
- correct recalculation behavior
- handling of edge cases

Primary validation should run through local `npm test` from the repository root against the active root app.
Avoid unnecessarily bloating test runtime.

## Development priorities
Unless explicitly overridden, prioritize work in this order:

1. correctness and invariants
2. safe preview UX for calculation changes
3. audit visibility and explainability
4. performance and hardening
5. additional features only when clearly needed

## Out-of-scope assumptions
Unless instructed otherwise:

- do not add speculative features
- do not introduce new frameworks
- do not rewrite working architecture
- do not introduce new dependencies without justification
