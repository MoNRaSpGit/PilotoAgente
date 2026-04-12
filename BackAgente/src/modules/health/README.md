# Health Module Guide

## Purpose
Provides service health and readiness checks for monitoring and uptime validation.

## File Map
- `health.controller.js`: HTTP handlers for health endpoints.
- `health.service.js`: status assembly and diagnostics logic.

## Where To Change What
- Response shape/status codes: `health.controller.js`
- Health signal composition: `health.service.js`
