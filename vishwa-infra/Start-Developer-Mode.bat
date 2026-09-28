@echo off
REM For software development only: runs the client and server separately
REM with live-reload, on http://localhost:5173. Everyday business use should
REM use Start-Vishwa-Infra.bat instead.
setlocal
cd /d "%~dp0"
title Vishwa Infra - Developer Mode

REM ---- Developer mode is restricted to the developer PIN. ----
REM The PIN lives in devpin.txt (created next to this script, kept out of
REM version control) instead of in this file - see Repair-And-Rebuild.bat.
if not exist devpin.txt (
  echo PARAG2026> devpin.txt
  echo  First run: created devpin.txt with the default PIN. Open it and
  echo  change the PIN whenever you like.
  echo.
)
set /p DEVPIN="Enter developer PIN to continue: "
set /p STOREDPIN=<devpin.txt
if not "%DEVPIN%"=="%STOREDPIN%" (
  echo.
  echo  Incorrect PIN. Developer Mode is restricted to the developer/technical account.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
)
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5173"
call npm run dev
pause
