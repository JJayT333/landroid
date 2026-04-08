# Ownership Math Reference

This note is the canonical reference for LANDroid's ownership, leasehold, and
decimal-interest math.

It is written for humans first and future AI tooling second.

The main rule for using this note is:

- treat arithmetic as exact
- treat legal meaning as instrument-specific unless a source clearly says otherwise

In other words, the decimal math can be deterministic, but the legal question
"what interest does this instrument create?" still depends on jurisdiction,
exact wording, pooling authority, and whether the burden is mineral-side or
leasehold-side.

## Confidence Model

Each statement below should be read in one of three buckets:

- `Source-grounded`
  - Supported by a statute, regulator, court opinion, or university-extension
    source linked below.
- `Repo model`
  - The current LANDroid implementation today.
- `Known gap`
  - A place where the repo is incomplete, simplified, or currently wrong.

## External Source Anchors

Texas-first legal model:

- Texas Railroad Commission, `Oil & Gas Exploration and Surface Ownership`
  - <https://www.rrc.texas.gov/about-us/faqs/oil-gas-faq/oil-gas-exploration-and-surface-ownership/>
- Texas Property Code Section 66.001
  - <https://statutes.capitol.texas.gov/Docs/PR/pdf/PR.66.pdf>
- Texas Natural Resources Code Sections 91.401 and 91.402
  - <https://statutes.capitol.texas.gov/Docs/NR/pdf/NR.91.pdf>
- Supreme Court of Texas, `ConocoPhillips Co. v. Hahn` (2025)
  - <https://www.txcourts.gov/media/1459859/230024.pdf>
- Supreme Court of Texas, `Piranha Partners v. Neuhoff` (2020)
  - <https://www.txcourts.gov/media/1445847/180581.pdf>
- Supreme Court of Texas, `Burlington Resources Oil & Gas Co. v. Texas Crude Energy, LLC` (2021)
  - <https://www.txcourts.gov/media/1452766/190233c.pdf>

General mineral / royalty / decimal math:

- U.S. Energy Information Administration glossary
  - <https://www.eia.gov/tools/glossary/>
- Montana State University Extension, `Oil and Gas Leasing`
  - <https://extension-store.montana.edu/montguides/oil-and-gas-leasing>
- Montana State University Extension, `Owning Leased Oil and Gas Minerals`
  - <https://extension-store.montana.edu/montguides/owning-leased-oil-and-gas-minerals>
- Oklahoma State University / Texas AgriLife / National Agricultural Law Center,
  `Petroleum Production on Agricultural Lands in Oklahoma`
  - <https://extension.okstate.edu/programs/natural-resources/site-files/docs/petroleum-production-on-agricultural-lands-in-oklahoma.pdf>
- Texas AgriLife reference to the Texas companion handbook
  - <https://agrilifecdn.tamu.edu/texasaglaw/files/2018/12/Petroleum-Production-on-Agricultural-Lands-in-Texas.pdf>

## Core Domain Model

### Mineral estate, surface estate, lessor, lessee

- `Source-grounded`
  - In Texas, the surface estate and mineral estate can be severed.
  - The mineral estate is dominant, and the mineral owner can lease it.
  - The party granting the lease is the `lessor`.
  - The party taking the lease is the `lessee`.
- `Source-grounded`
  - Texas Property Code Section 66.001 treats an oil and gas lease as an
    instrument conveying a fee-simple-determinable interest in the mineral
    estate.
- `Source-grounded`
  - EIA describes a mineral lease as one where the lessor retains a royalty
    interest and the lessee acquires the working interest.
- `Repo model`
  - LANDroid should keep present mineral ownership distinct from leasehold
    overlays.

### Royalty, NPRI, ORRI, and working interest

- `Source-grounded`
  - A `royalty` is a non-operating share of production or proceeds that is
    normally free of exploration, development, and operating costs.
- `Source-grounded`
  - A `working interest` carries the right to explore, develop, and operate,
    and bears the related costs.
- `Source-grounded`
  - An `ORRI` is an overriding royalty carved out of the working interest and
    is generally limited to the life of the lease that created it.
- `Source-grounded`
  - In Texas practice, an `NPRI` is mineral-fee-side royalty, not a leasehold
    operating interest.
- `Repo model`
  - LANDroid treats `mineral` and `npri` as separate interest classes and does
    not let ordinary conveyances allocate across those classes.

### Fixed vs. floating royalty

- `Source-grounded`
  - Texas deed language matters.
  - `ConocoPhillips v. Hahn` reiterates that a fixed NPRI conveys a fixed share
    of production rather than a floating fraction of later lease royalty, so
    the lease royalty does not automatically resize the fixed NPRI.
- `Repo model`
  - LANDroid stores `royaltyKind` on each NPRI node to preserve the deed-level
    characterization and propagates it through conveyances and predecessor
    inserts. **The field is stored only.** No math layer — neither the
    ownership engine nor the leasehold decimal summary — reads `royaltyKind`
    today. NPRIs are excluded from `currentMineralOwners` in
    `src/components/leasehold/leasehold-summary.ts` and therefore carry no
    decimal through to transfer-order review.
- `Known gap` (audit finding #5)
  - `royaltyKind` is deed-text preservation only. The next slice of math that
    brings NPRIs into the leasehold decimal **must implement both the fixed
    branch and the floating branch at the same time** — a floating NPRI scales
    against the lease royalty rate, a fixed NPRI does not, and consuming the
    field for only one branch is a silent mis-payment waiting to happen.
  - Do not consume `royaltyKind` until both branches are wired end-to-end,
    surfaced in the leasehold deck, and covered by tests that pin the
    distinction. Until then, treat the value as deed-text metadata.
  - The repo also does not yet use instrument-language parsing to derive legal
    effect automatically. Human review is still required.

### Division orders and transfer orders

- `Source-grounded`
  - Texas Natural Resources Code Section 91.401 defines a division order as a
    payee-signed agreement directing how proceeds are paid.
- `Source-grounded`
  - Texas Natural Resources Code Section 91.402 says a statutory division order
    does not amend the lease or operating agreement, and contradictory lease
    provisions still control.
- `Repo model`
  - LANDroid's current transfer-order layer is a review surface for derived
    decimal rows, not a legal substitute for title review or a signed division
    order package.

## Arithmetic Primitives

### Normalized fractions

- `Repo model`
  - LANDroid stores ownership fractions as normalized decimals between `0` and
    `1`, using `Decimal.js`.
- `Repo model`
  - Fractions are serialized as strings so core ownership math does not rely on
    JavaScript floating-point arithmetic.

### Net mineral acres

- `Source-grounded`
  - The standard acreage formula is:

```text
net mineral acres = tract acres owned x ownership fraction
```

- `Source-grounded`
  - A decimal-interest calculation commonly uses the owner's net mineral or net
    unit acreage divided by total unit/spacing acreage, then multiplied by the
    royalty rate.

### Royalty decimal

- `Source-grounded`
  - A standard royalty decimal formula is:

```text
royalty decimal = (net mineral acres / unit or spacing acres) x royalty rate
```

- `Source-grounded`
  - The Montana State example:

```text
160 acres / 640-acre unit = 0.25
0.25 x 1/6 royalty = 0.041675
```

- `Source-grounded`
  - The Oklahoma / Texas agricultural-land handbook gives the same structure:
    acreage share times royalty rate produces the royalty decimal.

### Pooling and unit allocation

- `Source-grounded`
  - Pooling is not just arithmetic. It depends on lease or ratification
    authority.
- `Source-grounded`
  - When the governing instrument uses acreage-based allocation, the owner's
    share of pooled production is allocated on an acreage basis across the unit.
- `Source-grounded`
  - `ConocoPhillips v. Hahn` discusses pooled-unit royalty allocation on an
    pro-rata acreage basis under the lease at issue.
- `Repo model`
  - LANDroid's current leasehold unit math assumes acreage-based participation
    using configured pooled acres.

## LANDroid Ownership Graph Model

### Node fields

Primary ownership math lives in:

- `src/engine/math-engine.ts`
- `src/types/node.ts`
- `src/engine/decimal.ts`

Two fraction fields matter:

- `initialFraction`
  - `Repo model`
  - The amount originally granted into this node or branch.
- `fraction`
  - `Repo model`
  - The amount still held by this node after same-class child conveyances have
    been taken out.

### Branch invariant

- `Repo model`
  - For any non-`related` node, same-class allocation should satisfy:

```text
initialFraction ~= fraction + sum(direct child initialFraction values)
```

- `Repo model`
  - The current epsilon target is `0.000000001`.
- `Known gap`
  - The validator currently catches only over-allocation, not under-allocation.
  - That means a branch can lose value and still pass validation today.

### Interest-class boundaries

- `Repo model`
  - Mineral and NPRI branches are intentionally separate.
- `Repo model`
  - Child fractions only allocate against a parent when the parent and child
    share the same `interestClass`.
- `Reason`
  - This prevents a mineral conveyance from silently being treated as a
    royalty-side burden and vice versa.

### Operations

- `executeConveyance`
  - subtracts the granted share from the parent remaining fraction
  - creates a new child with `initialFraction = fraction = granted share`
- `executeRebalance`
  - rescales a branch when the root branch amount changes
- `executePredecessorInsert`
  - inserts a new node between parent and child
- `executeAttachConveyance`
  - moves a branch to a new parent and rescales the attached subtree
- `executeDeleteBranch`
  - removes a branch and restores the deleted branch's `initialFraction` to the
    source parent

### Important invariant implication

- `Repo model`
  - Delete is designed to restore the original grant to the source parent.
- `Known gap`
  - Attach should symmetrically refund the old parent before debiting the new
    parent, but it currently does not.

## LANDroid Desk Map Math

Primary file:

- `src/components/deskmap/deskmap-coverage.ts`

Current desk-map coverage tracks:

- total current mineral ownership found in the chain
- total linked ownership
- total leased ownership
- missing, unlinked, and unleased residuals

Important behavior:

- `Repo model`
  - NPRI nodes are excluded from mineral coverage totals.
- `Repo model`
  - Lease coverage is capped to the owner's remaining mineral fraction.
- `Known gap`
  - The desk-map coverage layer selects one `primary` active lease per owner.
  - Multiple concurrent active leases for the same owner are not aggregated.

## LANDroid Leasehold Math

Primary files:

- `src/components/leasehold/leasehold-summary.ts`
- `src/components/deskmap/deskmap-coverage.ts`
- `src/types/leasehold.ts`

### Current tract and owner calculations

For each tract:

```text
ownerFraction = node.fraction
leaseFraction = min(ownerFraction, parsed lease.leasedInterest or ownerFraction)
tractParticipation = tract.pooledAcres / totalPooledAcres
```

For each owner in a tract:

```text
ownerNetMineralAcres = tract.grossAcres x ownerFraction
ownerNetPooledAcres = tract.pooledAcres x ownerFraction
lease slices = active leases allocated in effective-date order, capped at ownerFraction
leaseSlicePooledAcres = tract.pooledAcres x allocated lease fraction
ownerTractRoyalty = sum(allocated lease fraction x parsed lease royalty)
ownerUnitRoyaltyDecimal = sum((leaseSlicePooledAcres / totalPooledAcres) x parsed lease royalty)
```

For each tract rollup:

```text
leasedOwnership = sum(owner leaseFraction)
weightedRoyaltyRate = sum(owner tract royalty)
workingInterestBaseRate = leasedOwnership - weightedRoyaltyRate
grossOrriBurdenRate = leasedOwnership x gross_8_8 ORRI burden fractions
workingInterestOrriBurdenRate = workingInterestBaseRate x working_interest ORRI burden fractions
netRevenueInterestBaseRate = workingInterestBaseRate - grossOrriBurdenRate - workingInterestOrriBurdenRate
netRevenueInterestOrriBurdenRate = netRevenueInterestBaseRate x net_revenue_interest ORRI burden fractions
totalOrriBurdenRate = grossOrriBurdenRate + workingInterestOrriBurdenRate + netRevenueInterestOrriBurdenRate
unitOrriDecimal = tractParticipation x totalOrriBurdenRate
preWorkingInterestRate = workingInterestBaseRate - totalOrriBurdenRate
preWorkingInterestDecimal = max(preWorkingInterestRate, 0) x tractParticipation
assignmentShare = sum(relevant assignment fractions)
assignedWorkingInterestDecimal = preWorkingInterestDecimal x assignmentShare
retainedWorkingInterestDecimal = max(preWorkingInterestDecimal - assignedWorkingInterestDecimal, 0)
```

### Interpretation notes

- `Repo model`
  - The current leasehold formulas are unit-pooled-acre formulas.
- `Repo model`
  - LANDroid now shows both gross-acre `netMineralAcres` and pooled-acre
    `netPooledAcres` so the acreage basis is explicit.
- `Repo model`
  - ORRI math now supports `gross_8_8`, `working_interest`, and
    `net_revenue_interest` burden bases.
- `Repo model`
  - Multiple active leases per owner are now aggregated in effective-date order
    and capped at the owner's current fraction.
- `Known gap`
  - Assignment math currently assumes all included assignment fractions share
    the same pre-WI base and can be summed directly.
  - That is a simplification, not a universal chain-of-title truth.

## Common Error Sources

These are the recurring ways arithmetic or title logic can go wrong:

- `Wrong base acreage`
  - Using gross acres when the payout should use pooled/unit acres, or vice
    versa.
- `Wrong royalty type`
  - Treating a fixed NPRI like a floating lease royalty.
- `Wrong side of title`
  - Treating an NPRI like an ORRI or treating a lease assignment like a mineral
    conveyance.
- `Pooling assumption without authority`
  - Assuming acreage-based pooled allocation without confirming lease or
    ratification support.
- `Division order overreach`
  - Treating a division order like it rewrites the lease.
- `Hidden graph corruption`
  - Losing or duplicating fractional value inside ownership-tree operations.
- `Import normalization without validation`
  - Accepting malformed payloads and trusting them as valid ownership graphs.

## Repo Invariants That Must Hold

These invariants are mandatory for correctness:

- no negative fractions
- no non-finite numeric values
- no cycles
- valid parent references
- same-class branch totals preserved within epsilon
- root mineral totals explainable for the tract state being modeled

Validation touchpoints:

- `src/engine/math-engine.ts`
- `src/engine/__tests__/math-engine.test.ts`
- `src/storage/__tests__/workspace-persistence.test.ts`
- `src/components/deskmap/__tests__/deskmap-coverage.test.ts`
- `src/components/leasehold/__tests__/leasehold-summary.test.ts`

## Rules For A Future LANDroid AI Agent

If this repo eventually grows an internal title/decimal assistant, it should use
these rules:

1. Separate arithmetic from legal interpretation.
2. Ask for jurisdiction if not already known.
3. Ask for the exact deed, lease, assignment, or ratification language before
   classifying NPRI, ORRI, fixed royalty, floating royalty, or pooling effect.
4. Ask for the acreage basis:
   - gross tract acres
   - net mineral acres
   - pooled/unit acres
   - spacing acres
5. Ask which burdens apply before calculating NRI or retained WI.
6. State whether a decimal is:
   - source-grounded arithmetic
   - repo implementation output
   - legal interpretation requiring attorney/title review
7. Never claim certainty when the instrument language is missing.

## Current Gaps To Keep In Mind

- import-path UX still needs a product decision on reject vs quarantine vs
  repair when malformed ownership or leasehold payloads are encountered
- CSV import still rounds through `Number(...).toFixed(9)`

## Bottom Line

LANDroid can make the arithmetic deterministic, auditable, and testable.
What it cannot honestly do is infer legal meaning without the governing text.

For future development, the safest pattern is:

- derive the decimal math exactly
- preserve the underlying instrument language
- state the assumptions used
- refuse to collapse mineral, NPRI, leasehold, assignment, and ORRI concepts
  into one undifferentiated "ownership" number
