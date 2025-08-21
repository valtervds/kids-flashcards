#!/bin/bash
# Script simples para verificar Git
echo "=== STATUS DO REPOSITORIO ==="
git status

echo -e "\n=== ULTIMOS COMMITS ==="
git log --oneline -3

echo -e "\n=== CONFIGURACAO GIT ==="
git config --list | grep user

echo -e "\n=== BRANCH ATUAL ==="
git branch

echo -e "\n=== REMOTE ==="
git remote -v
