@echo off
setlocal
cd /d "%~dp0"
echo ArchyAfk gelistirme modu baslatiliyor...
call npm.cmd install
if errorlevel 1 goto error
call npm.cmd run dev
if errorlevel 1 goto error
exit /b 0

:error
echo.
echo ArchyAfk dev baslatma islemi basarisiz oldu. Hata kodu: %errorlevel%
pause
exit /b %errorlevel%
