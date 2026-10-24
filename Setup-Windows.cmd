@echo off
chcp 65001 >nul
setlocal
set "FLB_NODE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined FLB_NODE set "FLB_NODE=%%N"
if not defined FLB_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "FLB_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined FLB_NODE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "FLB_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined FLB_NODE (
 echo Install Node.js 24 LTS from https://nodejs.org/ and run this file again.
 pause
 exit /b 1
)
"%FLB_NODE%" "%~dp0scripts\setup.mjs" %*
if errorlevel 1 (
 echo Setup did not complete. Review the message above.
 pause
 exit /b 1
)
echo Open START-HERE.html for the remaining browser steps.
pause
