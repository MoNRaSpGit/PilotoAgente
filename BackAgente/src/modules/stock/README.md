# Stock Module Guide

## Purpose
Manages inventory movements and stock-level operations.

## Notes
- `ops_stock_control.is_test_data` marks controls used for test/demo datasets.
- Dashboard and controls endpoints can filter by `test_only=true`.

## File Map
- `stock.controller.js`: HTTP handlers for stock routes.
- `stock.service.js`: stock domain logic.
- `stock.repository.js`: stock data access and updates.

## Where To Change What
- Endpoint-level behavior: `stock.controller.js`
- Business rules and orchestration: `stock.service.js`
- Persistence and query logic: `stock.repository.js`
