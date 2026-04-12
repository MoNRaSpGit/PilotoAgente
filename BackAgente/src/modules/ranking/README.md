# Ranking Module Guide

## Purpose
Builds ranking data (for example top-selling products) from movement/sales sources.

## File Map
- `ranking.controller.js`: HTTP handlers for ranking routes.
- `ranking.service.js`: ranking use-case logic.
- `ranking.repository.js`: ranking queries and aggregations.

## Where To Change What
- Endpoint filtering/contract: `ranking.controller.js`
- Ranking rules and normalization: `ranking.service.js`
- Aggregation/query source: `ranking.repository.js`
