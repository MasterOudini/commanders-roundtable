@echo off
REM Launches Commander's Roundtable in DEV mode so the desktop shortcut always
REM runs the latest code (workspace policy — never point a shortcut at the
REM packaged exe in release/, it goes stale).
REM
REM Points at scripts/dev-launcher.cjs, NOT `npm run electron:dev`: see the
REM comment at the top of that file for why concurrently -k kills Electron when
REM an orphaned vite already holds the port.
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
node "%~dp0scripts\dev-launcher.cjs"
