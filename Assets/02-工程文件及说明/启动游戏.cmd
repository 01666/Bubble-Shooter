@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0game\tools\start.ps1"
if errorlevel 1 pause
