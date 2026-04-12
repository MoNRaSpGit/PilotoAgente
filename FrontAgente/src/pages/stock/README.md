# Stock Module Guide

## Purpose
This module powers stock control operations: dashboard alerts, expected arrivals, control setup, and stock entry registration.

## Current Architecture
- `StockPage.jsx`: page composition layer only. It wires controller state/actions to presentational components.
- `useStockPageController.js`: business orchestration for stock state, async calls, validation, and form workflows.
- `components/`: presentational UI blocks with props-only contracts.
- `stockPage.utils.js`: defaults and helper utilities used by the controller and UI.

## File Map
- `src/pages/StockPage.jsx`
- `src/pages/stock/useStockPageController.js`
- `src/pages/stock/stockPage.utils.js`
- `src/pages/stock/components/StockHeader.jsx`
- `src/pages/stock/components/StockAlertsPanel.jsx`
- `src/pages/stock/components/StockExpectedPanel.jsx`
- `src/pages/stock/components/StockControlForm.jsx`
- `src/pages/stock/components/StockEntryForm.jsx`

## Where To Change What
- Update visuals/layout only: edit files in `components/`.
- Update stock flow, async behavior, validations, or form orchestration: edit `useStockPageController.js`.
- Update defaults/normalization/helper behavior: edit `stockPage.utils.js`.

## Core Flows
- Initial load: fetches dashboard and controls in parallel.
- Product search: debounced search for control configuration.
- Save control: validates selected product and persists control settings.
- Register entry: validates quantity and controlled item, then registers stock movement.

## Test Coverage
- `src/tests/StockPage.test.jsx`: page-level wiring and key submit actions.
- `src/tests/StockComponents.test.jsx`: presentational component behavior.
- `src/tests/useStockPageController.test.jsx`: controller behavior (initial load, validations, success paths, product search debounce).

Run tests:
```bash
npm run test -- --run
```

## PR Checklist (Stock)
- Keep `StockPage.jsx` composition-only.
- Add or update hook tests when flow/state logic changes.
- Add or update component tests when render/interaction behavior changes.
- Validate control save and stock entry paths.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Stock refactor was split into incremental commits. Prefer `git revert <commit>` for safe rollback in shared branches.
