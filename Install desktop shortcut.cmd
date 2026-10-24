@echo off
rem Installs Survey Compare on this PC and puts a shortcut on the desktop. No admin needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-shortcut.ps1"
echo.
pause
