# Stock Module Guide

## Purpose
Manages inventory movements and stock-level operations.

## File Map
- `stock.controller.js`: HTTP handlers for stock routes.
- `stock.service.js`: stock domain logic.
- `stock.repository.js`: stock data access and updates.

## Where To Change What
- Endpoint-level behavior: `stock.controller.js`
- Business rules and orchestration: `stock.service.js`
- Persistence and query logic: `stock.repository.js`
