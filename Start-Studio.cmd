@echo off
setlocal
cd /d "%~dp0"
set "STUDIO_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "STUDIO_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node.exe"
  if not exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node.exe" (
    echo Node.js 24 or newer is required. See README.md.
    pause
    exit /b 1
  )
)
"%STUDIO_NODE%" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
  echo Node.js 24 or newer is required. See README.md.
  pause
  exit /b 1
)
if not exist "dist\client\index.html" (
  echo Build the application first: npm ci ^&^& npm run build
  pause
  exit /b 1
)
echo Drama Studio - local creator workspace
echo Open http://localhost:4173/?view=app
echo Keep this window open. Press Ctrl+C to stop the service.
"%STUDIO_NODE%" server\index.mjs --production --host 127.0.0.1 --port 4173
if errorlevel 1 pause
