@echo off
echo ===========================================
echo   TIDOL - RESET NUCLEAR DE LETRAS (FORCE)
echo ===========================================
echo ADVERTENCIA: Esto borrara todos los archivos .lrc fisico y marcas de DB.
pause
cd /d "%~dp0\backend"
node force_cleanup_lyrics.js
pause
