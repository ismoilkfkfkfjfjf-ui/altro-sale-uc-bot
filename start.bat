@echo off
title ALTRO SALE UC BOT Server ^& Bot (24/7 Rejim)
chcp 65001 >nul
cls

echo ==============================================
echo        ALTRO SALE UC BOT — 24/7 SERVER ^& BOT
echo ==============================================
echo.
echo Server va Telegram Bot ishga tushirilmoqda...
echo Brauzerda ochish: http://localhost:3000
echo Admin panel: http://localhost:3000/admin.html?admin_id=7081580477
echo.

:loop_start
echo [24/7] Server ishga tushirilmoqda (%time%)...
node server.js

echo.
echo [OGOHLANTIRISH] Jarayon to'xtadi! 3 soniyada qayta ishga tushadi...
timeout /t 3 /nobreak >nul
goto loop_start
