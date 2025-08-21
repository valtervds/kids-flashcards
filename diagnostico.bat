@echo off
setlocal
cd /d "c:\Users\valter.valido\OneDrive - Avanade\Documents 1\VSCode\Estudo"

echo =====================================================
echo DIAGNOSTICO COMPLETO DO GITHUB PAGES
echo =====================================================
echo.

echo 1. Verificando se estamos no repositorio correto:
echo %CD%
echo.

echo 2. Status do repositorio Git:
git status
echo.

echo 3. Ultimos commits:
git log --oneline -5
echo.

echo 4. Configuracao do usuario:
git config user.name
git config user.email
echo.

echo 5. Remote configurado:
git remote -v
echo.

echo 6. Branch atual:
git branch
echo.

echo 7. Verificando se existe .github/workflows/:
dir .github\workflows\
echo.

echo 8. Fazendo push forcado se necessario:
git add .
git commit -m "Force deploy to GitHub Pages"
git push origin main --force
echo.

echo 9. Status final:
git status
echo.

echo =====================================================
echo DIAGNOSTICO COMPLETO - Verifique GitHub Actions em:
echo https://github.com/valtervds/kids-flashcards/actions
echo =====================================================

pause
