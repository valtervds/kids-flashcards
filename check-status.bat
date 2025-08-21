@echo off
echo Verificando status do repositorio...
git status
echo.
echo Ultimos commits:
git log --oneline -3
echo.
echo Configuracao do usuario Git:
git config user.name
git config user.email
echo.
echo Verificando branch atual:
git branch
echo.
echo Verificando remote:
git remote -v
