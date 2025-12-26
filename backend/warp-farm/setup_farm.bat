@echo off
setlocal
title Tidol Warp Farm Setup

echo ==========================================
echo 🏭 Configurador de Granja WARP
echo ==========================================
echo.
echo Este script configurara los proxies para Tidol.
echo Se recomienda usar entre 7 y 10 para empezar.
echo.

set /p count="¿Cuantos proxies quieres generar? (Default 10): "
if "%count%"=="" set count=10

echo.
echo Generando configuraciones para %count% nodos...
node generate_farm.cjs %count%

if %errorlevel% neq 0 (
    echo.
    echo [!] Hubo un error al generar la granja.
    pause
    exit /b %errorlevel%
)

echo.
echo ==========================================
echo ✅ Granja lista.
echo ¿Deseas iniciar los contenedores ahora? (s/n)
set /p start="> "

if /i "%start%"=="s" (
    echo Iniciando contenedores...
    docker-compose up -d
    echo.
    echo [INFO] Granja iniciada. Puertos: 8881 en adelante.
) else (
    echo [INFO] Puedes iniciarlos mas tarde con 'docker-compose up -d'
)

echo.
pause
