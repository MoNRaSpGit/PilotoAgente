# Gastos Module Guide

## Purpose
This module manages operating and home expenses, summary totals, and active/inactive expense maintenance.

## Current Architecture
- `GastosPage.jsx`: composition layer only.
- `useGastosPageController.js`: business orchestration for loading, editing, and persistence flow.
- `components/`: presentational UI blocks with props-only contracts.
- `gastosPage.utils.js`: formatting, parsing, and default state helpers.

## File Map
- `src/pages/GastosPage.jsx`
- `src/pages/gastos/useGastosPageController.js`
- `src/pages/gastos/gastosPage.utils.js`
- `src/pages/gastos/components/GastosHero.jsx`
- `src/pages/gastos/components/GastosSummaryGrid.jsx`
- `src/pages/gastos/components/GastosFormPanel.jsx`
- `src/pages/gastos/components/GastosTablesPanel.jsx`

## Where To Change What
- Visual/layout only: edit `components/`.
- Async/business flow and validations: edit `useGastosPageController.js`.
- Formatting and input normalization: edit `gastosPage.utils.js`.

## PR Checklist (Gastos)
- Keep `GastosPage.jsx` composition-only.
- Add/update hook tests when flow/state changes.
- Add/update component tests when behavior changes.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Gastos refactor is isolated in incremental commits. Prefer `git revert <commit>` for safe rollback.
