# LANDroid

This repository root is now the active LANDroid application.

## Scope

**Texas math remains Texas-only for now.** LANDroid currently calculates Texas fee and Texas state lease/title math only. Research can now track federal/private project records, mapped tracts, source notes, and lease inventory as reference records, but federal/BLM and private lease math remain **Phase 2** work behind a separate decision gate. See `PROJECT_CONTEXT.md` for details.

## Quick start

### Launchers
- macOS: `LANDroid.command`
- Windows: `LANDroid.bat`

### Terminal
```bash
cd /path/to/landroid
npm install
npm run dev
```

Then open `http://localhost:5173/`.

## Useful files
- User manual: `USER_MANUAL.md`
- Landman math reference: `LANDMAN-MATH-REFERENCE.md`
- Continuation handoff: `CONTINUATION-PROMPT.md`
- App entry: `src/main.tsx`
- Main app shell: `src/App.tsx`
- Demo branding assets: `src/assets/branding/`
- Local PDF companion folder for runsheet exports: `TORS_Documents/`

## Current surfaces
- `Desk Map` for title-chain editing, ownership-versus-leasing coverage checks, multiple starting root families when title is still incomplete, existing-owner linking on unlinked mineral cards, branch-scoped leased-status flags on mineral-owner cards, separate terminal lessee nodes, separate NPRI branches that do not reduce the mineral coverage totals, warning-only red branch highlights when NPRI burdens over-claim the branch/royalty bucket, and a mineral-owner search box with a clickable results list that can jump across tract tabs by owner name
- `Leasehold` for acreage-first tract setup, pooled-participation review, unit metadata, dual gross-vs-pooled owner acreage outputs, branch-scoped Desk Map lease-card coverage, aggregated royalty calculations across active lease records, fixed-and-floating NPRI payout support with fixed-deed basis tracking (`burdened branch` vs `whole tract`), leasehold-side ORRI burden tracking across gross `8/8`, working-interest, and net-revenue-interest bases, a full-size `Map` mode that visualizes `Unit -> Tract -> Owner Branch / ORRI / WI -> Lease Slice / NPRI` without changing Desk Map title meaning, and a card-based internal `Deck` view with editable unit-level transfer-order rows layered on top of the derived review surface; floating-NPRI over-carves now keep unit-focus payout readiness on `Hold` while editing stays available
- `Flowchart` for presentation and print layout
- `Runsheet` for chronology review, export, and opening the same node or lease editor cards used in `Desk Map`
- `Owners` for workspace-scoped owner, lease, contact, and document records, with lease edits flowing back into linked Desk Map and Runsheet lease nodes, a canonical Texas-baseline lease-status picker for new edits, direct buttons to create or reopen the linked Desk Map lease node from each saved lease card, existing-owner reuse for same-party multi-tract title, and local search/sort controls so long owner lists are easier to work
- `Curative` for title issues and curative tracking: probate/heirship gaps, NPRI discrepancies, missing leases or ratifications, bad legal descriptions, liens, name mismatches, unrecorded assignments, over-conveyances, and title-opinion requirements can be prioritized, assigned, linked to tracts/branches/owners/leases, and kept warning-only until resolved
- `Maps` for the featured-map workspace with supporting PDF/image/GeoJSON assets, linked regions, GeoJSON feature summaries, outside references, and links to Research sources or project records
- `Research` for workspace-scoped source records, landman-readable formula cards, saved questions, federal/private project-record scaffolding, and a secondary advanced `Data Imports` area for RRC cataloging, imported files, readable table previews, and the existing permit decoders

## Demo loaders
- `Stress (100/150/500)` loads the Desk Map stress workspace with three tract-sized title trees
- `Leasehold (8 Tracts)` loads a separate eight-tract unit demo with clean `80`-acre-step gross and pooled acreage, clean half/quarter/eighth present-owner splits, 100% lease coverage for every present owner at `1/8` royalty, a starter unit-wide ORRI burden, and starter WI assignments

## Persistence notes
- Browser autosave keeps the active workspace and flowchart canvas locally.
- Saved workspace loads now validate the ownership graph before hydration instead of trusting malformed tree data.
- If autosaved workspace or canvas data is corrupt, LANDroid now opens a safe fresh state and shows a startup warning instead of silently treating the bad record like an empty workspace.
- `.landroid` exports now capture workspace data, flowchart canvas state, node PDF attachments, owner records, owner documents, curative title issues, map assets, and research sources/formulas/project records/questions/imports in one self-contained backup.
- `.landroid` imports now fail clearly on malformed top-level payloads and invalid ownership graphs instead of partially loading junk data.
- CSV imports create a fresh workspace and intentionally start with empty owner, curative, map, and research side records.

## Repo notes
- `dist/` is generated browser-ready output from `npm run build`.
- `dist-node/` is generated TypeScript config output from the composite build.
