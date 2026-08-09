@echo off
REM 本地网站内容后台启动脚本（Windows 双击即可）
cd /d "%~dp0\.."
where node >nul 2>nul
if %errorlevel%==0 (
  node admin/server.js
) else (
  "C:\Users\ASUS\.workbuddy\binaries\node\versions\22.22.2\node.exe" admin/server.js
)
pause
