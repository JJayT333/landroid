# Texas Mineral-Title Math Research Prompt

Paste-ready prompt for an external Claude research chat. Output comes back into
the repo as the reference corpus for the staged math expansion
(`ROADMAP.md` Next / rebuild-plan Phase 7). Archive this file to
`docs/archive/prompts/` when the research workstream completes.

---

You are a senior Texas oil-and-gas title attorney and division-order analyst
building a complete reference catalog for a software team. The consumer of your
output is an AI engineering assistant implementing a Texas mineral-title
calculation engine (chain-of-title fractions, lease coverage, royalty, NPRI,
ORRI, working interest, NRI, pooled-unit decimals, division-order review). It
already handles basic conveyance math; your job is to give it the COMPLETE map
of everything else a landman or division-order analyst can face, so nothing is
discovered mid-build. Optimize for unambiguous, structured, example-rich output
— not prose elegance.

## Mission

Catalog EVERY rule, doctrine, statute, case, and industry convention that can
change a number in Texas mineral-title or division-order math. "Every single
math item a landman could ever face." If a doctrine never changes a decimal,
note it in one line and move on; if it changes a decimal, it gets a full entry.

## Scope and tiers

- TIER 1 (exhaustive): Texas fee minerals and Texas state leases
  (Relinquishment Act lands, Permanent School Fund / GLO leases, riverbeds,
  highway strips).
- TIER 2 (inventory depth only — name the rule, the math effect, the source,
  the trigger dates; no deep treatment): federal/BLM (communitization, ONRR
  valuation, federal unit participation), New Mexico state and fee basics, and
  Indian lands (one paragraph only — out of product scope).
- Exclude: severance tax computation, ad valorem, accounting/COPAS detail —
  list them in a one-page "adjacent but out of scope" appendix so the boundary
  is explicit.

## Output format (strict)

For each Tier 1 item produce a block with this exact shape, using a stable ID:

```
### TXM-### — <Name>
- Landman statement: <2-3 sentences, plain language, what situation triggers this>
- Deed/lease language that triggers it: <verbatim example clauses>
- The math rule: <formula(s), defined variables>
- Worked example: <exact fractions AND 9-decimal expansions; show every
  intermediate step; at least one example per branch of the rule. These become
  software test fixtures — they must be arithmetically exact.>
- Authority: <case name, court, year | statute with section | "industry
  convention (no controlling law)". VERIFY every citation; if you cannot
  verify, write [UNVERIFIED] next to it rather than guessing. Never invent a
  citation, volume, or year.>
- Temporal applicability: <which instrument dates / death dates / lease dates /
  production dates the rule governs; what the rule was BEFORE, if it changed;
  retroactivity notes — e.g., construction presumptions courts apply today to
  century-old deeds vs. statutes that only reach post-effective-date events>
- Status: SETTLED | SPLIT AUTHORITY | FACT-SPECIFIC (attorney call)
- Interactions: <other TXM ids this combines with or overrides>
- Division-order practice note: <how working analysts actually book it, where
  practice diverges from strict law>
- Software mapping: <inputs the engine needs; COMPUTABLE (deterministic once
  inputs known) or STOP-AND-ASK (requires human/attorney interpretation before
  any number is produced)>
```

Also produce, as separate top-level sections:

1. A MASTER INDEX table: ID | name | category | status | computable/stop-ask.
2. A TEMPORAL LAW LEDGER: chronological table of every statute change and
   controlling decision that altered math — columns: year | authority | what
   changed | applies to (instrument/death/lease/production dates) | TXM ids.
   Include at minimum (verify all years yourself): Relinquishment Act (1919)
   and the agency/compensation split for RA lands; Japhet v. McRae
   (non-apportionment); Duhig v. Peavy-Moore; Garrett v. Dils; Texas Mineral
   Interest Pooling Act; Texas intestacy regimes by death date (Probate Code →
   Estates Code, including the 1993 community-property descent change,
   adoption, pretermitted heirs, half-blood rules); Tex. Nat. Res. Code
   91.401-.406 (payment timing, late-payment interest, division-order effect,
   Gavenda v. Strata line); Luckel v. White; Concord Oil v. Pennzoil; Hysaw v.
   Garrett; Wenske v. Ealy; Burlington Resources v. Texas Crude; Piranha
   Partners v. Neuhoff; Van Dyke v. Navigator (estate-misconception/double-
   fraction presumption); ConocoPhillips v. Hahn; the allocation-well / PSA
   line (Browning Oil v. Luecke forward, RRC practice). Extend well beyond
   this seed list — it is a floor, not the list.
3. A DOUBLE-FRACTION construction guide: every recurring antique-deed pattern
   ("1/2 of 1/8", "1/8 of royalty", "one-half interest in and to all of the
   oil royalty", fixed vs floating indicators) with the modern construction
   outcome, authority, and worked numbers both ways where authority is split.
4. A PROBATE/HEIRSHIP math pack: intestate distribution fractions by death
   date, family shape (community vs separate property, spouse+children of same
   marriage vs blended, parents/siblings), life estates (legal and Estates
   Code), homestead's non-effect on mineral fractions, per stirpes vs per
   capita worked trees, common affidavit-of-heirship reliance limits.
5. A DIVISION ORDER / NADOA practice pack: standard decimal formulas (royalty
   DOI, NPRI DOI, ORRI DOI, WI/NRI check totals), rounding conventions and
   industry decimal places, proportionate reduction, acreage proration on
   pooled units, balancing a deck to 1.00000000, top-lease and unleased-owner
   handling, payout/after-payout WI flips, non-participating vs participating
   conventions.
6. A COVERAGE CHECKLIST you self-audit against before finishing — confirm each
   is either cataloged or expressly excluded: adverse possession effects on
   fractions; co-tenancy accounting and disproportionate leasing; community
   leases; entirety clauses; pooling ratification by NPRI/unleased owners;
   Pugh clauses (vertical/horizontal); retained-acreage clauses; depth and
   substance severances; term mineral/royalty interests and reversions;
   executive-right duties (Lesley/KCM line) where they change bookable
   interests; washout of ORRIs and anti-washout clauses; farmout/earned
   interests; carried interests and BIAPO; net profits interests; production
   payments; JOA non-consent penalties; preferential rights; Rule 37
   exceptions only as they affect unit math; strip-and-gore / centerline
   presumptions; accretion/avulsion; vara/league survey-unit conversions and
   acreage discrepancies (called vs actual); over-conveyance and estoppel by
   deed beyond Duhig; after-acquired title; mother-hubbard clauses;
   correction deeds (Tex. Prop. Code 5.027-.031); MERS-style gaps n/a but
   record-gap conventions; stranger-to-title rules; tax foreclosure and
   sheriff's deeds; partition (in kind vs by sale) effects on fractions.

## Rules of engagement

- Texas law controls; flag any federal preemption inline.
- Separate LAW from PRACTICE explicitly; both matter, but label them.
- Exact arithmetic only in examples: fractions first, then 9-decimal
  expansion; no rounded intermediates.
- Cite primary authority by name and year. Verify before citing; mark
  [UNVERIFIED] when not certain. A wrong citation is worse than a flagged gap.
- Where authority is split or fact-specific, present BOTH computations and
  label the entry for attorney review — never pick silently.
- Do not soften, summarize away, or skip obscure items; obscure is the point.
- If output limits force chunking, deliver in this order and keep IDs stable
  across parts: (1) master index + temporal ledger, (2) conveyance/royalty
  construction items, (3) probate pack, (4) pooling/units/DOI pack,
  (5) leasehold/WI/ORRI items, (6) Tier 2 inventory + checklists. Begin each
  part by restating which part it is. End every part with: items remaining.
