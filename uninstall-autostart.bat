@echo off
echo Menghapus Proxy-Lite dari Windows Startup...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if exist "%STARTUP_FOLDER%\Proxy-Lite.lnk" (
    del "%STARTUP_FOLDER%\Proxy-Lite.lnk"
    echo [SUKSES] Shortcut autostart berhasil dihapus.
) else (
    echo Shortcut autostart tidak ditemukan.
)
pause
