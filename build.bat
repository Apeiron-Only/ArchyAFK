@echo off
setlocal
cd /d "%~dp0"
echo ArchyAfk production build baslatiliyor...
call npm.cmd install
if errorlevel 1 goto error
call npm.cmd run typecheck
if errorlevel 1 goto error
call npm.cmd run lint
if errorlevel 1 goto error
call npm.cmd run build
if errorlevel 1 goto error
echo.
echo Build tamamlandi. Cikti klasoru: "%~dp0dist"
pause
exit /b 0

:error
echo.
echo ArchyAfk build islemi basarisiz oldu. Hata kodu: %errorlevel%
pause
exit /b %errorlevel%
