@echo off
setlocal
cd /d "%~dp0"

set PORT=8421
start /b "" python -m http.server %PORT%

rem Allow server to start before opening browser.
timeout /t 1 /nobreak >nul
start "" http://localhost:%PORT%/
