@echo off
set PORT=8421
start "" http://localhost:%PORT%/
python -m http.server %PORT%
