@echo off
git commit -m "Add architectural components and GitHub Actions"
if %errorlevel% equ 0 (
    echo Commit successful!
    git push origin main
) else (
    echo Commit failed!
)
pause
