@echo off
chcp 65001 >nul
cls

echo ═══════════════════════════════════════════════
echo    THERMAL PRINTER BRIDGE SERVER
echo ═══════════════════════════════════════════════
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js chưa được cài đặt!
    echo.
    echo 📥 Tải Node.js tại: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js: 
node --version
echo.

:: Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 Đang cài đặt dependencies...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ❌ Cài đặt thất bại!
        pause
        exit /b 1
    )
    echo.
    echo ✅ Cài đặt hoàn tất!
    echo.
)

:: Check if server.js exists
if not exist "server.js" (
    echo ❌ Không tìm thấy file server.js!
    echo.
    pause
    exit /b 1
)

echo 🚀 Đang khởi động server...
echo.
echo 💡 Mở printer-config.html để sử dụng
echo.
echo ⚠️  Nhấn Ctrl+C để dừng server
echo.
echo ═══════════════════════════════════════════════
echo.

:: Start server
node server.js

pause