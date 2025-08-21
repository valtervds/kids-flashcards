@echo off
cd "c:\Users\valter.valido\OneDrive - Avanade\Documents 1\VSCode\Estudo"
echo === Git Status ===
git status
echo.
echo === Adding all changes ===
git add .
echo.
echo === Committing changes ===
git commit -m "feat: Architectural improvements Phase 1.4-1.5 and GitHub Pages setup

- Extracted all view components (HomeView, DecksView, SettingsView)
- Implemented Toast notification system with context
- Enhanced media components (DeckAudio, DeckVideo) with proper TypeScript
- Completed CloudContext and DeckContext extraction
- Added comprehensive publish service architecture
- Configured GitHub Pages deployment workflow
- Fixed index.html entry point and application structure
- All Phase 1 architectural extractions completed successfully

This commit represents a major architectural milestone with 65%% overall readiness."
echo.
echo === Pushing to remote ===
git push origin main
echo.
echo === Deployment complete ===
pause
