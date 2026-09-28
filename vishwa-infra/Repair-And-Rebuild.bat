@echo off
REM Run this ONCE after replacing project files with an updated version
REM (e.g. after a bug fix), or any time the app misbehaves and a clean
REM reinstall might help. Your data in server\data\vishwa.db is untouched.
setlocal
cd /d "%~dp0"
title Vishwa Infra - Repair

REM ---- Build/repair access is restricted to the developer PIN. ----
REM Everyday business use (Start-Vishwa-Infra.bat, Backup-Database.bat) does
REM NOT need this and is open to every team login.
REM The PIN lives in devpin.txt (created next to this script, kept out of
REM version control) instead of in this file, so it can be changed without
REM editing the script and is never accidentally shared with the project.
if not exist devpin.txt (
  echo PARAG2026> devpin.txt
  echo  First run: created devpin.txt with the default PIN. Open it and
  echo  change the PIN whenever you like - this script will use whatever
  echo  is in that file from now on.
  echo.
)
set /p DEVPIN="Enter developer PIN to continue: "
set /p STOREDPIN=<devpin.txt
if not "%DEVPIN%"=="%STOREDPIN%" (
  echo.
  echo  Incorrect PIN. Only the developer/technical account may repair or rebuild the app.
  echo  If you need this done, contact Parag Udgirkar.
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

echo.
echo  This will reinstall dependencies and rebuild the application.
echo  Your business data (customers, invoices, letterheads) is kept.
echo.
pause

echo Stopping the application if it is running...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":4000 .*LISTENING"') do taskkill /F /PID %%p >nul 2>nul
timeout /t 2 /nobreak >nul

echo Removing old dependency folders and build output...
if exist node_modules rmdir /s /q node_modules
if exist client\node_modules rmdir /s /q client\node_modules
if exist server\node_modules rmdir /s /q server\node_modules
if exist client\dist rmdir /s /q client\dist
if exist server\dist rmdir /s /q server\dist

echo.
echo  Reinstalling (this can take a few minutes)...
echo.
call npm install
if errorlevel 1 (
  echo  Install failed. Check your internet connection and try again.
  pause
  exit /b 1
)

echo.
echo  Rebuilding...
echo.
call npm run build
if errorlevel 1 (
  echo  Build failed. Please share the message above.
  pause
  exit /b 1
)

copy /y BUILD_VERSION.txt client\dist\build-version.txt >nul

echo.
echo  Repair complete. You can now use Start-Vishwa-Infra.bat as normal.
echo.
pause
