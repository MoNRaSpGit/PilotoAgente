# Suppliers Module Guide

## Purpose
Handles supplier CRUD and supplier-related movement flows.

## File Map
- `supplier.controller.js`: HTTP handlers for supplier routes.
- `supplier.service.js`: supplier business logic and validations.
- `supplier.repository.js`: supplier DB queries/mutations.

## Where To Change What
- Response contract and endpoint behavior: `supplier.controller.js`
- Domain rules: `supplier.service.js`
- Data access behavior: `supplier.repository.js`
