# Title-Math Research Prompt — Supplement

Paste-ready FOLLOW-UP for the same external Claude research chat that received
`docs/title-math-research-prompt.md`. Send it between parts (after the current
part finishes), or after completion — it applies retroactively to everything
already produced. Archive with the original when the workstream completes.

---

This supplements the catalog brief you are already executing. Three additions.
They apply to all parts you have already produced AND all parts remaining; when
you reach the end, run the new appendix pass over the entire catalog.

## Addition 1 — Tier promotion: federal/BLM and New Mexico items

The product's operator has a concrete coming project: roughly 60,000 acres,
heavy BLM federal acreage leased from the United States, interleaved with
private fee minerals, developed with horizontal wells whose laterals cross fee
tracts to bottom holes under federal lands. Promote the following from Tier 2
inventory to FULL Tier-1 treatment (same TXM block format; continue the ID
sequence; mark each entry `context: Federal / BLM` or `context: New Mexico`):

1. BLM competitive leasing mechanics that produce numbers: lease sale bidding,
   EOI/nomination, rental schedule and royalty rate BY LEASE VINTAGE — include
   the Inflation Reduction Act (2022) changes to onshore royalty, rentals, and
   minimum bids in the temporal ledger with exact effective dates and which
   lease issue dates each regime governs. Verify rates against current 43 CFR;
   mark [UNVERIFIED] where you cannot confirm.
2. Federal lease anatomy for math: 10-year terms, suspensions, segregation on
   partial assignment, acreage limits, stipulations/COAs as they affect
   operations timing (inventory the kinds; no decimal math expected).
3. Communitization Agreements (CAs): when required (federal minerals inside a
   spacing/proration unit that the federal lease cannot independently hold),
   tract participation math (surface-acreage allocation as the default),
   effective dates, BLM approval mechanics, royalty distribution across
   federal and fee tracts under a CA — worked numeric example with a mixed
   fed/fee unit.
4. Federal units (exploratory/secondary) vs CAs: participating area math,
   tract participation formulas, PA revisions — worked example.
5. Fed/fee horizontal allocation: the lateral crosses fee tracts to a bottom
   hole under federal land. Catalog every allocation approach in use
   (productive-lateral-length allocation, surface-acreage CA allocation,
   take-point allocation), what federal regulators require vs what Texas/NM
   state law tolerates, and where authority is unsettled — this is the
   operator's highest-stakes future math; present competing computations with
   worked numbers and label status honestly.
6. ONRR royalty valuation and reporting at INVENTORY depth only (name the
   moving parts: transportation/processing allowances, unbundling; no deep
   math) — flag it as a deliberate Phase 2 boundary.
7. New Mexico essentials at Tier-1.5 depth (rules + one worked example each,
   less exhaustive than Texas): NMSLO state trust land leases (royalty rates,
   terms, assignment approval), NM intestacy basics for fee-mineral chains by
   death date, NM community property descent, OCD spacing/pooling and
   compulsory pooling math (the NM analog of MIPA — risk penalties on
   non-consenting owners produce decimals; include the statutory penalty
   percentages with citations), and NM's treatment of the double-fraction /
   fixed-vs-floating problem if its courts diverge from Texas.

## Addition 2 — applies to every entry (including those already written)

When you produce the final master index, add two columns: `context`
(Texas | Federal / BLM | New Mexico | General) and `authorityYears` (the
pipe-separated years of the controlling authorities). Do not rewrite finished
parts for this — the appendix pass below captures it.

## Addition 3 — machine-importable appendix (run once, at the very end)

After the last catalog part, emit one final part titled `IMPORT APPENDIX`
containing three fenced CSV blocks covering EVERY item from ALL parts. These
load into the software's Research workspace, so match these columns exactly,
quote any field containing a comma, and use `|` to separate multiple values
inside a field.

CSV 1 — `research_sources.csv` (one row per distinct authority cited anywhere
in the catalog; deduplicate):

```
title,sourceType,context,status,citation,url,notes
```

- `title`: short name (e.g., `Duhig v. Peavy-Moore Lumber Co.`).
- `sourceType`: one of `Statute, Case, Agency Guidance, Manual, Other`.
- `context`: one of `Texas, Federal / BLM, General, Other` (use `Other` for
  New Mexico and put `New Mexico` in notes).
- `status`: `Verified` if you confirmed the citation, else `Needs Review`.
- `citation`: full cite with court and year; append `[UNVERIFIED]` if unsure.
- `url`: official source URL if one exists, else blank.
- `notes`: one-line statement of what this authority decides + the years it
  governs (from the temporal ledger).

CSV 2 — `research_formulas.csv` (one row per TXM item that is COMPUTABLE):

```
title,category,status,formulaText,explanation,variables,example,notes
```

- `title`: `TXM-### — <name>` (keeps your stable ID visible).
- `category`: one of `Royalty Math, Decimal Interest Calculations,
  Unit / Pooling Math, Federal Lease Math, Title Math Checks, Other`.
- `status`: always `Needs Review` (a human verifies before relying on it).
- `formulaText`: the formula(s), single line.
- `explanation`: the landman statement, single line.
- `variables`: the defined variables, `name=meaning` pairs `|`-separated.
- `example`: ONE worked example, exact fractions and 9-decimal result.
- `notes`: authorities (short names matching CSV 1 titles, `|`-separated) +
  temporal applicability one-liner + interactions (TXM ids).

CSV 3 — `research_questions.csv` (one row per item you marked SPLIT AUTHORITY
or FACT-SPECIFIC, and one per [UNVERIFIED] citation):

```
question,answer,status,notes
```

- `question`: the precise issue an attorney must resolve (e.g., `TXM-041: when
  a fixed NPRI exceeds the lease royalty, does the excess burden the lessee's
  working interest?`).
- `answer`: your best current summary of both positions, single line.
- `status`: `Needs Review`.
- `notes`: related authorities (CSV 1 titles) and TXM ids.

Formatting rules for the appendix: plain CSV, header row exactly as shown, no
markdown inside cells, no blank lines inside a block, every row complete. If
the appendix is too large for one response, split it by CSV block and say
which block continues.
