@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node.js 22.13 or newer, then try again.
  pause
  exit /b 1
)
if not exist .env (
  echo First run: creating local admin credentials...
  call npm run setup
  if errorlevel 1 (
    pause
    exit /b 1
  )
  echo IMPORTANT: Copy the admin password shown above and keep it safe.
  pause
)
echo Opening demo server at http://localhost:3000 ...
call npm start
pause
