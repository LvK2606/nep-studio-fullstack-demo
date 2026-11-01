@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
set "REPO_URL=https://github.com/LvK2606/nep-studio-fullstack-demo.git"
set "WORKDIR=%TEMP%\nep-studio-upload-%RANDOM%-%RANDOM%"
echo.
echo ==========================================================
echo   NEP STUDIO - Day ma nguon len GitHub

echo   Repo: %REPO_URL%
echo ==========================================================
echo.
where git >nul 2>&1
if errorlevel 1 (
  echo LOI: May chua cai Git for Windows.
  echo Cai tai https://git-scm.com/downloads/win
  pause
  exit /b 1
)
if not exist "package.json" (
  echo LOI: Khong tim thay package.json. Hay giai nen day du file ZIP.
  pause
  exit /b 1
)
echo [1/4] Clone repository hien tai de GIU NGUYEN lich su commit...
git clone --branch main "%REPO_URL%" "%WORKDIR%"
if errorlevel 1 goto error

echo [2/4] Sao chep ma nguon, bo qua file bi mat va du lieu local...
robocopy "%~dp0" "%WORKDIR%" /E /NFL /NDL /NJH /NJS /NP /XD .git node_modules coverage dist build data /XF .env .env.local .env.production .env.development *.sqlite *.sqlite-* *.db *.db-* *.pem *.key
if errorlevel 8 goto error
if not exist "%WORKDIR%\data" mkdir "%WORKDIR%\data"
type nul > "%WORKDIR%\data\.gitkeep"

cd /d "%WORKDIR%"
git add -A
if errorlevel 1 goto error
echo.
echo [3/4] Kiem tra danh sach file sap dua len GitHub:
git status --short
echo.
echo LUU Y: .env, database, mat khau, va token TUYET DOI khong duoc push.
echo Hay kiem tra danh sach tren. Neu co thong tin rieng tu, bam Ctrl+C de dung.
set /p "CONFIRM=Nhap YES de dong y push: "
if /I not "%CONFIRM%"=="YES" (
  echo Da huy. Chua push.
  pause
  exit /b 1
)
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "feat: add complete NEP Studio full-stack booking demo"
  if errorlevel 1 goto error
) else (
  echo Khong co file moi can commit.
)
echo [4/4] Dang push len GitHub...
git push origin main
if errorlevel 1 goto error

echo.
echo THANH CONG. Kiem tra:
echo https://github.com/LvK2606/nep-studio-fullstack-demo
pause
exit /b 0
:error
echo.
echo LOI: Khong the hoan tat. Repo tren GitHub chua duoc dong bo day du.
echo Xem thong bao phia tren va file HUONG_DAN_DUA_LEN_GITHUB.md.
pause
exit /b 1
