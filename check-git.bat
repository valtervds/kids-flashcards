@echo off
cd "c:\Users\valter.valido\OneDrive - Avanade\Documents 1\VSCode\Estudo"
echo === Git Status ===
git status
echo.
echo === Git Log (Last 3) ===
git log --oneline -3
echo.
echo === Git Remote ===
git remote -v
echo.
echo === Checking network ===
ping github.com -n 2
echo.
echo === Force Push ===
git push origin main --force-with-lease
pause
