# Caja Module Guide

## Purpose
This module powers the admin cashbox screen: daily summary, live scanner mirror, movements, ranking, payments, and open/close operations.

## Current Architecture
- `CajaPage.jsx`: page composition layer only. It wires the controller state/actions to presentational components.
- `useCajaPageController.js`: business orchestration for Caja page state, API calls, session expiration handling, and realtime stream sync.
- `components/`: presentational UI blocks with props-only contracts.
- `cajaPage.utils.js`: formatting and normalization helpers.
- `cajaPage.state.js`: state-related helper factories and mode/limit resolvers.
- `cajaText.constants.js`: shared user-facing labels and toast messages.

## File Map
- `src/pages/CajaPage.jsx`
- `src/pages/caja/useCajaPageController.js`
- `src/pages/caja/components/CajaHero.jsx`
- `src/pages/caja/components/CajaSummaryGrid.jsx`
- `src/pages/caja/components/CajaLivePanel.jsx`
- `src/pages/caja/components/CajaMovementsPanel.jsx`
- `src/pages/caja/components/CajaRankingPanel.jsx`
- `src/pages/caja/components/CajaPaymentPanel.jsx`
- `src/pages/caja/components/CajaModals.jsx`
- `src/pages/caja/cajaPage.utils.js`
- `src/pages/caja/cajaPage.state.js`
- `src/pages/caja/cajaText.constants.js`

## Where To Change What
- Update visuals/layout only: edit files in `components/`.
- Add/modify UI text labels: edit `cajaText.constants.js`.
- Change data flow, async behavior, session handling, or realtime logic: edit `useCajaPageController.js`.
- Change formatting/parsing/normalization behavior: edit `cajaPage.utils.js`.
- Change mode limits and scanner state factories: edit `cajaPage.state.js`.

## Realtime Notes
- Stream uses `EventSource` with `/api/caja/stream`.
- `scanner:state` updates scanner mirror state directly.
- `sale` triggers refresh for movements/ranking and forces dashboard refresh.
- Always preserve cleanup (`removeEventListener` and `close`) on unmount.

## Test Coverage
- `src/tests/CajaPage.test.jsx`: page-level wiring and key user actions.
- `src/tests/useCajaPageController.test.jsx`: hook behavior (initial load, 401 flow, open/close, realtime stream).
- `src/tests/CajaComponents.test.jsx`: presentational component behavior.

Run tests:
```bash
npm run test -- --run
```

## PR Checklist (Caja)
- Keep `CajaPage.jsx` as composition-only (avoid reintroducing business logic there).
- Add or update tests when controller logic changes.
- Add or update component tests when presentational behavior changes.
- Confirm realtime behavior still works for `scanner:state` and `sale` events.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Caja refactor was split into incremental commits. Prefer `git revert <commit>` for safe rollback in shared branches.
