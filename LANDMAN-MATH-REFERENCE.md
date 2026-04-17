# LANDMAN Math Reference

This document is a reviewer-facing math reference for the current Texas baseline in LANDroid. It is written so a landman can compare company calculation conventions to the code without reading the code first. It supersedes the older internal reference now archived at `docs/archive/ownership-math-reference.md`.

## 1. Scope and intent

LANDroid currently calculates Texas mineral-title ownership and Texas leasehold decimal review for Texas fee and Texas state leases only. It calculates chain-of-title fractions, lease coverage, acreage-weighted royalty, ORRI burdens, basic working-interest assignment splits, and transfer-order review totals. Desk Map lease cards now scope a linked lease to the branch where that lease card sits; owner lease records without a Desk Map lease card remain owner-level. Research may track federal/private sources, lease inventory, mapped tracts, and acquisition notes as reference-only project records, but those records do not participate in math. LANDroid does not yet calculate any federal or BLM lease math, any tribal lease math, or the many lease-administration items that sit outside the present Texas baseline. The current regulatory regime modeled in code is Texas fee plus Texas state only; federal math is deferred to Phase 2, and tribal is permanently out of scope.

## 2. Data model in landman terms

- Owner. This is the person or entity record the landman knows in the owner database. It can represent a mineral owner, an NPRI owner, or even a surface-only contact if the user wants the record for research purposes. The fields a landman will care about are the owner name, entity type, county, prospect, mailing address, email, phone, notes, and timestamps. Source: `src/types/owner.ts:1-14`.

- Lease. This is the lease record tied to an owner record. The landman-facing fields are lease name, lessee, royalty rate, leased interest, effective date, expiration date, status, document number, notes, and jurisdiction. The current baseline defaults jurisdiction to `tx_fee`, uses a canonical Texas-baseline status list for new edits, preserves non-canonical legacy status text when it already exists, and normalizes bad or missing values back to safe defaults. Source: `src/types/owner.ts:68-132,186-244`.

- Ownership node. This is the chain-of-title card in the title tree. It is the record that carries grantor, grantee, instrument type, book/page or document number, dates, land description, remarks, current fraction, original granted fraction, parent link, interest class, and the stored NPRI deed-reading fields: `royaltyKind` (`fixed` or `floating`) and, for fixed NPRIs, `fixedRoyaltyBasis` (`burdened_branch` or `whole_tract`). In landman terms, this is the actual title step, not just a contact record. Source: `src/types/node.ts:30-81`.

- Tract. LANDroid stores tract records as `DeskMap` records. The fields a landman will care about are tract name, tract code, tract ID, gross acres, pooled acres, description, and the list of node IDs assigned to that tract. Source: `src/types/node.ts:78-87`.

- Leasehold unit. This is the unit-level header for the leasehold review screen. The fields are unit name, description, operator, effective date, and jurisdiction. Source: `src/types/leasehold.ts:7-19,99-130`.

- ORRI. This is the overriding royalty record on the leasehold side. The important fields are payee, scope (`unit` or `tract`), tract reference, burden fraction, burden basis, effective date, source document number, and notes. Source: `src/types/leasehold.ts:37-55`.

- Working-interest assignment. This is the assignment record for splitting pre-WI decimal after burdens. The important fields are assignor, assignee, scope (`unit` or `tract`), tract reference, assigned WI fraction, effective date, source document number, and notes. Source: `src/types/leasehold.ts:57-67`.

- Transfer-order entry. This is the review row for downstream decimal review. The stored fields are the source row ID, owner number, status, and notes. Source: `src/types/leasehold.ts:69-75`.

- Jurisdiction discriminator. LANDroid carries a lease and leasehold-unit jurisdiction field so later federal or private regimes can attach without a storage migration. The allowed values are exactly `tx_fee`, `tx_state`, `federal`, `private`, and `tribal`, with `tx_fee` as the default. `tribal` exists in the enum for completeness and data-shape stability only; tribal lease math is not planned and is permanently out of scope under the current user instructions. Source: `src/types/owner.ts:42-66`, `src/types/leasehold.ts:7-19,99-130`, `src/types/__tests__/lease-jurisdiction.test.ts:16-173`.

## 3. Decimal precision policy

All LANDroid math is done with `decimal.js`, not with JavaScript floating-point numbers. Internal calculation precision is set to 40 significant digits. Stored values are serialized with up to 24 significant digits when more than display precision is needed, and displayed values are shown to 9 decimal places. In plain terms, the engine is trying to keep long conveyance chains and tiny retained interests from drifting as the math is repeated. A simple example is that `0.1 + 0.2` stays exactly `0.3` in this layer instead of picking up float error. Source: `src/engine/decimal.ts:10-18,21-29,47-57`.

## 4. Ownership tree math (chain of title)

### 4.1 Conveyance (executeConveyance)

- Landman description: this is "conveying X out of the current owner's remaining interest to a new grantee." It reduces the parent's remaining same-class interest and creates a child branch for the conveyed share.
- Formula: child current fraction = conveyed share; child initial fraction = conveyed share; parent remaining fraction = parent remaining fraction - conveyed share.
- Worked example: if a parent mineral owner still holds `1/4` and conveys `1/8` to a child, the child is created at `1/8` and the parent's remaining fraction falls from `1/4` to `1/8`.
- Edge guards: the share must be finite, greater than zero, and no larger than the parent's remaining same-class fraction; the new node ID must be unique; the parent must exist; related-document nodes cannot originate a conveyance; and a mineral branch cannot convey directly into an NPRI branch or vice versa.
- Source: `src/engine/math-engine.ts:193-216,245-315`.

### 4.2 NPRI creation (executeCreateNpri)

- Landman description: this is "carving an NPRI burden out of a mineral branch without shrinking the mineral branch itself." LANDroid treats NPRIs as separate sibling burdens, not as a deduction from the mineral parent's allocation.
- Formula: mineral parent remaining fraction stays unchanged; new NPRI child current fraction = NPRI share; new NPRI child initial fraction = NPRI share.
- Worked example: if a mineral owner still holds `1/4` mineral and grants a fixed NPRI of `1/16`, the mineral owner still shows `1/4` mineral in the chain, and a new NPRI child is created at `1/16`. The mineral chain does not fall to `3/16`.
- Edge guards: the parent must exist, must be a title-interest node, and must be a mineral node; the NPRI share must be finite and greater than zero; the new node ID must be unique. LANDroid no longer blocks NPRI entries that appear to exceed the burdened branch or royalty bucket, because title work may need to preserve the discrepancy until it is corrected. Instead, `findNpriBranchDiscrepancies` reports the issue and Desk Map highlights the affected branch and NPRI cards in red.
- Important convention: `royaltyKind` (`fixed` versus `floating`) is preserved on the NPRI node for deed-text fidelity and is now consumed in leasehold payout math. Floating NPRIs are multiplied against lease royalty. Fixed NPRIs now require one more reading: `burdened_branch` means the fraction is of the branch itself; `whole_tract` means the fixed fraction is already stated against production from the land and is only scaled down if less than the full burdened branch is leased.
- Source: `src/engine/math-engine.ts:339-419`, `src/types/node.ts:8-28,30-81`.

### 4.3 Rebalance (executeRebalance)

- Landman description: this is "changing the size of an existing branch and letting that branch's descendants move proportionally with it." It is the tool for correcting an earlier branch size while keeping the same internal descendant ratios.
- Formula: scale factor = new initial fraction / old initial fraction; root branch current fraction = old current fraction x scale factor; every same-class descendant current fraction = old current fraction x scale factor; every same-class descendant initial fraction = old initial fraction x scale factor; parent remaining fraction = parent remaining fraction + old initial fraction - new initial fraction.
- Worked example: suppose a mineral branch was originally `1/8`, still retains `1/16`, and has one mineral child at `1/16`. If the branch should really have been `1/4`, the scale factor is `2`. The branch retained fraction becomes `1/8`, the child becomes `1/8`, and the parent's remaining fraction is reduced by another `1/8` because the corrected branch is now larger.
- Three-generation cascade: if that `1/16` child also had its own mineral child at `1/32`, that grandchild would also double to `1/16`. LANDroid collects same-class descendants only, so mineral descendants scale with minerals and NPRI descendants scale with NPRIs. One class does not automatically resize the other.
- Edge guards: the target node must exist, cannot be a related node, and must have a positive old initial fraction; the new initial fraction must be finite and greater than zero; the final graph must still validate.
- Source: `src/engine/math-engine.ts:133-176,397-459`.

### 4.4 Predecessor insert (executePredecessorInsert)

- Landman description: this is "inserting a missing title step above an existing branch." The existing branch is rescaled to fit inside the new predecessor, and the old parent is adjusted so the branch total still balances.
- Formula: scale factor = new predecessor initial fraction / active node old initial fraction; active branch and same-class descendants are multiplied by the scale factor; active node parent becomes the new predecessor; old parent remaining fraction = old parent remaining fraction + old active initial fraction - new predecessor initial fraction; new predecessor initial fraction = entered new initial fraction; new predecessor current fraction = `0` until its child allocations are counted.
- Worked example: assume a child branch currently sits under a root at `1/4`, retains `1/8`, and has a child at `1/8`. If a missing predecessor should have been `1/2`, the scale factor is `2`. The active branch retained fraction doubles from `1/8` to `1/4`, its child doubles from `1/8` to `1/4`, the new predecessor is inserted at `1/2`, and the old parent's remaining fraction is reduced by another `1/4`.
- Edge guards: the active node and new predecessor ID must exist and be distinct; the active node cannot be a related node; old and new initial fractions must be positive and finite; the final graph must validate.
- Source: `src/engine/math-engine.ts:474-553`.

### 4.5 Attach-conveyance / cross-tree move (executeAttachConveyance)

- Landman description: this is "moving a title branch from one parent to another and resizing it to the new conveyed amount." It refunds the old parent, debits the new parent, and rescales the moved branch.
- Formula: scale factor = new conveyed amount / old root initial fraction; old parent remaining fraction = old parent remaining fraction + old root initial fraction; destination remaining fraction = destination remaining fraction - new conveyed amount; moved root initial fraction = new conveyed amount; moved root and same-class descendants current and initial fractions = old values x scale factor.
- Worked example: if a branch originally allocated at `1/8` is moved from one mineral root to another and should now be `1/4`, the old parent gets `1/8` restored, the new parent loses `1/4`, and the moved branch plus its same-class descendants all double.
- Edge guards: both source root and destination must exist; neither can be a related node; source and destination must be the same interest class; the destination cannot be the source itself or a descendant of the source; the new conveyed amount must be finite, positive, and within destination capacity; the final graph must validate.
- Source: `src/engine/math-engine.ts:567-675`.

### 4.6 Delete branch with restoration (executeDeleteBranch)

- Landman description: this is "deleting a branch and restoring the conveyed amount to the parent." The target branch and all descendants are removed from the title tree.
- Formula: remove target node and all descendants; if the deleted target allocated against its parent, parent remaining fraction = parent remaining fraction + deleted target initial fraction.
- Worked example: if a root retains `3/8` and has a child branch originally conveyed at `1/8`, deleting that branch restores the parent from `3/8` back to `1/2`. Any descendants under the deleted branch are removed with it.
- Edge guards: the target must exist; after removal and restoration the graph must still validate.
- Source: `src/engine/math-engine.ts:686-733`.

### 4.7 Validation invariants (validateOwnershipGraph, validateCalcGraph)

- What the validator catches: duplicate node IDs, missing IDs, non-finite fractions, negative fractions, missing parents, self-parenting, cycles, over-allocated same-class branches, under-allocated same-class branches, and related-document nodes that incorrectly carry ownership fractions.
- What the validator does not catch: instrument interpretation, whether an NPRI should legally be fixed or floating, whether two separate root families represent a true title dispute, whether multiple leases on the same owner should be clipped or top-leased, or whether multiple NPRI siblings over-carve the lessor's royalty economically. The validator protects structure and arithmetic invariants; it does not replace landman judgment.
- Worked example: a mineral parent with initial `1/4`, remaining `1/16`, and mineral children totaling `3/16` is valid because `1/16 + 3/16 = 1/4`. The same parent with remaining `1/16` and mineral children totaling `1/8` is under-allocated because only `3/16` is accounted for.
- Source: `src/engine/math-engine.ts:752-876`.

## 5. Lease coverage allocation

LANDroid allocates lease coverage owner by owner. For each owner on a tract, it first removes inactive leases, then sorts the active leases by effective date, with earlier effective dates winning. Blank effective dates sort last. Within ties, the code falls back to created time, updated time, and ID so the result is deterministic. For each lease, the requested leased fraction is the lease's stated leased-interest field; if that field is blank, LANDroid treats the lease as requesting the owner's full fraction. It then allocates the smaller of the lease's request and the owner's remaining uncovered fraction. This is the current "first-effective wins" rule.

Known limitation requiring landman attention: if multiple active leases together claim more than the owner holds, LANDroid still clips the later lease instead of forcing a legal decision. It now records a warning showing requested, allocated, and clipped fractions, but the math still proceeds on the clipped result. That means the decimal output is reviewable, not self-proving, in overlap situations. A top lease, duplicate lease entry, or unresolved title issue can therefore look mathematically tidy after clipping even though the underlying lease story still needs a landman's judgment. Source: `src/components/deskmap/deskmap-coverage.ts:36-57,59-98,103-157,188-216`.

## 6. Leasehold unit math (the big one)

Unless a subsection says otherwise, use this standing example: a tract with `320` gross acres and `320` pooled acres sits in a `640`-acre unit, so tract participation factor is `320 / 640 = 0.5`. The owner in the example owns `0.5` undivided mineral, that entire `0.5` is leased, and the lease royalty rate is `1/8`. No ORRI or WI assignment is assumed unless the subsection says so.

### 6.1 Net mineral acres (NMA)

- Landman name: net mineral acres.
- Formula: NMA = gross acres x undivided mineral fraction.
- Worked example: `320 x 0.5 = 160`. A half-interest owner in a 320-acre tract has `160` NMA.
- Edge case or convention: this is based on tract gross acres, not pooled acres.
- Source: `src/components/leasehold/leasehold-summary.ts:433-434,455`.

### 6.2 Net pooled acres

- Landman name: net pooled acres.
- Formula: net pooled acres = pooled acres x undivided fraction.
- Worked example: `320 x 0.5 = 160`. In this example the pooled acres equal gross acres, so the owner's pooled acres are also `160`.
- Edge case or convention: if only part of the tract is pooled, this number can differ from NMA even when the owner's undivided fraction is unchanged.
- Source: `src/components/leasehold/leasehold-summary.ts:434-437,456`.

### 6.3 Owner tract royalty

- Landman name: owner tract royalty.
- Formula: owner tract royalty = leased fraction x lease royalty rate.
- Worked example: `0.5 x 1/8 = 0.0625`. In fraction form that is `1/16`.
- Edge case or convention: this is calculated from the leased fraction, not the owner's total tract ownership if part of the owner's interest is unleased.
- Source: `src/components/leasehold/leasehold-summary.ts:247-267,438-440,461`.

### 6.4 Tract participation factor (TPF) for the unit

- Landman name: tract participation factor.
- Formula: TPF = tract pooled acres / total pooled acres in unit.
- Worked example: `320 / 640 = 0.5`.
- Edge case or convention: if unit pooled acres are zero, LANDroid forces TPF to `0` rather than dividing by zero.
- Source: `src/components/leasehold/leasehold-summary.ts:483-485,548`.

### 6.5 Owner unit royalty decimal

- Landman name: owner unit royalty decimal.
- Formula: owner unit royalty decimal = TPF x owner tract royalty.
- Worked example: `0.5 x 0.0625 = 0.03125`.
- Edge case or convention: this is acreage-weighted. It is the tract royalty weighted by the tract's pooled share of the whole unit.
- Source: `src/components/leasehold/leasehold-summary.ts:252-254,441-443,462`.

### 6.6 Leased ownership of tract

- Landman name: leased ownership of tract.
- Formula: leased ownership of tract = sum of all leased fractions on the tract.
- Worked example: if only the half-interest owner is leased, leased ownership is `0.5`. If another owner later leases the other `0.5`, the tract leased ownership would become `1.0`.
- Edge case or convention: this is summed across owners after lease clipping, so overlapping later leases do not increase the number past the clipped allocation.
- Source: `src/components/leasehold/leasehold-summary.ts:475-478,547`.

### 6.7 Weighted royalty rate of tract

- Landman name: weighted royalty rate of tract.
- Formula: weighted royalty rate = sum of (leased fraction x royalty rate) across owners.
- Worked example: one owner contributes `0.5 x 1/8 = 0.0625`, so the tract weighted royalty rate is `0.0625`.
- Edge case or convention: if different owners have different royalty clauses, the tract weighted royalty is the sum of their separate slices, not a simple one-lease shortcut.
- Source: `src/components/leasehold/leasehold-summary.ts:479-482,549`.

### 6.8 NRI before ORRI

- Landman name: NRI before ORRI.
- Formula: NRI before ORRI = leased ownership - weighted royalty rate.
- Worked example: `0.5 - 0.0625 = 0.4375`. In fraction form that is `7/16`.
- Edge case or convention: this value used to be misnamed `workingInterestBaseRate`, but it is not raw working interest; it is the tract's after-royalty net revenue before ORRI.
- Source: `src/components/leasehold/leasehold-summary.ts:296-305,318-325,489-500,550`.

### 6.9 ORRI burden by basis

#### 6.9.1 gross_8_8 basis

- Landman name: gross `8/8` ORRI burden.
- Formula: gross `8/8` ORRI burden = leased ownership x ORRI share.
- Worked example: with leased ownership `0.5` and a gross-basis ORRI of `1/16`, the burden is `0.5 x 1/16 = 0.03125`.
- Edge case or convention: the base is the full leased ownership on the tract, not NRI-after-royalty.
- Source: `src/components/leasehold/leasehold-summary.ts:286-301,318-325,348-350`.

#### 6.9.2 working_interest basis

- Landman name: working-interest basis ORRI burden.
- Formula: working-interest basis ORRI burden = leased ownership x ORRI share.
- Worked example under the standing half-interest example: `0.5 x 1/80 = 0.00625`.
- Corrected convention: this is the corrected formula. The old formula multiplied by NRI-before-ORRI instead, which underpaid the ORRI and overstated WI. At `1/8` royalty, that old method was short by `12.5%`. At `1/6` royalty, it would be short by `16.67%`.
- Full worked review example requested for hand checking: use a single-tract unit with `320` gross acres, `320` pooled acres, owner A holding `1.0` mineral, owner A leased `1.0`, lease royalty `1/8`, and a unit-scope ORRI of `1/80` on `working_interest` basis.
- Step 1: leased ownership = `1.0`.
- Step 2: weighted royalty rate = `1.0 x 1/8 = 0.125`.
- Step 3: NRI before ORRI = `1.0 - 0.125 = 0.875`.
- Step 4: correct WI-basis ORRI burden = `1.0 x 1/80 = 0.0125`.
- Step 5: pre-WI rate = `0.875 - 0.0125 = 0.8625`.
- Old wrong formula, shown side by side: old WI-basis ORRI burden = `0.875 x 1/80 = 0.0109375`; old pre-WI rate = `0.875 - 0.0109375 = 0.8640625`.
- Difference caused by the old bug: ORRI was understated by `0.0015625`, and WI was overstated by the same amount.
- Source: `src/components/leasehold/leasehold-summary.ts:289-305,318-325,342-345`, `src/components/leasehold/__tests__/leasehold-summary.test.ts:224-226,874`.

#### 6.9.3 net_revenue_interest basis

- Landman name: NRI-basis ORRI burden.
- Formula: NRI-basis ORRI burden = NRI-after-other-ORRIs x ORRI share, where the base is computed after gross-basis and WI-basis ORRIs are subtracted.
- Worked example: start with NRI before ORRI `0.4375`. Add a gross-basis ORRI of `1/16`, which burdens `0.03125`, and a WI-basis ORRI of `1/80`, which burdens `0.00625`. The remaining NRI base is `0.4375 - 0.03125 - 0.00625 = 0.4`. A net-revenue-interest ORRI of `1/64` then burdens `0.4 x 1/64 = 0.00625`.
- Edge case or convention: when more than one NRI-basis ORRI applies to the same tract, LANDroid now applies them one by one in effective-date order. The first NRI-basis ORRI reduces the remaining NRI base before the second one is calculated. If an effective date is missing or tied, the code falls back to source document number and then record ID for a stable order. Practical review point: if multiple NRI-basis burdens exist, fill the effective dates carefully so the stacking order is easy to verify by hand.
- Source: `src/components/leasehold/leasehold-summary.ts:276-360,518-582`, `src/components/leasehold/__tests__/leasehold-summary.test.ts:880-1041`.

### 6.10 Pre-working-interest rate (the working interest available for assignment after all burdens)

- Landman name: pre-working-interest rate, and then pre-working-interest decimal after TPF weighting.
- Formula: pre-WI rate = NRI before ORRI - total ORRI burden, clamped at `0` if negative.
- Worked example: with NRI before ORRI `0.4375`, gross ORRI `0.03125`, WI-basis ORRI `0.00625`, and NRI-basis ORRI `0.00625`, total ORRI burden is `0.04375`, so pre-WI rate is `0.4375 - 0.04375 = 0.39375`. On a tract with TPF `0.5`, the tract's pre-WI decimal is `0.5 x 0.39375 = 0.196875`.
- Edge case or convention: if burdens exceed available NRI, LANDroid clamps the tract's pre-WI decimal to zero and marks the tract `overBurdened`. That warning is visible in the UI, but the clamp is still a simplifying convention and remains audit finding `#9`.
- Source: `src/components/leasehold/leasehold-summary.ts:505-514,558,565`.

### 6.11 Assigned working interest decimal

- Landman name: assigned working-interest decimal.
- Formula: assigned WI decimal = pre-WI decimal x sum of assignment shares.
- Worked example: with pre-WI decimal `0.196875` and one assignment of `1/2`, assigned WI decimal is `0.196875 x 0.5 = 0.0984375`.
- Edge case or convention: LANDroid sums all tract-relevant assignment shares first. It does not resolve overlapping source logic between unit-scope and tract-scope assignments beyond that arithmetic.
- Source: `src/components/leasehold/leasehold-summary.ts:515-526,559-560`.

### 6.12 Retained working interest decimal

- Landman name: retained working-interest decimal.
- Formula: retained WI decimal = pre-WI decimal - assigned WI decimal, clamped at `0` if negative.
- Worked example: `0.196875 - 0.0984375 = 0.0984375`.
- Edge case or convention: if assignment shares exceed `100%`, LANDroid flags the tract as `overAssigned` and clamps the retained decimal to zero instead of going negative.
- Source: `src/components/leasehold/leasehold-summary.ts:523-526,561-564`.

### 6.13 Transfer-order review variance

- Landman name: transfer-order review variance.
- Formula: variance = absolute value of (total decimals on transfer order - expected leased coverage decimal).
- Worked example: if expected leased coverage decimal is `TPF x leased ownership = 0.5 x 0.5 = 0.25`, and the transfer-order rows total `0.248`, the variance is `|0.248 - 0.25| = 0.002`.
- Edge case or convention: the expected comparison number is acreage-weighted leased coverage, not pre-WI. LANDroid uses this as a review signal, not as a legal adjudication of who should be paid.
- Source: `src/components/leasehold/leasehold-summary.ts:927-929,945-954,985-1005`.

## 7. NPRI handling

In LANDroid, NPRIs are non-participating royalty interests carried as sibling burdens on the mineral chain. They do not reduce mineral coverage in the title-tree math. That is by design: `executeCreateNpri` creates the NPRI child without shrinking the mineral parent's fraction, and graph validation measures mineral and NPRI allocation separately. On the leasehold side, LANDroid now reads current NPRI branches into payout math. A floating NPRI is calculated as `leased fraction x lease royalty x floating share`. A fixed NPRI is now calculated one of two ways depending on the deed basis stored on the node: `burdened_branch` uses `leased fraction x fixed share`, while `whole_tract` uses `leased fraction / burdened branch ownership x fixed share`, so the fixed whole-tract burden is preserved when the whole branch is leased and scaled down only when part of that branch is leased. The burden follows the mineral branch where the NPRI was created, including that branch's current mineral descendants, so an NPRI on an ancestor burdens that whole current branch proportionally. Floating NPRIs reduce the mineral owner's net royalty rows but do not reduce the leasehold NRI beyond the lease royalty already reserved. Fixed NPRIs appear as separate payout rows and also reduce the NRI base before NRI-basis ORRIs and retained WI are calculated. The repo's legal reference materials cite `ConocoPhillips Co. v. Hahn` (2025) for the importance of deed language and for the Texas distinction between fixed NPRI language and floating royalty language. Practical review point: if NPRIs over-claim a burdened branch or royalty bucket, LANDroid allows the title record to be saved, highlights the affected Desk Map branch in red, and keeps the calculated payout rows visible for review. If floating NPRIs on a branch exceed the full lease royalty, Leasehold also clamps the mineral-owner royalty row at zero, leaves a positive transfer-order variance, and keeps the unit-focus payout-entry review on hold until the over-carve is resolved. Source: `src/engine/math-engine.ts:339-419`, `src/components/leasehold/leasehold-summary.ts:635-705`, `src/views/LeaseholdView.tsx:3344-3349,3691-3699`, `src/types/node.ts:8-28,30-81`, `PROJECT_CONTEXT.md:80-105`.

## 8. Validation and error handling philosophy

LANDroid uses two layers of protection. First, ownership-tree mutation math is strict and blocking when a conveyance, rebalance, predecessor insert, attach, or delete would break core graph invariants such as negative fractions, missing parents, cycles, or same-class over-allocation. Second, title and leasehold review surfaces use warning-only flags where the system can still preserve the record but the number needs landman review. Examples are NPRI branch over-claims, lease-overlap clipping, over-assigned WI, over-burdened ORRI stacks, floating-NPRI over-carves, and transfer-order source gaps. A floating-NPRI over-carve no longer blocks entry work, but it does place the unit-focus payout-entry review on hold so the payout sheet is not treated as ready by mistake. Display-side helper parsers such as `d()` and `parseInterestString()` still coerce malformed persisted values to safe zeroes, which is useful for keeping screens stable but can hide bad stored input. Current lease-save, ORRI-save, and WI-assignment-save paths use `parseStrictInterestString()` and reject malformed or out-of-range interest text before it is saved. Source: `src/engine/math-engine.ts:84-107,245-315,339-419,449-450,543-544,665-666,715-722`, `src/engine/decimal.ts:20-29`, `src/utils/interest-string.ts:4-26,45-90`, `src/components/owners/OwnerLeasesTab.tsx:147-175`, `src/components/modals/AttachLeaseModal.tsx:109-129`, `src/views/LeaseholdView.tsx:690-709,1060-1077,1578-1600`.

## 9. What LANDroid does NOT calculate (today)

- No federal or BLM lease math. Research can store federal/private reference records, but Phase 2 math has not started.
- No private lease specialization outside the present Texas fee and Texas state baseline.
- No tribal lease math. Tribal is permanently out of scope under the current user instructions.
- No bonus, delay-rental, or shut-in royalty calculations.
- No Pugh-clause, depth-severance, or allocation-well clause calculations.
- No proportionate-reduction enforcement.
- No held-by-production or expiration tracking beyond storing lease dates and lease status values.
- No carried-interest, BIAPO, or NPI math.
- No ONRR reporting.

## 10. Source-of-truth file map

| File path | What it does | Load-bearing lines | Last committed touch |
| --- | --- | --- | --- |
| `src/engine/decimal.ts` | Decimal precision, storage formatting, display formatting | `10-18,21-29,47-57` | `a148dcc` |
| `src/engine/math-engine.ts` | Chain-of-title math operations and graph validation | `193-216,245-315,325-383,397-459,474-553,567-675,686-733,752-876` | `1a177bb` |
| `src/components/deskmap/deskmap-coverage.ts` | Lease activity screening, first-effective coverage allocation, overlap warnings | `36-57,59-98,103-157,188-216` | `1a177bb` |
| `src/components/leasehold/leasehold-summary.ts` | Acreage, royalty, NPRI, ORRI, WI, and transfer-order review math | `21-220,274-1228` | `8a313af` |
| `src/utils/interest-string.ts` | Lenient and strict fraction/decimal parsing | `4-26,45-85,87-94` | `1a177bb` |
| `src/types/node.ts` | Ownership node, tract record, interest-class and royalty-kind typing | `8-69,75-84` | `8a313af` |
| `src/types/owner.ts` | Owner, lease, jurisdiction discriminator, blank and normalize helpers | `42-88,163-220` | `1a177bb` |
| `src/types/leasehold.ts` | Leasehold unit, ORRI, assignment, transfer-order entry typing and normalization | `7-19,37-75,99-203` | `1a177bb` |

## 11. Verification ledger (for the reviewing landman)

- [ ] NMA formula matches company spec
- [ ] TPF formula matches company spec
- [ ] Royalty acreage-weighting matches company spec
- [ ] NRI = WI x (1 - burdens) matches company spec
- [ ] ORRI gross_8_8 basis matches company spec
- [ ] ORRI working_interest basis matches company spec
- [ ] ORRI net_revenue_interest basis matches company spec
- [ ] Fixed NPRI payout math matches company spec
- [ ] Floating NPRI payout math matches company spec
- [ ] Decimal precision policy is acceptable for company use
- [ ] Warning-only validation convention is acceptable

Company-specific deviations or required changes:

- 
- 
- 
