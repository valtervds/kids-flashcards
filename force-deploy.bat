@echo off
echo Forcando commit e push...
git add .
git commit -m "Deploy React app to GitHub Pages"
git push origin main
echo.
echo Verificando se foi enviado:
git log --oneline -2
echo.
echo Status final:
git status
