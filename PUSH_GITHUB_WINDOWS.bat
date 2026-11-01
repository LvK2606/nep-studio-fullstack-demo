@echo off
setlocal
cd /d "%~dp0"
echo.
echo === NEP Studio - Push to GitHub ===
echo.
where git >nul 2>&1
if errorlevel 1 (
  echo Git is missing. Install Git for Windows: https://git-scm.com/downloads/win
  pause
  exit /b 1
)
set /p REPO_URL=Paste your new empty GitHub repository HTTPS URL: 
if "%REPO_URL%"=="" (
  echo Missing GitHub repository URL.
  pause
  exit /b 1
)
if not exist ".git" git init
if errorlevel 1 goto failed
git branch -M main
if errorlevel 1 goto failed
git add .
if errorlevel 1 goto failed
echo.
echo Please check staged files. Secrets and database must not appear:
git status --short
echo.
set /p CONFIRM=If safe, type YES to continue: 
if /I not "%CONFIRM%"=="YES" exit /b 1
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Initial commit: NEP Studio full-stack booking demo"
  if errorlevel 1 goto failed
)
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  echo.
  echo Existing remote URL:
  git remote get-url origin
  echo Make sure this is your intended repository before continuing.
)
if errorlevel 1 goto failed
git push -u origin main
if errorlevel 1 goto failed
echo.
echo Push completed. Visit your GitHub repository to verify.
pause
exit /b 0
:failed
echo.
echo Failed. Read HUONG_DAN_DUA_LEN_GITHUB.md for instructions.
pause
exit /b 1
