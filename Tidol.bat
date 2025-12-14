@echo off
title Tidol Launcher
echo ==========================================
echo 🚀 Iniciando Ecosistema Tidol
echo ==========================================

:: 1. Iniciar Granja WARP (Docker)
echo.
echo  [1/4] Arrancando Granja de Proxies WARP...
cd backend\warp-farm
docker-compose up -d
cd ..\..
echo  Proxies iniciados.

:: 2. Iniciar Backend (Tidol)
echo.
echo  [2/4] Iniciando Backend (Puerto 3000)...
start "Tidol Backend" cmd /k "cd backend && node server.js"

:: 3. Iniciar Spectra (AI Engine)
echo.
echo  [3/4] Iniciando Spectra Engine (Puerto 3001)...
start "Spectra Engine" cmd /k "cd tidol-spectra && node server.js"

:: 4. Cloudflare Tunnel
echo.
echo  [4/4] Exponiendo Tidol a Internet (Cloudflare)...
echo    Generando URL publica para http://localhost:3000...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:3000"

echo.
echo  Todos los servicios han sido lanzados.
echo    - Backend: http://localhost:3000
echo    - Spectra: http://localhost:3001
echo    - Tunnel: Revisa la ventana de Cloudflare para la URL.
echo.
pause
