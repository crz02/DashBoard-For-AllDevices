@echo off
:: Check for administrative permissions
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Administrator privileges required.
    echo Please right-click this file and select 'Run as administrator'.
    echo.
    pause
    exit /b 1
)

echo ======================================================
echo    Statuser - Install Trusted Certificate
echo ======================================================
echo.
echo Adding Statuser certificate to Windows Trusted Root store...

certutil -addstore -f "Root" "%~dp0Statuser.cer"

if %errorLevel% equ 0 (
    echo.
    echo [SUCCESS] Statuser certificate installed!
    echo SmartScreen and Unknown Publisher warnings are now disabled for Statuser.
    echo You can now install and run Statuser freely.
) else (
    echo.
    echo [ERROR] Failed to install certificate. Error code: %errorLevel%
)

echo.
pause
