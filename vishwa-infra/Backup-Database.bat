@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
if not exist server\data\vishwa.db (
  echo No database found yet at server\data\vishwa.db
  echo Run the application at least once first.
  pause
  exit /b 1
)
if not exist backups mkdir backups
set STAMP=%date:~-4%-%date:~3,2%-%date:~0,2%_%time:~0,2%-%time:~3,2%
set STAMP=%STAMP: =0%
copy /Y "server\data\vishwa.db" "backups\vishwa-backup-%STAMP%.db" >nul
echo.
echo  Backup saved to: backups\vishwa-backup-%STAMP%.db
echo.
pause
