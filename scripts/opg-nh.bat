@echo off
rem opg-nh:// protocol handler (registered via `npm run nh-install`).
rem Launches the import service in a minimized window; if already running the
rem new instance exits silently (port in use). Closing this window stops the service.
cd /d "%~dp0.."
start "" /min cmd /c "node scripts\nh-import.mjs --serve"
