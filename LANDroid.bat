@echo off
setlocal

cd /d "%~dp0"

if "%PORT%"=="" set "PORT=5173"
set "URL=http://localhost:%PORT%/"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Stopping existing process on port %PORT%: %%P
  taskkill /PID %%P /F >nul 2>nul
)

echo Starting LANDroid dev server on %URL%
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"
call npm run dev -- --host 127.0.0.1
