@echo off
cd "c:\Users\valter.valido\OneDrive - Avanade\Documents 1\VSCode\Estudo"
echo === Verificando configuracao do Git ===
echo.
echo --- Configuracao global ---
git config --global user.name
git config --global user.email
echo.
echo --- Configuracao local ---
git config --local user.name
git config --local user.email
echo.
echo --- Status do repositorio ---
git status
echo.
echo --- Remote configurado ---
git remote -v
echo.
echo --- Ultimos commits ---
git log --oneline -3
echo.
echo --- Configurando usuario local se necessario ---
git config --local user.name "valtervds"
git config --local user.email "valter.valido@avanade.com"
echo.
echo --- Verificando novamente ---
git config --local user.name
git config --local user.email
echo.
echo === Testando conectividade ===
ping github.com -n 2
echo.
pause
