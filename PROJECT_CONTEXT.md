## System overview
This project provides tools for land/title workflows, ownership calculations, and related data processing.

The system prioritizes:
- correctness of calculations
- transparent auditability
- deterministic behavior
- predictable workflows for non-technical users

Performance and maintainability are prioritized over rapid feature expansion.

## Repository structure (current)
The codebase is currently centered around:

- `/src`
  - Core application runtime modules and UI/business behavior.
- `/scripts`
  - Standalone validation and data-processing helpers.
- `/docs`
  - Architecture notes, process docs, and phase-gate references.
- `/testdata`
  - Deterministic stress fixtures and supporting artifacts.
- `/dist`
  - Built/distributed outputs.

Optional structures such as `/backend`, `/frontend`, or `/tests` may be introduced later if explicitly needed.

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

Primary pipeline uses local Node script checks via `npm test`.
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
