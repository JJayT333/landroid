## System overview
This project provides tools for land/title workflows, ownership calculations, and related data processing.

The system prioritizes:
- correctness of calculations
- transparent auditability
- deterministic behavior
- predictable workflows for non-technical users

Performance and maintainability are prioritized over rapid feature expansion.
The active application surface currently lives at the repository root.

## Jurisdictional scope
LANDroid is **Texas-only for math today**. Texas fee and Texas state leases are the only jurisdictions modeled in calculation logic, leasehold review, and title-math UI today.

**Federal/BLM and private leases are scheduled as Phase 2 math work**, anchored on a real Communitization Agreement (~10 federal leases) the user already holds plus additional BLM lands pre-selected for the next BLM leasing window. `Federal Leasing` may now operate as a first-class reference workspace for federal lease inventory, expirations, targets, source packets, and mapped evidence while sharing the Research project-record backbone. Research may also store federal/private sources, project records, mapped tracts, acquisition notes, and lease inventory as reference-only project data. That scaffolding must stay structurally separate from the Texas Desk Map and Leasehold math until the user explicitly opens the federal/private math phase. Until that phase begins:

- Do not add federal-specific math (federal royalty rates, communitization tract participation, ONRR forms, federal minimum royalty, federal lease status enums) to the codebase.
- Do not let federal/private Federal Leasing or Research records affect Texas ownership, leasehold, transfer-order, payout, NPRI, ORRI, or WI calculations.
- One piece of federal-adjacent prep work — a `LeaseJurisdiction` discriminator on `Lease`/`LeaseholdUnit` defaulting to `'tx_fee'` — is the only acceptable cross-jurisdiction code in the Texas baseline. It exists so Phase 2 has a clean attachment point.
- Federal/private math work begins only when the user explicitly says the source/project workspace is stable enough for that next decision gate.

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

## Texas oil and gas title model
Unless explicitly overridden, domain modeling should assume Texas oil-and-gas rules first.

- `Mineral owner / lessor`
  - The mineral-fee side owns the minerals in place.
  - When that party signs an oil and gas lease, that party is the `lessor`.
  - Mineral ownership does not disappear just because the minerals are leased.

- `Lessee / leasehold side`
  - The company taking the oil and gas lease is the `lessee`.
  - In Texas, an oil and gas lease is treated as conveying a leasehold estate in the minerals to the lessee.
  - For LANDroid modeling, leasehold activity should remain visually and logically distinct from present mineral ownership.

- `Assignments`
  - Default assignment modeling to the `lessee / leasehold` side unless the instrument clearly conveys mineral-fee or royalty ownership instead.
  - In Texas practice, assignments commonly transfer leasehold rights, working interest, overriding royalty, reversionary rights, or operating control under an existing lease.
  - Operational transfer evidence such as Railroad Commission operator-transfer filings may support the story, but should not replace county-record title review.

- `NPRI`
  - Default NPRI modeling to the `mineral-fee / lessor` side.
  - A Texas NPRI is a royalty interest carved from the mineral fee estate, free of exploration and production costs.
  - The NPRI owner does not hold the executive right to lease and generally does not share in delay rentals or shut-in royalties unless the instrument says otherwise.
  - NPRIs are typically created by reservation or conveyance from a mineral owner or other mineral-fee holder, not from the lessee-side leasehold chain.

- `ORRI`
  - Default ORRI modeling to the `lessee / leasehold` side.
  - ORRIs are typically carved out of the working-interest / leasehold chain and are commonly created or transferred through assignments.
  - This is separate from NPRI and should not be merged into the mineral-owner chain.

- `Fixed vs. floating royalty language`
  - Texas deed language matters.
  - Preserve the exact instrument language because a royalty or NPRI may be fixed, floating, or otherwise limited by the deed text.

- `Pooling and ratification`
  - Pooling authority ordinarily comes from the lease granted by the lessor.
  - NPRI holders may need separate ratification analysis depending on the instrument and lease language.

- `Recording`
  - Leases, assignments, royalty deeds, and NPRI conveyances should be treated as recordable real-property instruments in the county where the land lies.
  - Recording status can materially affect later title review.

### Design implications
- Keep `present mineral owner`, `lease`, `assignment`, `NPRI`, and `ORRI` as separate concepts.
- Do not treat a lease or assignment as replacing the present mineral owner in the title chain.
- Treat `assignments` and future `ORRI` tracking as primarily lessee-side overlays.
- Treat `NPRI` tracking as primarily mineral-fee-side ownership burdens or carve-outs.
- For LANDroid UI/modeling, the current mineral-interest owner should remain the `present owner`, but the `lessor` role should be allowed to appear as its own separate lease-related node or overlay instead of being permanently collapsed into the mineral-owner card.
- The current owner-card `lessor terms` treatment should be treated as an interim step, not the final model.
- Future assignment work should be revisited with the leasehold / lessee side as the main attachment point, while keeping the lessor-side role visually distinct from both the present mineral owner node and the lessee node.

### Reference anchors
- Texas Railroad Commission FAQ on mineral versus surface ownership and leasing context: <https://www.rrc.texas.gov/about-us/faqs/oil-gas-faq/oil-gas-exploration-and-surface-ownership/>
- Texas Property Code Section 66.001 on oil-and-gas lease treatment: <https://statutes.capitol.texas.gov/Docs/PR/htm/PR.66.htm#66.001>
- Texas Natural Resources Code Section 91.402 and related royalty-owner/payment provisions: <https://statutes.capitol.texas.gov/GetStatute.aspx?Code=NR&Value=91.402>
- Supreme Court of Texas, `ConocoPhillips Co. v. Hahn` (2025), discussing NPRIs, non-executive rights, and lease/pooling consequences: <https://www.txcourts.gov/media/1459859/230024.pdf>
- Supreme Court of Texas, `Piranha Partners v. Neuhoff` (2021), discussing assignment language for leasehold and overriding royalty interests: <https://www.txcourts.gov/media/1445847/180581.pdf>
- Supreme Court of Texas, `Burlington Resources Oil & Gas Co. v. Texas Crude Energy, LLC` (2021), discussing assignments of overriding royalty interests under leases: <https://www.txcourts.gov/media/1452766/190233c.pdf>

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
