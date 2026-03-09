# LANDroid QA Test Report

Date: 2026-03-09

## Scope Tested
- App boot from `index.html` and `dist/app.jsx` with no parse/runtime crash.
- Home/startup screen and workspace entry flow.
- DeskMap management:
  - Add DeskMap.
  - Rename active DeskMap.
  - Persist DeskMap rename through save + reload.
- Runsheet filtering controls:
  - Active DeskMap.
  - All DeskMaps.
  - Specific DeskMap options.
- Flow Chart sourcing/import controls:
  - Active source / all source / specific source options.
  - `Import Selected DeskMap(s)` and `Import + Append` actions availability.
- Save and return flow:
  - Save workspace.
  - Return to home/project picker.
- App boot and Babel compilation through `index.html` + `dist/app.jsx`.
- Home screen visibility and startup actions.
- Workspace shell load and primary navigation tabs.
- Presence of controls for the requested regression areas:
  - DeskMap management controls (`+ DeskMap`, `Save Name`).
  - Runsheet DeskMap filtering options (`All DeskMaps`, `Active DeskMap`).
  - Flow Chart import controls (`Import Selected DeskMap(s)`, `Import + Append`).
  - Save and return controls (`Save Workspace`, `Back to Home`).

## Commands / Checks Run
1. Served app locally:
   - `python3 -m http.server 4173`
2. Browser automation checks with Playwright MCP (Firefox):
   - Startup + navigation smoke check.
   - Runsheet filter-option verification.
   - Flow Chart import control verification.
   - DeskMap rename persistence verification across save/reload.

## Key Observations
- Home page loaded and `Start New Workspace` action entered workspace UI successfully.
- Workspace controls appeared (`Desk Map`, `Runsheet`, `Flow Chart`, `Save Workspace`, `Save + Home`).
- DeskMap rename worked and persisted after returning home and reloading workspace.
- Runsheet filter select included `Active DeskMap`, `All DeskMaps`, and concrete DeskMap options.
- Flow Chart source select included active/all/specific options and both import action buttons were present.

## Environment Limitations
- Prior longer browser sessions were occasionally unstable in this environment, so tests were split into shorter targeted checks for reliability.
2. Browser smoke test with Playwright MCP:
   - Verified home page renders and root content is populated.
   - Verified workspace can be entered and key controls are visible.

## Observed Result
- The current committed app version renders and exposes the key controls associated with the last reported regressions.
- Additional deep end-to-end behavior checks were attempted with browser automation but were intermittently limited by browser-session instability/timeouts in the execution environment.
