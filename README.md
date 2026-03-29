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
- Local PDF companion folder for runsheet exports: `TORS_Documents/`

## Current surfaces
- `Desk Map` for title-chain editing
- `Flowchart` for presentation and print layout
- `Runsheet` for chronology review and export
- `Owners` for workspace-scoped owner, lease, contact, and document records
- `Research` for workspace-scoped map/reference assets such as PDF maps, images, and GeoJSON

## Persistence notes
- Browser autosave keeps the active workspace and flowchart canvas locally.
- `.landroid` exports now capture workspace data, flowchart canvas state, owner records, owner documents, and research map assets in one self-contained backup.
- CSV imports create a fresh workspace and intentionally start with empty owner and research records.

## Repo notes
- `dist/` is generated browser-ready output from `npm run build`.
- `dist-node/` is generated TypeScript config output from the composite build.
