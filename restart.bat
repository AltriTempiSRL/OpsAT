@echo off
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
cd /d "%~dp0"
start "" cmd /k "node proxy.js"
