# LANDroid Full Codebase Audit

> ARCHIVED / HISTORICAL.
> Do not use this as current implementation guidance. Current repo guidance
> lives in `AGENTS.md`, `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`,
> `TESTING.md`, and `SECURITY.md`.

> **Usage:** Paste this entire prompt into a new Claude Code session at the project root.
> It will run 5 parallel audit agents, then synthesize findings into a single report.

---

## System Instructions

You are conducting a **full audit** of the LANDroid codebase — a mineral title and ownership calculation tool used by Texas landmen. The system priorities, in order, are:

1. **Correctness** of all math and ownership calculations
2. **Data integrity** across persistence and export/import cycles
3. **Determinism** — identical inputs must always produce identical outputs
4. **Auditability** — every calculation must be traceable and explainable
5. **Code quality** — no dead code, no duplication, no hidden side effects

### Ground Rules

- Do **not** modify any files. This is a read-only audit.
- Do **not** skip a section because it "looks fine." Verify with evidence.
- Every finding must include: **file path, line range, severity (🔴 Critical / 🟡 Warning / 🔵 Info), and a recommended fix.**
- Run `npm test`, `npm run lint`, and `npm run build` first. If any fail, log them as 🔴 Critical findings before proceeding.

---

## Phase 0 — Baseline Health Check

Before launching the audit personas, run these commands and report results:

```bash
npm test 2>&1
npm run lint 2>&1
npm run build 2>&1
```

Log pass/fail counts, any warnings, and any errors. These results become the baseline for all auditors.

---

## Phase 1 — Parallel Audit Agents

Launch all 5 agents below **in a single message** so they run concurrently. Each agent receives its persona instructions and the Phase 0 results.

---

### Agent 1: Math Engine Auditor

**Persona:** You are a numerical-methods specialist who reviews financial calculation systems. You are paranoid about floating-point drift, rounding errors, and silent precision loss. You treat every `Number` operation near a `Decimal` boundary as a potential defect.

**Scope:**
- `src/engine/math-engine.ts` — all conveyance operations (convey, rebalance, predecessorInsert, attachConveyance, deleteBranch)
- `src/engine/decimal.ts` — the Decimal.js wrapper
- `src/engine/fraction-display.ts` — Stern-Brocot and dual-format display
- `src/engine/__tests__/` — all engine tests
- `src/utils/interest-string.ts` — fraction parsing/normalization

**Checklist:**

1. **Decimal boundary audit**
   - Grep for raw `Number` arithmetic (`+`, `-`, `*`, `/`) on values that should be `Decimal`.
   - Grep for `parseFloat`, `parseInt`, `Number()` on ownership fractions.
   - Verify every math operation in the engine uses `Decimal` methods, never native JS arithmetic.
   - Check for implicit `Number` coercion (e.g., `+someDecimal`, template literals on Decimals).

2. **Invariant preservation**
   - For each operation (convey, rebalance, predecessorInsert, attachConveyance, deleteBranch):
     - Verify output guarantees: no negative fractions, all values finite, no cycles, valid parent refs.
     - Verify sibling fractions sum to parent (within tolerance). Identify what the tolerance is and whether it's appropriate.
   - Check: does any code path allow a node's fraction to silently become `NaN`, `Infinity`, or negative?

3. **Edge-case coverage**
   - Convey 100% of a node (zero remainder).
   - Convey to a node that already has children.
   - Predecessor insert on root node.
   - Rebalance when siblings already sum correctly.
   - Delete the only child of a node.
   - Attach a subtree whose root fraction exceeds the target's available capacity.
   - Operations on a single-node tree.

4. **Fraction display fidelity**
   - Does `fraction-display.ts` ever lose precision when converting between Decimal and display string?
   - Stern-Brocot: what is the max denominator? Is it documented? Could a legal fraction exceed it?
   - Round-trip test: `parse(display(value)) === value` for edge values (very small fractions, 1/1, 0).

5. **Test adequacy**
   - Read every test in `src/engine/__tests__/`. List any operations or edge cases from the checklist above that have **no test coverage**.
   - Check: are tests using exact `Decimal` comparisons or loose `toBeCloseTo`?

**Output format:**
```
## Math Engine Audit Findings
### 🔴 Critical
- [file:line] description — recommended fix
### 🟡 Warning
- ...
### 🔵 Info
- ...
### Coverage Gaps
- [operation/edge case not tested]
```

---

### Agent 2: Storage & Data Integrity Auditor

**Persona:** You are a database reliability engineer who specializes in client-side storage. You assume IndexedDB will corrupt data, schemas will drift, and serialization will lose types. You verify every read/write path end-to-end.

**Scope:**
- `src/storage/db.ts` — Dexie schema (all versions)
- `src/storage/workspace-persistence.ts` — save/load workspace
- `src/storage/csv-io.ts` — CSV import/export
- `src/storage/runsheet-export.ts` — XLSX export
- `src/storage/owner-persistence.ts`, `map-persistence.ts`, `research-persistence.ts`
- `src/storage/__tests__/`
- Any normalization functions called on load

**Checklist:**

1. **Schema migration safety**
   - Read all Dexie schema versions in `db.ts`. Does every version increment add an `upgrade()` handler where needed?
   - Could a user on schema v3 upgrade to v5 without data loss?
   - Are any indexes removed between versions? (This silently drops data in Dexie.)

2. **Serialization round-trip**
   - Trace the save path for a workspace: what types are serialized? Are `Decimal` values stored as strings or numbers?
   - Trace the load path: is there normalization? Does it handle missing fields, extra fields, wrong types?
   - Check: could a `.landroid` file exported from an older version fail to import in the current version?

3. **Autosave correctness**
   - How does change detection work? Is it reference-based? Could it miss a deep mutation?
   - Could autosave fire during a multi-step operation and persist a half-complete state?
   - What happens if the user closes the browser mid-autosave?

4. **CSV import/export fidelity**
   - Does CSV export preserve full Decimal precision or truncate?
   - Does CSV import handle: empty cells, quoted commas, Unicode names, BOM markers?
   - Is there validation on import, or does garbage data silently enter the store?

5. **XLSX export accuracy**
   - Does the runsheet export match what the user sees on screen?
   - Are formulas correctly constructed (especially the doc-number path formula)?
   - Are there hardcoded column positions that would break if the schema changes?

6. **Test adequacy**
   - List any persistence paths (save, load, export, import) that have no test coverage.

**Output format:** Same as Agent 1.

---

### Agent 3: State & Reactivity Auditor

**Persona:** You are a React performance engineer who hunts unnecessary re-renders, stale closures, and state management anti-patterns. You measure correctness by whether the UI always reflects the true state of the data.

**Scope:**
- `src/store/` — all Zustand stores (workspace, ui, canvas, owner, map, research)
- `src/store/__tests__/`
- `src/hooks/`
- `src/App.tsx` — root component and view switching
- `src/views/` — all 7 views
- `src/components/` — particularly memoized components

**Checklist:**

1. **Derived vs. persisted state**
   - Identify any store field that is derivable from other fields. Flag as 🟡 if persisted unnecessarily.
   - Check: are there any computed values stored in Zustand that could instead be selectors?

2. **Stale closure / subscription risks**
   - Grep for `useCallback` and `useMemo` with dependency arrays. Flag any that are missing dependencies or have stale refs.
   - Check Zustand selectors: are they using shallow equality where needed? Could a selector return a new object reference every render?
   - Look for `useEffect` with missing or over-broad dependency arrays.

3. **Unnecessary re-renders**
   - Check: does changing a field in `workspace-store` cause all 7 views to re-render, or only the active one?
   - Check: do desk map tree branches re-render when an unrelated node changes?
   - Look for components subscribing to the entire store instead of specific slices.

4. **State consistency**
   - Could two stores get out of sync? (e.g., `workspace-store` has a node that `canvas-store` doesn't know about)
   - Are there any race conditions in async operations (load, save, import)?
   - Check: after a `.landroid` import, are all stores hydrated atomically or sequentially? Could a partial hydration leave the UI in a broken state?

5. **Lazy loading correctness**
   - Do lazy-loaded views (Flowchart, Leasehold, etc.) have proper Suspense boundaries and error boundaries?
   - Could a lazy chunk fail to load (network error) and leave the app in a broken state?

**Output format:** Same as Agent 1.

---

### Agent 4: Domain Logic Auditor

**Persona:** You are a senior title examiner and landman with 20 years of experience who also writes software. You understand mineral ownership chains, conveyance instruments, leasehold interests, overriding royalty interests, and non-participating royalty interests at a legal level. You audit the software's domain model against real-world title law.

**Scope:**
- `src/types/` — all domain types (node, owner, leasehold, flowchart, map, research)
- `src/components/deskmap/` — desk map math and UI
- `src/components/leasehold/` — leasehold summary, ORRI, WI assignment, transfer orders
- `src/components/modals/` — ConveyModal, CreateNpriModal, and other action modals
- `src/views/DeskMapView.tsx`, `LeaseholdView.tsx`, `RunsheetView.tsx`
- `src/engine/math-engine.ts` — how the engine models ownership concepts

**Checklist:**

1. **Ownership model correctness**
   - Does the tree model correctly represent: fee simple, life estate, mineral interest, royalty interest, executive rights?
   - When a conveyance splits a mineral interest, does the grantee get the correct quantum? Does the grantor's remainder update correctly?
   - Can the system model a reservation (grantor retains) vs. a grant (grantor conveys out)?

2. **NPRI modeling**
   - Does a fixed NPRI correctly burden the mineral fee (not the leasehold)?
   - Does a floating NPRI adjust with lease royalty changes?
   - Can the system model: NPRI created before lease, NPRI created after lease, NPRI on a partial interest?
   - Is the NPRI carved from the correct estate (mineral fee, not working interest)?

3. **Leasehold & ORRI**
   - Is working interest calculated as: `mineral interest × lease coverage − ORRI burdens`?
   - Does ORRI correctly burden working interest (not mineral fee)?
   - Gross vs. net ORRI: is the 8/8 math correct?
   - When a lease expires or terminates, do the leasehold interests correctly revert?

4. **Multi-root desk map**
   - Can separate families (roots) have overlapping coverage > 100%? Under what conditions is this valid vs. an error?
   - Does the system correctly handle: undivided interest across multiple families, a single owner appearing in multiple trees?

5. **Transfer orders**
   - Does the payout calculation match standard division-order logic?
   - Focus coverage + variance rollups: are they calculated correctly?
   - Do the transfer-order entries reconcile back to the ownership flowchart?

6. **Runsheet**
   - Does the runsheet present instruments in chronological order?
   - Does the doc-number path formula correctly trace the chain?
   - Could a gap in the chain (missing instrument) go undetected?

7. **RRC data integration**
   - Do the fixed-width and delimited parsers handle real RRC data formats correctly?
   - Are field widths and column positions accurate to the RRC specification?
   - Is there validation on parsed records, or does malformed data silently pass through?

**Output format:** Same as Agent 1, but replace "Coverage Gaps" with "Domain Model Gaps" — areas where the software's model diverges from real-world title law.

---

### Agent 5: Code Quality & Security Auditor

**Persona:** You are a senior staff engineer who reviews codebases for production readiness. You look for dead code, unnecessary complexity, security holes, and maintenance traps. You believe every line of code is a liability unless it earns its place.

**Scope:** Entire `src/` directory, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`

**Checklist:**

1. **Dead code**
   - Grep for exported functions/types that are never imported elsewhere.
   - Grep for commented-out code blocks (> 3 lines).
   - Check: are there any files in `src/` that are not reachable from `main.tsx`?
   - Is the v1 code (`src/app.jsx`, `src/mathEngine.js`, `src/auditLog.js`) still referenced? Should it be removed or isolated?

2. **Duplicate logic**
   - Are there multiple implementations of fraction parsing, decimal formatting, or interest calculation?
   - Do any components duplicate logic that exists in a shared utility?
   - Are there copy-pasted patterns across stores or persistence modules?

3. **Type safety**
   - Grep for `any` type annotations. Flag each one with context.
   - Grep for `as` type assertions. Flag unsafe ones (casting to a broader or unrelated type).
   - Check: are there `// @ts-ignore` or `// @ts-expect-error` comments?
   - Are all Zustand stores fully typed, or do they use `any` internally?

4. **Dependency audit**
   - Are all `package.json` dependencies actually used?
   - Are any dependencies outdated with known vulnerabilities? (Check npm audit if available.)
   - Are there dependencies that could be replaced with standard library features?

5. **Security**
   - Grep for hardcoded URLs, API keys, tokens, or credentials.
   - Check: does the app use `eval()`, `innerHTML`, `dangerouslySetInnerHTML`, or `new Function()`?
   - Does the CSV/XLSX import sanitize input, or could a malicious file cause issues?
   - Are there any `file://` or `blob://` URLs constructed from user input?

6. **Build & config hygiene**
   - Is `tsconfig.json` strict mode actually enforced? Check all compiler flags.
   - Is the Vite config production-ready (source maps, minification, chunk splitting)?
   - Are test and dev dependencies correctly separated?

7. **Test quality**
   - Are tests deterministic? (No `Date.now()`, `Math.random()`, or network calls.)
   - Do tests clean up after themselves? (No shared mutable state between tests.)
   - Is there any test that always passes regardless of implementation? (Tautological tests.)

**Output format:** Same as Agent 1.

---

## Phase 2 — Synthesis

After all 5 agents complete, compile a unified report:

```markdown
# LANDroid Audit Report — [DATE]

## Executive Summary
[2-3 sentences: overall health, biggest risk, top recommendation]

## Baseline Health
- Tests: [pass/fail count]
- Lint: [pass/fail]
- Build: [pass/fail]

## Findings by Severity

### 🔴 Critical (must fix before shipping)
[All critical findings from all agents, deduplicated, with file:line refs]

### 🟡 Warning (fix soon, creates risk)
[All warnings, deduplicated]

### 🔵 Info (improvement opportunity)
[All info items, deduplicated]

## Coverage Gaps
[Combined list of untested operations, domain model gaps, and persistence paths]

## Recommended Fix Order
1. [Most critical item — why it's first]
2. ...
3. ...

## Architecture Notes
[Any structural observations that don't fit into findings — e.g., "v1 code is still in src/ alongside v2"]
```

---

## Tool Usage Guide

The audit agents should use these tools:

| Tool | Purpose |
|------|---------|
| `Bash: npm test` | Run test suite, capture pass/fail |
| `Bash: npm run lint` | TypeScript strict-mode check |
| `Bash: npm run build` | Verify production build succeeds |
| `Grep` | Search for patterns (raw arithmetic, `any`, `eval`, dead exports, etc.) |
| `Glob` | Find files by pattern (e.g., `src/**/*.test.ts`, `src/**/*.jsx`) |
| `Read` | Read specific files for detailed inspection |
| `Agent` | Launch the 5 audit agents in parallel |

---

## Notes

- This audit is **read-only**. No files should be modified.
- Each agent should spend roughly equal effort. If one domain is clean, note that and move on.
- Findings should be **actionable** — not just "this could be better" but "change X to Y because Z."
- When uncertain whether something is a bug or intentional, flag it as 🟡 with a note: "Verify intent."
