@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 百花王學園 · 狂賭之淵
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
