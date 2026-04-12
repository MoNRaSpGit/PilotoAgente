# Login Module Guide

## Purpose
This module handles authentication entry flow, hidden panel unlock, and quick-login shortcuts.

## Current Architecture
- `LoginPage.jsx`: composition layer only.
- `useLoginPageController.js`: login business orchestration and panel unlock flow.
- `components/`: presentational UI blocks with props-only contracts.
- `loginPage.constants.js`: quick-login credentials and role normalization helper.

## File Map
- `src/pages/LoginPage.jsx`
- `src/pages/login/useLoginPageController.js`
- `src/pages/login/loginPage.constants.js`
- `src/pages/login/components/LoginPanel.jsx`

## Where To Change What
- Visual/layout only: edit `components/`.
- Auth behavior and side effects: edit `useLoginPageController.js`.
- Quick-login defaults and role normalization helper: edit `loginPage.constants.js`.

## PR Checklist (Login)
- Keep `LoginPage.jsx` composition-only.
- Validate normal login and quick-login for admin/operario.
- Validate panel unlock still requires 7 logo taps.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Login refactor is isolated in incremental commits. Prefer `git revert <commit>` for safe rollback.
