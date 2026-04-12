# Objetivos Module Guide

## Purpose
This module tracks daily objective/record progress for operarios, including live updates and reward modals.

## Current Architecture
- `ObjetivosPage.jsx`: composition layer only.
- `useObjetivosPageController.js`: business orchestration (loading, live sync, session handling, unlock rules).
- `components/`: presentational UI blocks with props-only contracts.
- `objetivosPage.utils.js`: progress/date/reward helper utilities.

## File Map
- `src/pages/ObjetivosPage.jsx`
- `src/pages/objetivos/useObjetivosPageController.js`
- `src/pages/objetivos/objetivosPage.utils.js`
- `src/pages/objetivos/components/ObjetivosLoadingState.jsx`
- `src/pages/objetivos/components/ObjetivosMainContent.jsx`
- `src/pages/objetivos/components/ObjetivosModals.jsx`

## Where To Change What
- Visual/layout only: edit `components/`.
- Realtime, loading, session handling, unlock logic: edit `useObjetivosPageController.js`.
- Progress/date formatting and reward texts: edit `objetivosPage.utils.js`.

## Realtime Notes
- Poll refresh runs every 60s while page is visible.
- EventSource listens to `/api/caja/stream` and refreshes on non-`scanner:state` updates.
- Preserve cleanup for interval and EventSource listeners on unmount.

## PR Checklist (Objetivos)
- Keep `ObjetivosPage.jsx` composition-only.
- Validate unlock behavior for objective and record.
- Validate 401/session-expired flow still redirects to login.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Objetivos refactor is isolated in incremental commits. Prefer `git revert <commit>` for safe rollback.
