@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo PC Studio - Local address http://127.0.0.1:8765
echo.
start "" "http://127.0.0.1:8765"
node backend\server.js
if errorlevel 1 pause
