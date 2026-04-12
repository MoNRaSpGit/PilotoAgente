# Dashboard Module Guide

## Purpose
This module keeps the dashboard scaffold ready for future implementation while remaining hidden from the navbar.

## Current Architecture
- `DashboardPage.jsx`: page composition layer only.
- `useDashboardPageController.js`: controller layer for page state contracts.
- `components/`: presentational UI blocks with props-only contracts.
- `dashboardPage.utils.js`: copy/constants for placeholder state.

## File Map
- `src/pages/DashboardPage.jsx`
- `src/pages/dashboard/useDashboardPageController.js`
- `src/pages/dashboard/dashboardPage.utils.js`
- `src/pages/dashboard/components/DashboardPlaceholderPanel.jsx`

## Visibility Strategy
- Route `/dashboard` is still available and protected by role gate.
- Navbar link visibility is controlled by `VITE_FEATURE_DASHBOARD`.
- Route access is also controlled by `VITE_FEATURE_DASHBOARD`.
- This allows future activation without rebuilding structure.

## PR Checklist (Dashboard)
- Keep `DashboardPage.jsx` composition-only.
- Put new async/business logic in `useDashboardPageController.js`.
- Keep display-only changes in `components/`.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Dashboard prep is isolated in incremental commits. Prefer `git revert <commit>` for safe rollback.
