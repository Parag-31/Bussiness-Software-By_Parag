@echo off
REM Called by Start-Vishwa-Infra.bat after the server starts. Not meant to
REM be run by itself, though nothing bad happens if you do.
setlocal
cd /d "%~dp0"

REM Wait for the server to actually be accepting connections, rather than
REM guessing a fixed delay - a fixed wait is either too short on a slower
REM machine (opens too early, then shows a cannot-reach-page error) or wastefully long
REM on a fast one. Checks every half second for up to 30 seconds.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ok = $false; for ($i = 0; $i -lt 60; $i++) { try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', 4000); $c.Close(); $ok = $true; break } catch { Start-Sleep -Milliseconds 500 } }; if (-not $ok) { exit 1 }"
if errorlevel 1 (
  REM Server never came up. Say what to do instead of opening a dead page.
  powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('The Vishwa Infra server did not start.' + [Environment]::NewLine + [Environment]::NewLine + 'Open the window named Vishwa Infra Business Suite in your taskbar to see the error message, or run Repair-And-Rebuild.bat.', 'Vishwa Infra', 'OK', 'Warning') | Out-Null"
  exit /b 1
)

REM Prefer opening in "app mode" - a clean window with no address bar or
REM tabs, matching what an installed PWA looks like - so one double-click
REM of the Desktop icon both starts the server AND opens something that
REM feels like a real app, not a browser tab.
set "EDGE1=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
set "CHROME1=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME2=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE1%" (
  start "" "%EDGE1%" --app=http://localhost:4000
) else if exist "%EDGE2%" (
  start "" "%EDGE2%" --app=http://localhost:4000
) else if exist "%CHROME1%" (
  start "" "%CHROME1%" --app=http://localhost:4000
) else if exist "%CHROME2%" (
  start "" "%CHROME2%" --app=http://localhost:4000
) else (
  REM Neither Edge nor Chrome found in the usual place - fall back to
  REM whatever the default browser is, as a normal tab.
  start "" http://localhost:4000
)
