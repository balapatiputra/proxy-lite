@echo off
echo Mengaktifkan Proxy-Lite agar otomatis menyala saat Windows booting...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET_VBS=%~dp0start-background.vbs"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_FOLDER%\Proxy-Lite.lnk'); $s.TargetPath = '%TARGET_VBS%'; $s.WorkingDirectory = '%~dp0'; $s.Save()"

if exist "%STARTUP_FOLDER%\Proxy-Lite.lnk" (
    echo [SUKSES] Shortcut autostart berhasil dipasang di Windows Startup!
    echo Proxy-Lite akan otomatis berjalan di background setiap kali Windows menyala.
) else (
    echo [GAGAL] Tidak dapat membuat shortcut.
)
pause
