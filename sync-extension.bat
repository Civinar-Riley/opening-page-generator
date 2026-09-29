@echo off
rem 双击入口：先把自己复制到 %TEMP% 再执行副本——分支切换会重写本文件，
rem cmd 对批处理是增量读取，文件被 git 换掉会中断（"The batch file cannot be found"）。
if "%~1"=="run" goto body
setlocal
copy /y "%~f0" "%TEMP%\opg-sync-ext.bat" >nul
rem %~dp0 尾部反斜杠会转义收尾引号（cmd 经典坑），剥掉再传
set "REPO=%~dp0"
if "%REPO:~-1%"=="\" set "REPO=%REPO:~0,-1%"
cmd /c "%TEMP%\opg-sync-ext.bat" run "%REPO%"
echo.
pause
exit /b 0

:body
rem %~2 = 仓库目录（由入口传入；从 %TEMP% 运行不能再用 %~dp0 定位）
chcp 65001 >nul
cd /d "%~2"

echo ============================================
echo   开场页工坊 · extension 分支手动同步工具
echo   流程：检查工作区 → merge main → 重建 tool.html
echo         → lint / 测试 → 提交推送 origin/extension
echo ============================================
echo.

rem [0] 必须在仓库内，且工作区干净（未提交/未跟踪文件会混进同步提交）
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ✗ 错误：当前目录不是 git 仓库。
  exit /b 1
)
git status --porcelain | findstr /r /c:"." >nul
if not errorlevel 1 (
  echo ✗ 错误：工作区有未提交或未跟踪的文件，请先处理干净再同步：
  git status --short
  exit /b 1
)

for /f %%b in ('git branch --show-current') do set "ORIG=%%b"
if "%ORIG%"=="" set "ORIG=main"
for /f %%h in ('git rev-parse --short main') do set "SHORT=%%h"

echo [1/6] 切换到 extension 分支（当前分支 %ORIG%，将同步 main@%SHORT%）...
git checkout extension
if errorlevel 1 exit /b 1

echo.
echo [2/6] 合并 main...
git merge main --no-edit
if errorlevel 1 (
  echo ✗ 合并冲突：已中止合并并切回 %ORIG%。
  git merge --abort
  git checkout %ORIG%
  exit /b 1
)

echo.
echo [3/6] 重建扩展产物 tool.html（merge 后必须重建，防止分支上代码新、产物旧）...
call npm run build:ext
if errorlevel 1 goto fail_on_ext

echo.
echo [4/6] lint 与测试（不过不推送）...
call npm run lint
if errorlevel 1 goto fail_on_ext
call npm test
if errorlevel 1 goto fail_on_ext

echo.
echo [5/6] 提交产物改动并推送 origin/extension...
git add -A
git diff --cached --quiet
if not errorlevel 1 git commit -m "chore: 重建 tool.html（同步 main@%SHORT%）"
git push origin extension
if errorlevel 1 goto fail_on_ext
echo ✓ 已推送（若上方显示 Everything up-to-date 表示远端本就最新）。

echo.
echo [6/6] 切回 %ORIG%...
git checkout %ORIG%
echo.
echo ✓ 同步完成。已安装扩展的用户在扩展管理器点「Update」即可拿到新版。
exit /b 0

:fail_on_ext
echo.
echo ✗ 同步失败：请查看上方报错。当前停在 extension 分支，
echo   修复后可重跑本脚本；或执行 git checkout %ORIG% 先回原分支处理。
exit /b 1
