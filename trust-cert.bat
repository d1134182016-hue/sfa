@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 信任百花王學園本機憑證
if not exist "%~dp0certs\localhost.cer" (
  echo 尚未產生憑證。請先執行一次 start.bat，再回來執行本檔案。
  pause
  exit /b 1
)
echo 將憑證加入「目前使用者」的信任根目錄（不需要系統管理員）...
certutil -addstore -user Root "%~dp0certs\localhost.cer"
if errorlevel 1 (
  echo.
  echo 加入失敗。你可以直接開遊戲，在瀏覽器警告頁按「進階」→「繼續前往」。
) else (
  echo.
  echo 完成。請完全關閉瀏覽器再重新開啟，網址列就會顯示安全鎖頭。
)
pause
