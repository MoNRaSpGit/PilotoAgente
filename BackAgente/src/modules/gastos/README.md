# Gastos Module Guide

## Purpose
Handles expense registration and reporting endpoints.

## File Map
- `gastos.controller.js`: HTTP handlers for expense routes.
- `gastos.service.js`: expense business logic and validations.
- `gastos.repository.js`: expense persistence and queries.

## Where To Change What
- Endpoint payload/response: `gastos.controller.js`
- Business rules: `gastos.service.js`
- Data layer behavior: `gastos.repository.js`
