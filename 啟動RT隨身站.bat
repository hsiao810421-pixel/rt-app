@echo off
chcp 65001 >nul
title 中榮 RT 隨身站 - 本機預覽
cd /d "%~dp0"
echo ============================================
echo   中榮 RT 隨身站 - 本機預覽伺服器
echo ============================================
echo.
echo 正在啟動... 瀏覽器會自動開啟 http://localhost:8123
echo 關掉這個黑色視窗即可停止伺服器。
echo.
start "" "http://localhost:8123"
python -m http.server 8123
