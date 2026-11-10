@echo off
rem Double-click to update the product photo list after adding photos to assets\products\
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  python update-photos.py
) else (
  py update-photos.py
)
echo.
pause
