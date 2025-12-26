@echo off
title Tidol Warp Farm Cleaner

echo [!] ADVERTENCIA: Se detendran todos los proxies y se borraran sus carpetas de configuracion.
echo Esto requerira registrar nuevas cuentas si decides volver a generarlos.
echo.
set /p confirm="¿Estas seguro? (s/n): "

if /i "%confirm%"=="s" (
    echo Deteniendo contenedores...
    docker-compose down
    
    echo Limpiando carpetas node_* ...
    for /d %%i in (node_*) do (
        echo Borrando %%i...
        rmdir /s /q "%%i"
    )
    
    if exist docker-compose.yml (
        echo Borrando docker-compose.yml...
        del docker-compose.yml
    )
    
    echo.
    echo ✅ Granja limpiada correctamente.
) else (
    echo Cancelado.
)

pause
