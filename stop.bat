@echo off
echo Stopping Proxy-Lite server on port 5389...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5389') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo Proxy-Lite server has been stopped.
pause
