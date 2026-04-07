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

User audit brief:

Please perform a comprehensive audit of the LANDroid project. This is a mineral title and oil & gas tool built with React (esbuild, no Babel), Tailwind CDN, and plain JS modules. The project covers both Texas state/fee leases AND federal BLM leases, so all audit phases must evaluate both.

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
