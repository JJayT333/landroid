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

## Repo notes
- `dist/` is generated browser-ready output from `npm run build`.
- `dist-node/` is generated TypeScript config output from the composite build.
