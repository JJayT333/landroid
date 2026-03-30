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
- `Desk Map` for title-chain editing, ownership-versus-leasing coverage checks, leased-status flags on mineral-owner cards, separate terminal lessee nodes, and separate NPRI branches that do not reduce the mineral coverage totals
- `Leasehold` for acreage-first tract setup, pooled-participation review, unit metadata, derived owner net acres, first-pass total royalty calculations from active lease records, and initial leasehold-side ORRI burden tracking
- `Flowchart` for presentation and print layout
- `Runsheet` for chronology review and export
- `Owners` for workspace-scoped owner, lease, contact, and document records
- `Maps` for the featured-map workspace with supporting PDF/image/GeoJSON assets, linked regions, and outside references
- `Research` for workspace-scoped RRC dataset cataloging, imported research files, explicit-save metadata editing, readable table previews for delimited RRC TXT files, and structured decoder paths for pending drilling permits, drilling-permit master files, and horizontal drilling permits

## Demo loaders
- `Stress (100/150/500)` loads the Desk Map stress workspace with three tract-sized title trees
- `Leasehold (5 Tracts)` loads a separate five-tract unit demo with `100`, `200`, `300`, `400`, and `500` gross acres, matching pooled acres, shared unit metadata, 100% lease coverage for every present owner at `1/8` royalty, and a starter unit-wide ORRI burden

## Persistence notes
- Browser autosave keeps the active workspace and flowchart canvas locally.
- `.landroid` exports now capture workspace data, flowchart canvas state, owner records, owner documents, map assets, and research imports in one self-contained backup.
- `.landroid` imports now fail clearly on malformed top-level payloads instead of partially loading junk data.
- CSV imports create a fresh workspace and intentionally start with empty owner, map, and research side records.

## Repo notes
- `dist/` is generated browser-ready output from `npm run build`.
- `dist-node/` is generated TypeScript config output from the composite build.
