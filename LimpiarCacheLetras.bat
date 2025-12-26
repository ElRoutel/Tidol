@echo off
echo ===========================================
echo   TIDOL - LIMPIEZA DE CACHE DE LETRAS
echo ===========================================
cd /d "%~dp0\backend"
node cleanup_lyrics.js
pause
