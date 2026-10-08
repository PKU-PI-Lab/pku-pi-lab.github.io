@echo off
setlocal

set "ADMIN_DIR=%~dp0"
set "SITE_DIR=%ADMIN_DIR%.."

pushd "%SITE_DIR%" >nul 2>&1
if errorlevel 1 (
  echo ERROR: cannot enter site directory: %SITE_DIR%
  pause
  exit /b 1
)

set "NODE_CMD="
where node >nul 2>nul && set "NODE_CMD=node"

if not defined NODE_CMD (
  if exist "C:\Users\ASUS\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" (
    set "NODE_CMD=C:\Users\ASUS\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"
  )
)

if not defined NODE_CMD (
  echo ERROR: Node.js not found. Please install Node.js LTS from https://nodejs.org/
  echo Then run this script again.
  start https://nodejs.org/
  pause
  exit /b 1
)

echo Starting local site admin backend...
echo Open your browser at:  http://localhost:8080/admin
"%NODE_CMD%" "%ADMIN_DIR%server.js"

popd
pause
