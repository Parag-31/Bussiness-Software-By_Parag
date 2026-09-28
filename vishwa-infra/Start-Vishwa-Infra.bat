@echo off
setlocal
cd /d "%~dp0"
title Vishwa Infra Business Suite

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed on this computer.
  echo  Please install Node.js 20 or newer from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo  First-time setup: installing the application. This can take a few minutes...
  echo.
  call npm install
  if errorlevel 1 (
    echo  Setup failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

REM ---- Stop any older copy that is still running (it would keep serving the old version) ----
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":4000 .*LISTENING"') do (
  echo  Stopping the previous copy of the application...
  taskkill /F /PID %%p >nul 2>nul
)

REM ---- Rebuild automatically whenever the project files were updated ----
set NEEDBUILD=0
if not exist client\dist\index.html set NEEDBUILD=1
if not exist server\dist\index.js set NEEDBUILD=1
if not exist client\dist\build-version.txt set NEEDBUILD=1
if "%NEEDBUILD%"=="0" fc /b BUILD_VERSION.txt client\dist\build-version.txt >nul 2>nul || set NEEDBUILD=1

if "%NEEDBUILD%"=="1" (
  echo.
  echo  Applying updates - preparing the application. This can take a minute...
  echo.
  call npm install --no-audit --no-fund
  call npm run build
  if errorlevel 1 (
    echo  Build failed. Please contact support with the message above.
    pause
    exit /b 1
  )
  copy /y BUILD_VERSION.txt client\dist\build-version.txt >nul
)

echo.
echo  Starting Vishwa Infra Business Suite...
echo  The app will open automatically in its own window. If not, go to http://localhost:4000
echo.
echo  Keep this window open while you use the application.
echo  Close this window to stop the application.
echo.
start /min "" "%~dp0Open-App-Window.bat"
call npm start
pause
