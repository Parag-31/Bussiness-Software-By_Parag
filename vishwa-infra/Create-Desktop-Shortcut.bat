@echo off
setlocal
cd /d "%~dp0"
title Vishwa Infra - Create Desktop Icon

echo.
echo  Creating a "Vishwa Infra" icon on your Desktop...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$link = $ws.CreateShortcut([System.IO.Path]::Combine($ws.SpecialFolders('Desktop'), 'Vishwa Infra.lnk'));" ^
  "$link.TargetPath = (Join-Path (Get-Location) 'Start-Vishwa-Infra.bat');" ^
  "$link.WorkingDirectory = (Get-Location).Path;" ^
  "$link.IconLocation = (Join-Path (Get-Location) 'app-icon.ico');" ^
  "$link.Description = 'Vishwa Infra Business Suite';" ^
  "$link.WindowStyle = 7;" ^
  "$link.Save()"

if errorlevel 1 (
  echo  Could not create the shortcut. You can also right-click Start-Vishwa-Infra.bat,
  echo  choose "Send to > Desktop (create shortcut)", then right-click that shortcut,
  echo  Properties, Change Icon, and browse to app-icon.ico in this folder.
  pause
  exit /b 1
)

echo  Done — look for "Vishwa Infra" on your Desktop.
echo  Double-click it any time to open the app. This only needs to be run once.
echo.
pause
