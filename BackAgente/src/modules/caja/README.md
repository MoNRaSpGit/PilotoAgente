# Caja Module Guide

## Purpose
Owns cashbox operations: open/close, sales, payments, daily summaries, objectives, movements, and live scanner sync.

## File Map
- `caja.controller.js`: HTTP handlers for cashbox routes.
- `caja.service.js`: business orchestration for cashbox flows.
- `caja.repository.js`: persistence and queries for cashbox data.
- `caja.realtime.js`: SSE auth, stream attach, and broadcast helpers.
- `scannerLiveState.store.js`: in-memory scanner state snapshot.

## Where To Change What
- Response codes/messages: `caja.controller.js`
- Business rules/validations: `caja.service.js`
- SQL/query behavior: `caja.repository.js`
- Live stream behavior: `caja.realtime.js`
- Scanner mirror state contract: `scannerLiveState.store.js`
