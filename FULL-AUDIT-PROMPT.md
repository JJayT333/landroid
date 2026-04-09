# LANDroid Full Audit Prompt

Use this prompt for the next comprehensive audit pass.

This file is the controlling audit brief. Use the exact user audit prompt below together with:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`

Do not replace this brief with a shortened version. The next tool should use this full audit prompt plus the relevant handoff context.

Important: verify the repository's actual stack and architecture from the codebase before scoring it. Do not assume any stack details in the user brief are correct without checking files like:
- `/Users/abstractmapping/projects/landroid/package.json`
- `/Users/abstractmapping/projects/landroid/vite.config.ts`
- `/Users/abstractmapping/projects/landroid/src/main.tsx`
- `/Users/abstractmapping/projects/landroid/src/App.tsx`

Before making architectural decisions, read:
- `/Users/abstractmapping/projects/landroid/AGENTS.md`
- `/Users/abstractmapping/projects/landroid/PROJECT_CONTEXT.md`
- `/Users/abstractmapping/projects/landroid/CONTINUATION-PROMPT.md`

Start the audit by looking at these current high-signal files:
- `/Users/abstractmapping/projects/landroid/src/engine/math-engine.ts`
- `/Users/abstractmapping/projects/landroid/src/engine/__tests__/math-engine.test.ts`
- `/Users/abstractmapping/projects/landroid/src/components/leasehold/leasehold-summary.ts`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/deskmap-coverage.ts`
- `/Users/abstractmapping/projects/landroid/src/components/deskmap/deskmap-lease-node.ts`
- `/Users/abstractmapping/projects/landroid/src/store/workspace-store.ts`
- `/Users/abstractmapping/projects/landroid/src/store/owner-store.ts`
- `/Users/abstractmapping/projects/landroid/src/views/DeskMapView.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/RunsheetView.tsx`
- `/Users/abstractmapping/projects/landroid/src/views/OwnerDatabaseView.tsx`
- `/Users/abstractmapping/projects/landroid/docs/architecture/ownership-math-reference.md`
- `/Users/abstractmapping/projects/landroid/docs/architecture/audit-remediation-plan.md`

## Current scope (set 2026-04-07)

**LANDroid is Texas-only for now.** Texas fee and Texas state leases are the only jurisdictions in active scope. Federal/BLM and private leases are scheduled as **Phase 2** work, anchored on a real ~10-lease Communitization Agreement plus additional BLM lands pre-selected for the next leasing window. The audit (and any audit-driven implementation work) should:

- Treat the Texas baseline as the **primary** deliverable. All findings, scoring, and roadmap items belong to the Texas baseline unless explicitly tagged Phase 2.
- Treat the federal sections of the brief below as **Phase 2 reference material**. Do not score the codebase against missing federal scaffolding as if it were a defect — call out federal items as "Phase 2 — deferred but planned" instead.
- Keep one piece of federal-adjacent prep work in the Texas baseline: a `LeaseJurisdiction` discriminator on `Lease`/`LeaseholdUnit` defaulting to `'tx_fee'`, so Phase 2 has a clean attachment point.
- Verify the actual stack against the repo (Vite 6 + TypeScript strict + Tailwind v4 plugin + decimal.js + Dexie) before scoring — the brief below predates the current stack.

## Session handoff for next audit tool (2026-04-08)

This section is the load-bearing handoff for the next audit/implementation tool. Read it in full before touching code. The tool may not be able to switch local branches, so this file is also reachable on GitHub at:

`https://github.com/JJayT333/landroid/blob/claude/steadfast-bayou-checkpoint/FULL-AUDIT-PROMPT.md`

### 1. One-line state

Texas baseline is checkpointed at commit `1a177bb` on branch `claude/steadfast-bayou-checkpoint`. Math is sound, tests are green (last known 261/261), `LeaseJurisdiction` discriminator is plumbed end-to-end, and BLM Phase 2 has a research package staged but **zero federal code** in the tree.

### 2. Project context (verified, do not re-derive)

- **Stack:** Vite 6, TypeScript 5.7 `strict: true`, Tailwind v4 via `@tailwindcss/vite` (no CDN — arbitrary classes work natively), decimal.js 10.4 (`precision: 40`, `STORAGE_PRECISION = 24`, `DISPLAY_PRECISION = 9`), Dexie 4 (versioned schema chain v1→v5), React 18.3, Zustand 5, `@xyflow/react` 12, ELK 0.11, Vitest 3.
- **Do NOT recommend:** "introduce decimal.js," "migrate to TypeScript," "move off Tailwind CDN," "add a build step." All done.
- **Math layer convention:** Decimal-only. The single float seam is `formatAsFraction`'s continued-fraction fallback in `src/engine/fraction-display.ts` (only hit for non-rational inputs — no standard landman fraction reaches it).
- **Warning-only convention:** Validators and over-assignment paths warn instead of blocking. Match this for any new finding surfaces.

### 3. Git topology

- `main` — upstream baseline before this audit work.
- `claude/musing-tereshkova` — original audit worktree branch.
- `claude/steadfast-bayou-checkpoint` — **the checkpoint**, all audit-baseline work pushed. This is where the next tool should attach.
- Worktree path on disk: `/Users/abstractmapping/projects/landroid/.claude/worktrees/musing-tereshkova` (the worktree currently has `claude/steadfast-bayou-checkpoint` checked out).

Most recent commits on the checkpoint branch:
- `1a177bb feat: checkpoint Texas baseline before BLM Phase 2`
- `69cafe3 docs: require full audit prompt in handoff`
- `7f8ecbb docs: fix handoff checkpoint hash`
- `170ee33 docs: note handoff branch checkpoint`
- `ad1aa77 feat: checkpoint audit handoff and math hardening`

### 4. Session arc (what the prior tool did)

**Session A — Texas baseline audit remediation (work landed in commits up through `1a177bb`):**

- **ORRI working-interest basis fix (audit finding #2).** `src/components/leasehold/leasehold-summary.ts:247-260`:
  - Renamed `workingInterestBaseRate` → `nriBeforeOrriRate` (semantic correction — the value is NRI-before-ORRI, not WI).
  - Changed the `working_interest`-basis ORRI formula from `(WI − royalty) × share` to `leasedOwnership × share`. This now matches standard landman convention ("1/80 ORRI of WI" = `WI × 1/80`, not `0.875 × 1/80`).
  - Existing test in `src/components/leasehold/__tests__/leasehold-summary.test.ts` updated to assert the new value.
- **`LeaseJurisdiction` discriminator (Phase 2 readiness, kept in Texas baseline so federal can attach cleanly later).** New in `src/types/owner.ts`:
  - `LEASE_JURISDICTION_OPTIONS = ['tx_fee', 'tx_state', 'federal', 'private', 'tribal'] as const`
  - `DEFAULT_LEASE_JURISDICTION = 'tx_fee'`
  - `normalizeLeaseJurisdiction(value: unknown): LeaseJurisdiction` — trims, validates membership, falls back to `tx_fee` for nullish/empty/non-string/junk input
  - `Lease.jurisdiction` field plumbed through `createBlankLease`, `normalizeLease`, with junk-input coercion
  - Same field added to `LeaseholdUnit` in `src/types/leasehold.ts`, plumbed through `createBlankLeaseholdUnit` and `normalizeLeaseholdUnit`
  - **Note:** `tribal` exists in the enum **for completeness only** — the user has explicitly stated NO tribal scope, ever. Do not add tribal lease math, fixtures, or UI affordances.
- **Lease-jurisdiction tests.** `src/types/__tests__/lease-jurisdiction.test.ts` — 17 tests across normalize/coerce/migrate paths for both `Lease` and `LeaseholdUnit`.
- **Test depth additions.** New direct unit tests for previously-untested foundational helpers:
  - `src/engine/__tests__/decimal.test.ts` (NEW)
  - `src/utils/__tests__/interest-string.test.ts` (NEW)
  - `src/utils/__tests__/land.test.ts` (NEW)
- **Combinatorial seed (1119-node fixture) audit & fix.** `src/storage/seed-test-data.ts`:
  - Discovered NPRI over-carve bug: `StressBuilder.addChild` auto-deducts parent fraction for normal allocations, but NPRIs (`allocatesAgainstParent === false`) don't reduce the parent — so a parent could end up with more NPRI than it had room for.
  - Fixed by adding a `hasNpriOfKind()` guard that caps total NPRI per parent at `27/32 = 0.84375`.
  - Confirmed `splitBasis: 'whole'` is the correct semantic for NPRIs (fraction of 8/8), not `'initial'`.
  - Validator now reports the 1119-node seed as clean.
- **Documentation updates.** `PROJECT_CONTEXT.md`, `README.md`, and `docs/architecture/ownership-math-reference.md` updated to reflect the corrected ORRI formula, the jurisdiction discriminator, and the Texas-only-now scoping.
- **Navbar wiring.** `src/components/shared/Navbar.tsx` button handlers connected to their views.
- **Modal hardening.** `src/components/modals/AttachLeaseModal.tsx` and `CreateNpriModal.tsx` and `src/components/owners/OwnerLeasesTab.tsx` and `src/views/LeaseholdView.tsx` had targeted UX edits.

**Session B — BLM Phase 2 research (NOT yet in code, only in `/tmp` agent outputs and the user's PDFs):**

- Read two reference lease PDFs the user provided:
  - **Federal:** `TXNM 115442.pdf` — a real federal lease with the **legacy short serial** format (`TXNM 115442`, pre-LR2000-migration) that LANDroid's data model must accommodate alongside the new MLRS format.
  - **Private:** `2022003277.pdf` — a private lease for the same project area.
- Spawned 4 background research agents (all had WebSearch/WebFetch denied; outputs are training-memory drafts flagged `[VERIFY]`):
  1. **MLRS serial-number agent** — stopped honorably without fabricating. Strongest source for MLRS specifics is the user's own PDF: legacy `TXNM 115442` short form vs. new `TXNM105682666` 9-digit form. **Both formats must be stored as separate fields** (`mlrsSerialNumber` and `legacySerialNumber`).
  2. **IRA 2022 / 2024 BLM final rule agent** — produced unverified comparison from training: royalty 12.5% → 16⅔%, rental schedule $3/$5/$15 per acre tier, $10/ac min bid, $5/ac EOI fee, bonding ~$150k individual / ~$500k statewide, nationwide bonding eliminated. **All of these dollar amounts and rates are flagged UNVERIFIED — do not bake into product constants without primary-source confirmation.**
  3. **Acquired-lands agent** — produced full report from training. Stable USC/CFR citations:
     - MLA 1920: 30 USC § 181 et seq. (public domain)
     - MLAA 1947: 30 USC §§ 351–359 (acquired lands), § 352 = surface-agency consent, § 355 = revenue
     - Weeks Act 1911: 16 USC 515 (USFS NFs — Sam Houston, Davy Crockett, Angelina, Sabine in TX)
     - Bankhead-Jones Farm Tenant Act 1937: 7 USC 1010 (national grasslands)
     - 25% county revenue share under Act of May 23, 1908 (16 USC 500) for Weeks Act NFs
     - 43 CFR Part 3100 general / 3101.7 acquired-lands cross-ref / Part 3109 acquired / Part 3120 competitive (FOOGLRA 1987 — PL 100-203 → product code 312022)
     - 36 CFR Part 228 Subpart E — USFS oil and gas
     - 2006 BLM/USFS MOU on coordination
     - Texas BLM admin: BLM New Mexico State Office (Santa Fe), case jurisdiction "NEW MEXICO OKLAHOMA FIELD OFFICE". **Texas has NO public domain — all federal mineral land in Texas is acquired lands under MLAA 1947.**
  4. **Stipulations agent** — produced taxonomy from training (BLM H-1624-1 2013):
     - **NSO** (No Surface Occupancy) / **CSU** (Controlled Surface Use) / **TL** (Timing Limitation) / **LN** (Lease Notice — informational only per IM 2008-032)
     - FS code structure: `FS<num>(<state>)<category>#<subclause>` — example `FS8(TX)CSU#1J` = USFS-origin, omnibus CSU stipulation #8, Texas, sub-clause J = red-cockaded woodpecker
     - Waiver / exception / modification distinction matters at the data model level
     - Proposed `LeaseStipulation` interface with `setbacks: Setback[]` array and separate `waiverable` / `exceptionable` / `modifiable` booleans

### 5. Texas baseline audit findings still relevant

The full audit is in `.claude/plans/wiggly-frolicking-tower.md` (see plan-mode file). The findings that apply to the Texas baseline going forward:

- **Audit finding #1 — silent lease-overlap clipping.** `src/components/deskmap/deskmap-coverage.ts:66-104` — `allocateLeaseCoverage` silently truncates the later lease. Should return overlap warnings alongside the allocation. **Not yet fixed.**
- **Audit finding #3 — implicit NRI-basis ORRI stacking order.** `src/components/leasehold/leasehold-summary.ts:255-263`. **Documented only; not iterated.**
- **Audit finding #4 — `parseInterestString` and `d()` silently default malformed input to 0.** `src/utils/interest-string.ts`, `src/engine/decimal.ts`. **Not yet wired through a strict variant on lease/ORRI/assignment save paths.**
- **Audit finding #5 — `royaltyKind` (fixed vs floating NPRI) is stored but never consumed.** `src/types/node.ts`. **Acknowledged in docs as deed-text-preserved, not yet either consumed or removed.**
- **Audit finding #6 — `Lease.status` is free text + hard-coded inactive set.** `src/components/deskmap/deskmap-coverage.ts:36-52`. Will become Critical when federal lease statuses land in Phase 2; medium for Texas today.
- **Audit finding #9 — `preWorkingInterestRate` clamps negative residuals to zero with no warning.** `src/components/leasehold/leasehold-summary.ts:455-458`. **Not yet surfaced.**

The other audit findings (#7 lexical date sort, #8 `formatAsFraction` float fallback, #10 sourcemaps off, #11 RootErrorBoundary async gap, #12 cross-store coupling, #15 `dist-node` artifact) are Low/Info and acceptable as-is.

### 6. User decisions and constraints (load-bearing — do not re-litigate)

- **Texas-only is current scope.** Federal/BLM and private leases are Phase 2, scheduled but deferred. Don't score the codebase against missing federal scaffolding as a defect.
- **NO tribal lease coverage. Ever.** `tribal` exists in the discriminator enum for completeness only. Do not add tribal fixtures, math, or UI.
- **Both BLM serial number formats must be stored** when Phase 2 lands: legacy short form (`TXNM 115442`) **and** new MLRS 9-digit form (`TXNM105682666`). The user's existing CA leases are pre-MLRS-migration and will only have the legacy form initially.
- **The user's existing ~10-lease Communitization Agreement** plus additional pre-selected BLM lands for the next leasing window are the real Phase 2 fixtures. Phase 2 work should be validated against the user's actual lease data, not synthetic federal leases.
- **Texas BLM admin reality:** Texas federal minerals are administered by the BLM New Mexico State Office under the "NEW MEXICO OKLAHOMA FIELD OFFICE" case jurisdiction. Texas has NO public domain — all federal mineral land in TX is acquired lands under MLAA 1947. Acquiring authorities to model: Weeks Act 1911 (USFS NFs), Bankhead-Jones 1937 (grasslands), Flood Control Act (USACE), Refuge Acquisition (USFWS).
- **Math layer is decimal-only.** Don't introduce float math. Don't introduce a second decimal library.
- **Warning-only convention** in the math layer: surface findings as warnings, never block.
- **Targeted minimal edits.** No surprise refactors, no docs files unless asked, no speculative abstractions.
- **All IRA 2022 dollar amounts and the 2024 BLM final rule details from the research agents are UNVERIFIED.** Do not bake them into product constants without primary-source confirmation.

### 7. Critical files to read first (for the next auditor)

- `src/engine/math-engine.ts` — core ownership operations, all Decimal
- `src/engine/decimal.ts` — Decimal config (precision: 40, storage: 24, display: 9)
- `src/utils/interest-string.ts` — fraction/decimal parser, every leasehold input flows through here
- `src/components/leasehold/leasehold-summary.ts` — lines 247-260 are the corrected ORRI basis math (`nriBeforeOrriRate`, `working_interest` basis now uses `leasedOwnership × share`)
- `src/components/leasehold/__tests__/leasehold-summary.test.ts` — pinned to corrected ORRI behavior
- `src/components/deskmap/deskmap-coverage.ts` — lines 66-104 are the still-silent overlap-clip path (audit finding #1, not yet fixed)
- `src/types/owner.ts` — `Lease`, `LeaseJurisdiction`, `LEASE_JURISDICTION_OPTIONS`, `DEFAULT_LEASE_JURISDICTION`, `normalizeLeaseJurisdiction`
- `src/types/leasehold.ts` — `LeaseholdUnit.jurisdiction`, `createBlankLeaseholdUnit`, `normalizeLeaseholdUnit`
- `src/types/__tests__/lease-jurisdiction.test.ts` — full coverage of the discriminator round-trips
- `src/types/node.ts` — `royaltyKind` (stored, never read by math — finding #5)
- `src/storage/seed-test-data.ts` — combinatorial seed builder, NPRI over-carve guard via `hasNpriOfKind()`
- `src/storage/workspace-persistence.ts` — validated import path
- `docs/architecture/ownership-math-reference.md` — canonical math reference
- `docs/architecture/audit-remediation-plan.md` — accepted/deferred/rejected fixes from the prior audit pass

### 8. What the next auditor should verify (before recommending anything)

1. **ORRI WI-basis fix is correct.** Re-derive by hand: a unit-scope `working_interest`-basis ORRI of `1/80` against a tract with `leasedOwnership = 1.0` and `royaltyRate = 1/8` should now produce `1.0 × 1/80 = 0.0125` (NOT the old `0.875 × 1/80 = 0.0109375`). Confirm `src/components/leasehold/__tests__/leasehold-summary.test.ts` asserts `0.0125`.
2. **Test pass rate.** Run `npm test`. Last known clean run was 261/261. If any test fails, that's the first thing to fix.
3. **Build clean.** Run `npm run build`. `tsc -b` runs ahead of `vite build` and must pass.
4. **Lint clean.** `npm run lint`.
5. **Combinatorial seed validator.** The 1119-node combinatorial fixture in `src/storage/seed-test-data.ts` should validate clean — no over-allocation, no under-allocation, no NPRI over-carve. The `hasNpriOfKind()` guard caps NPRI per parent at `27/32`.
6. **Jurisdiction discriminator round-trips.** `normalizeLease` and `normalizeLeaseholdUnit` should preserve every `LEASE_JURISDICTION_OPTIONS` value, coerce junk to `tx_fee`, and migrate legacy records (no `jurisdiction` field) to `tx_fee`.
7. **No federal code in the tree yet.** A repo-wide search for `federal`, `BLM`, `MLRS`, `ONRR`, `communitization`, `CA TPF`, etc. should hit only docs and one test comment. Phase 2 has not started.

### 9. What the next auditor should NOT do

- **Do not** recommend "add decimal.js," "migrate to TypeScript," "introduce a build step for Tailwind." All done.
- **Do not** recommend a wholesale math-engine rewrite. The engine is sound; the audit found one semantic ORRI fix and that has landed.
- **Do not** fabricate IRA 2022 royalty/rental/bonding numbers. The research agents could not verify them — primary sources required.
- **Do not** add tribal lease scaffolding. Hard out.
- **Do not** assume federal code exists. It does not. Anything federal-specific is a Phase 2 design question, not a bug fix.
- **Do not** treat the `tribal` enum value as live scope. It exists for completeness; the user has ruled it out permanently.
- **Do not** introduce a second decimal library or any float-based math seam.
- **Do not** delete `royaltyKind` without the user's explicit go-ahead — it's preserved as deed text and may be consumed by Phase 2 floating-NPRI math.

### 10. Recommended next steps (in order)

1. **Run the verification list in §8.** Confirm the Texas baseline is actually green before moving on.
2. **Land audit finding #1 (lease-overlap warnings).** Smallest, most user-visible Texas correctness improvement remaining. Warning-only.
3. **Land audit finding #9 (negative `preWorkingInterestRate` warning).** Same surfacing pattern, near-trivial.
4. **Land audit finding #4 (strict-parse leasehold inputs).** Add `parseStrictInterestString` returning `Decimal | null`; wire through lease/ORRI/assignment save paths.
5. **Document NRI-basis ORRI stacking order (finding #3).** Either document the current behavior in `docs/architecture/ownership-math-reference.md` and the leasehold deck UI, or implement effective-date-ordered iterative carve. User preference: document.
6. **Then — and only then — begin Phase 2 BLM scaffolding.** Start with `src/types/federal-lease.ts` containing the discriminated `FederalLeaseData` interface (subtype, status, MLRS + legacy serial, surface managing agency, acquiring authority, stipulations array, consent documents array). Use the user's existing ~10-lease CA as the first real fixture. Do **not** introduce IRA 2022 dollar constants until verified against primary sources.



Please perform a comprehensive audit of the LANDroid project. This is a mineral title and oil & gas tool. **Texas-only is the active scope as of 2026-04-07**; federal BLM and private leases are scheduled as Phase 2. All current implementation work covers Texas state/fee leases. The federal sections below describe the future Phase 2 scope and remain useful for forward planning, but should not be treated as currently-required functionality.

## PHASE 1 — MATH AUDIT (Most Critical)

Review every calculation in the codebase related to oil and gas leasing and division orders. For each formula found, verify correctness against industry-standard landman math:

### Fee/State Lease Math (Texas)
- **ORRI (Overriding Royalty Interest)** — verify it is carved from the working interest, not the royalty, and that the net revenue interest (NRI) math reflects this: NRI = 1 - Royalty - ORRI
- **NPRI (Non-Participating Royalty Interest)** — verify it burdens ALL working interests proportionally, and confirm the distinction between floating vs. fixed NPRI treatment. In Texas, an NPRI created before the lease may be a "fixed" NPRI that does not float with the lease royalty — flag any assumption either way.
- **Royalty Interest** — check lease royalty fraction handling (1/8, 3/16, 1/4, 1/5, etc.) and decimal conversions. Note that Texas courts have enforced the "at the well" vs. "market value" royalty distinction — flag if the tool models royalty deductions.
- **Working Interest (WI)** — verify WI correctly reflects cost-bearing obligations
- **NRI calculations** — confirm NRI = WI × (1 - total burdens above WI) for each interest type
- **Division Order math** — verify all decimal interests sum to 1.0 (or flag if not), check for rounding errors
- **Tract participation** — verify acreage-weighted participation factors if present
- **Proportionate reduction clauses** — check if royalty is correctly reduced when lessor does not own 100% of the minerals
- **Depth severance / horizon splitting** — if present, verify interests are correctly split by formation
- **Pugh clause effects** — if modeled, verify acreage release math for both horizontal and vertical Pugh clauses
- **Undivided interest calculations** — verify fractional mineral ownership applied correctly
- **Horizontal well unit participation** — Texas RRC rules on allocation wells and the difference between a pooled unit and an allocation well agreement

### Federal/BLM Lease Math
- **Federal royalty rate** — verify the standard federal onshore royalty is 16.67% (1/6) for leases issued before August 16, 2022, and 16.67%–18.75% for leases issued after the Inflation Reduction Act changes. Flag any hardcoded 12.5% (the old pre-2022 rate that was changed by the IRA).
- **Federal NRI** — confirm NRI for a federal lease WI owner = WI × (1 - 0.1667) for standard leases, and that ORRIs and NPRIs further reduce NRI correctly on top of the federal royalty
- **Federal ORRI** — same carve-out rules apply as fee leases, but flag if the tool does not account for the fact that federal leases cannot be freely burdened beyond certain thresholds without BLM approval implications
- **Rental calculations** — federal leases require annual rentals ($1.50/acre for competitive, $1.50/acre for noncompetitive historically — verify if the tool stores/calculates rentals and whether rates reflect current BLM fee schedules)
- **Bonus bid calculations** — if the tool tracks competitive lease sales, verify bonus $/acre calculations and total bonus math
- **Federal unit participation factors** — for communitization agreements (CAs) and federal units, verify the tract participation factor (TPF) formula: TPF = tract acreage / total unit acreage, and that each tract's royalty and WI are then multiplied by that TPF
- **Communitization Agreement (CA) math** — verify that production allocated to a federal tract through a CA correctly triggers federal royalty obligations on only the federal tract's proportionate share
- **Minimum royalty** — federal leases require a minimum royalty payment equal to the annual rental when a lease is held by production but the royalty due is less than the rental. Flag if this is not modeled.
- **Suspense/escrow calculations** — if present, verify that suspended royalties for federal leases follow ONRR (Office of Natural Resources Revenue) rules

## PHASE 2 — MISSING CALCULATIONS

After reviewing what exists, identify which of these standard landman calculations are missing and should be added:

### Fee/Texas Missing
- Carried interest / back-in after payout (BIAPO)
- Production payment interests
- Net profits interest (NPI)
- Texas Abstract/Survey legal description parsing or validation
- Lease bonus calculations ($/acre × net mineral acres)
- Delay rental calculations
- Shut-in royalty calculations
- Texas RRC voluntary pooling vs. allocation well distinction
- Texas Non-Op working interest and JOA cost calculations
- Mineral acreage vs. surface acreage distinction

### Federal/BLM Missing
- **BLM lease serial number tracking** — federal leases are identified by serial number (e.g., NM-12345, WYO-67890). Flag if there is no data field for this.
- **Lease expiration and primary term tracking** — federal leases have a 10-year primary term (changed from 5 years in 2022 for some lease types). The tool should track: lease issue date, primary term end date, HBP status, and next rental due date.
- **Lease status tracking** — federal leases have distinct statuses: Offered, Issued, Suspended, Terminated, Cancelled, Reinstated. Flag if these states are not modeled.
- **Federal spacing / drilling unit rules** — BLM has specific rules on well spacing for federal minerals; flag if any spacing calculation exists and whether it references BLM regulations vs. state RRC rules
- **Communitization Agreement (CA) tracking** — CAs are the federal equivalent of pooling. The tool should be able to associate a federal lease with a CA, track the CA's effective date, and calculate the federal tract's proportionate share.
- **Federal APD (Application to Permit to Drill) status** — if the tool tracks drilling activity, APD status is a key federal-specific field
- **ONRR royalty reporting** — flag if the tool has any reporting or export capability aligned with ONRR Form 2014 (Report of Sales and Royalty Remittance)
- **Surface Management Agency overlap** — in Texas federal lands (e.g., national forests, federal mineral reservations), there may be both BLM minerals and a separate surface management agency. Flag if the tool distinguishes surface ownership from mineral ownership for federal tracts.
- **Split estate tracking** — in many Texas counties, the federal government owns the minerals but a private party owns the surface (or vice versa). The tool should be able to flag and track split estate situations.
- **Federal lease assignment and transfer tracking** — BLM requires approval of all assignments. Track assignor, assignee, approval date, and whether it is a full or partial assignment.

## PHASE 3 — CODE QUALITY & ARCHITECTURE AUDIT

Review the full codebase and report on:

1. **Correctness bugs** — any logic errors, off-by-one errors, null/undefined handling failures
2. **Floating point precision** — are money/interest calculations using native JS floats? Flag any place where `0.1 + 0.2 !== 0.3` class errors could corrupt division order decimals. Recommend `decimal.js` or `big.js` for all financial math.
3. **State management** — is React state structured well? Any prop drilling that should be context or a store?
4. **IndexedDB usage** — review for stale-read bugs, missing versioning, unhandled upgrade paths
5. **esbuild config** — check for missing source maps, tree-shaking opportunities, bundle size issues
6. **Tailwind CDN usage** — flag any classes that won't work without the compiler (arbitrary values like `w-[123px]`) and suggest either moving to a build step or staying within CDN-safe classes
7. **Error handling** — are division-by-zero cases handled? (Critical for interest calculations)
8. **Test coverage** — what math functions have no tests? List them.
9. **Type safety** — is there any JSDoc typing or PropTypes? Would TypeScript or Zod for input validation help?
10. **Lease data model** — does the data model clearly distinguish between federal leases and fee/state leases? These have fundamentally different fields, statuses, and workflows. A single generic "lease" schema will cause problems at scale.

## PHASE 4 — UPGRADE RECOMMENDATIONS

Based on the audit, produce a prioritized upgrade roadmap:

**High Priority (correctness/reliability)**
- Specific library recommendations with install commands
- Any data model changes needed to properly separate federal vs. fee lease logic
- Floating point fix for all financial/interest math

**Medium Priority (developer experience)**
- Tooling upgrades (TypeScript migration path, test framework if missing, etc.)
- Build pipeline improvements
- BLM/ONRR API integration opportunities (BLM's LR2000 system has public data on federal lease status, serial numbers, and acreage — flag if an integration would be valuable)

**Low Priority (nice to have)**
- UI/UX improvements specific to landman workflow
- New features ranked by landman utility
- PLSS (Public Land Survey System) coordinate parsing for federal land descriptions (federal lands use township/range/section, unlike Texas fee lands)

## OUTPUT FORMAT

Structure your response as:

1. **Math Audit Results** — table of each formula found: [Function/File | Formula Used | Correct? | Notes]
2. **Bugs Found** — numbered list with file:line, issue, fix
3. **Missing Calculations** — checklist split by Fee/Texas and Federal/BLM
4. **Code Quality Issues** — grouped by severity (Critical / Warning / Info)
5. **Upgrade Roadmap** — prioritized list with effort estimates
6. **Summary Score** — overall assessment of math correctness and code health

Be thorough and assume I want production-quality landman math. Flag the following explicitly wherever relevant:
- Texas RRC regulations vs. BLM/ONRR federal regulations — these are entirely separate regulatory regimes and must never be conflated
- Texas Abstract & Survey legal descriptions vs. PLSS township/range/section for federal lands
- Texas floating vs. fixed NPRI treatment
- Allocation well agreements (Texas, no forced pooling) vs. Communitization Agreements (federal)
- Federal royalty rate changes under the Inflation Reduction Act (post August 16, 2022)
- BLM LR2000 as a potential data source for federal lease status verification
- ONRR as the federal royalty collection and reporting authority (separate from BLM)
