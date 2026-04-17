# Scanner Module Guide

## Purpose
This module powers the scanner workflow: barcode scan, manual products, item editing, cashbox sale registration, optional client charge, and live-state sync.

## Current Architecture
- `ScannerPage.jsx`: page composition only. It wires controller state/actions to presentational components.
- `useScannerPageController.js`: scanner business orchestration (state, async calls, scan/edit/charge flows, live sync).
- `components/`: presentational UI blocks with props-only contracts.
- `scannerPage.utils.js`: scanner helper utilities (item cloning, timing logs, image resolving, draft normalization).
- `printing/`: ticket-printing layer for RAWBT (`model` for ticket text + `service` for launch transport).

## File Map
- `src/pages/ScannerPage.jsx`
- `src/pages/scanner/useScannerPageController.js`
- `src/pages/scanner/scannerPage.utils.js`
- `src/pages/scanner/components/ScannerInputForm.jsx`
- `src/pages/scanner/components/ScannerClientBox.jsx`
- `src/pages/scanner/components/ScannerTicketPanel.jsx`
- `src/pages/scanner/components/ScannerModals.jsx`
- `src/pages/scanner/printing/scannerTicketPrint.model.js`
- `src/pages/scanner/printing/scannerTicketPrint.service.js`

## Where To Change What
- Update visuals/layout only: edit files in `components/`.
- Update scanner behavior, async flow, item management, charge flow, or live sync: edit `useScannerPageController.js`.
- Update helper logic (normalization, image resolving, timing helpers): edit `scannerPage.utils.js`.
- Update ticket content/format: edit `printing/scannerTicketPrint.model.js`.
- Update RAWBT launch mode/transport: edit `printing/scannerTicketPrint.service.js`.

## Live Sync Notes
- Scanner sends best-effort sync snapshots with `syncScannerLiveState`.
- Sync payload includes `state`, `items`, `editing`, `manual`, `operator`, and `version`.
- Keep debounce and signature guard in place to avoid noisy duplicate syncs.
- Preserve cleanup for timers and long-press refs on unmount.

## Core Flows
- Scan success: adds item (merge by key if already present).
- Scan 404: opens unknown-product modal.
- Manual product: adds local manual ticket item.
- Edit item: updates local item and persists product when valid product id is resolvable.
- Charge without client: clears UI first, then records sale in background.
- Charge with client: records sale and then updates client debt.

## Test Coverage
- `src/tests/ScannerPage.test.jsx`: page wiring and primary actions.
- `src/tests/ScannerComponents.test.jsx`: component-level presentational behavior.
- `src/tests/useScannerPageController.test.jsx`: controller-level flows (initial load, scan, unknown barcode, charge flow, validation).

Run tests:
```bash
npm run test -- --run
```

## PR Checklist (Scanner)
- Keep `ScannerPage.jsx` composition-only.
- Add or update hook tests when flow/state logic changes.
- Add or update component tests when render/interaction behavior changes.
- Validate scan, manual, edit, and charge paths.
- Run:
```bash
npm run test -- --run
npm run build
```

## Rollback Strategy
Scanner refactor is split into incremental commits. Prefer `git revert <commit>` for safe rollback on shared branches.
