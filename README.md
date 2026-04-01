# LANDroid

This repository root is now the active LANDroid application.

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
- Continuation handoff: `CONTINUATION-PROMPT.md`
- App entry: `src/main.tsx`
- Main app shell: `src/App.tsx`
- Demo branding assets: `src/assets/branding/`
- Local PDF companion folder for runsheet exports: `TORS_Documents/`

## Current surfaces
- `Desk Map` for title-chain editing, ownership-versus-leasing coverage checks, multiple starting root families when title is still incomplete, leased-status flags on mineral-owner cards, separate terminal lessee nodes, and separate NPRI branches that do not reduce the mineral coverage totals
- `Leasehold` for acreage-first tract setup, pooled-participation review, unit metadata, dual gross-vs-pooled owner acreage outputs, aggregated royalty calculations across active lease records, leasehold-side ORRI burden tracking across gross `8/8`, working-interest, and net-revenue-interest bases, first WI assignment splits, and a card-based internal `Deck` view with editable unit-level transfer-order rows layered on top of the derived review surface
- `Flowchart` for presentation and print layout
- `Runsheet` for chronology review and export
- `Owners` for workspace-scoped owner, lease, contact, and document records
- `Maps` for the featured-map workspace with supporting PDF/image/GeoJSON assets, linked regions, and outside references
- `Research` for workspace-scoped RRC dataset cataloging, imported research files, explicit-save metadata editing, readable table previews for delimited RRC TXT files, and structured decoder paths for pending drilling permits, drilling-permit master files, and horizontal drilling permits

## Demo loaders
- `Stress (100/150/500)` loads the Desk Map stress workspace with three tract-sized title trees
- `Leasehold (8 Tracts)` loads a separate eight-tract unit demo with clean `80`-acre-step gross and pooled acreage, clean half/quarter/eighth present-owner splits, 100% lease coverage for every present owner at `1/8` royalty, a starter unit-wide ORRI burden, and starter WI assignments

## Persistence notes
- Browser autosave keeps the active workspace and flowchart canvas locally.
- Saved workspace loads now validate the ownership graph before hydration instead of trusting malformed tree data.
- If autosaved workspace or canvas data is corrupt, LANDroid now opens a safe fresh state and shows a startup warning instead of silently treating the bad record like an empty workspace.
- `.landroid` exports now capture workspace data, flowchart canvas state, owner records, owner documents, map assets, and research imports in one self-contained backup.
- `.landroid` imports now fail clearly on malformed top-level payloads and invalid ownership graphs instead of partially loading junk data.
- CSV imports create a fresh workspace and intentionally start with empty owner, map, and research side records.

## Repo notes
- `dist/` is generated browser-ready output from `npm run build`.
- `dist-node/` is generated TypeScript config output from the composite build.
