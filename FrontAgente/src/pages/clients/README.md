# Clients Module Guide

## Purpose
This module handles customer debt flow: create customer, view due status, register deliveries, register payment, and browse movement history.

## Current Architecture
- `ClientsPage.jsx`: composition layer only.
- `useClientsPageController.js`: business orchestration for state, async calls, and form workflows.
- `components/`: presentational UI blocks with props-only contracts.
- `clientsPage.utils.js`: formatting and state helper constants.

## File Map
- `src/pages/ClientsPage.jsx`
- `src/pages/clients/useClientsPageController.js`
- `src/pages/clients/clientsPage.utils.js`
- `src/pages/clients/components/ClientsHeroForm.jsx`
- `src/pages/clients/components/ClientsTablePanel.jsx`
- `src/pages/clients/components/ClientsModals.jsx`

## Where To Change What
- Visual/layout only: edit `components/`.
- Async flow, validations, state transitions: edit `useClientsPageController.js`.
- Date/status formatting and initial state constants: edit `clientsPage.utils.js`.

## PR Checklist (Clients)
- Keep `ClientsPage.jsx` composition-only.
- Add/update hook tests when data flow changes.
- Add/update component tests when UI interactions change.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Clients refactor is isolated in incremental commits. Prefer `git revert <commit>` for safe rollback.
