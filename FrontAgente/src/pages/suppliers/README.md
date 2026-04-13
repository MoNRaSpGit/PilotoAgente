# Suppliers Module Guide

## Purpose
This module powers supplier weekly operations: weekly movement view and detail workflow to build/confirm supplier orders from low-stock products.

## Current Architecture
- `SuppliersPage.jsx`: page composition layer only. It wires controller state/actions to presentational components.
- `useSuppliersPageController.js`: business orchestration for weekly supplier state, alerts, and confirm workflow.
- `components/`: presentational UI blocks with props-only contracts.
- `suppliersPage.utils.js`: shared defaults and helper utilities (date/day normalization and formatting).

## File Map
- `src/pages/SuppliersPage.jsx`
- `src/pages/suppliers/useSuppliersPageController.js`
- `src/pages/suppliers/suppliersPage.utils.js`
- `src/pages/suppliers/components/SuppliersHeader.jsx`
- `src/pages/suppliers/components/SuppliersWeekMovementPanel.jsx`

## Where To Change What
- Update visuals/layout only: edit files in `components/`.
- Update supplier flow, async behavior, validations, or orchestration: edit `useSuppliersPageController.js`.
- Update helper logic (date/day normalization or formatting): edit `suppliersPage.utils.js`.

## Core Flows
- Initial load: fetches suppliers, agenda, and recent orders in parallel.
- Simulated date navigation: moves selected day and reloads data.
- Day movement schedule: resolves which suppliers pickup or deliver by selected day.
- Supplier detail: click supplier/day to view current confirmed order and low-stock product list.
- Confirm order: saves provider order and updates right panel immediately.

## Test Coverage
- `src/tests/SuppliersPage.test.jsx`: page-level wiring.
- `src/tests/SuppliersComponents.test.jsx`: presentational component behavior.
- `src/tests/useSuppliersPageController.test.jsx`: controller behavior (initial load, schedule derivation, and confirm flow).

Run tests:
```bash
npm run test -- --run
```

## PR Checklist (Suppliers)
- Keep `SuppliersPage.jsx` composition-only.
- Add or update hook tests when flow/state logic changes.
- Add or update component tests when render/interaction behavior changes.
- Validate day navigation and supplier confirm path.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Suppliers refactor was split into incremental commits. Prefer `git revert <commit>` for safe rollback in shared branches.
