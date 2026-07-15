@echo off
setlocal EnableExtensions EnableDelayedExpansion
pushd "%~dp0" >nul
title Tafaron

set "REQUIRED_NODE_MAJOR=24"
call :detect_node
if defined NODE_MAJOR if !NODE_MAJOR! GEQ %REQUIRED_NODE_MAJOR% goto :node_ready

echo Node.js 24 LTS est absent ou trop ancien.
echo Installation automatique avec winget...
where winget >nul 2>nul
if errorlevel 1 goto :no_winget

winget install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements --force --disable-interactivity
if errorlevel 1 goto :node_error

set "PATH=%ProgramFiles%\nodejs;!PATH!"
call :detect_node
if not defined NODE_MAJOR goto :node_error
if !NODE_MAJOR! LSS %REQUIRED_NODE_MAJOR% goto :node_error

:node_ready
echo Node.js detecte :
node --version
echo npm detecte :
call npm --version

set "DID_INSTALL=0"
if not exist node_modules (
  echo Installation des dependances...
  call npm ci
  if errorlevel 1 goto :error
  set "DID_INSTALL=1"
)

if not exist node_modules\@esbuild\win32-x64 (
  echo Adaptation des dependances a Windows...
  call npm ci
  if errorlevel 1 goto :error
  set "DID_INSTALL=1"
)

if !DID_INSTALL! EQU 1 goto :compile
if not exist dist\client\index.html goto :compile
call node scripts\build-state.mjs check
if errorlevel 2 goto :compile
if errorlevel 1 goto :error
goto :start

:compile
  echo Compilation de Tafaron...
  call npm run build
  if errorlevel 1 goto :error
  call node scripts\build-state.mjs mark
  if errorlevel 1 goto :error

:start
echo.
echo Tafaron demarre sur http://localhost:3000/admin
echo Gardez cette fenetre ouverte pendant la partie.
echo Pour arreter : Ctrl+C
start "" http://localhost:3000/admin
call npm start
exit /b %errorlevel%

:detect_node
set "NODE_MAJOR="
where node >nul 2>nul
if not errorlevel 1 for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%v"
exit /b 0

:no_winget
echo.
echo winget est introuvable. Installez Node.js 24 LTS depuis https://nodejs.org/
pause
exit /b 1

:node_error
echo.
echo L'installation automatique de Node.js 24 LTS a echoue.
echo Acceptez la demande administrateur ou installez Node depuis https://nodejs.org/
pause
exit /b 1

:error
echo.
echo La preparation de Tafaron a echoue. Consultez les messages ci-dessus.
pause
exit /b 1
