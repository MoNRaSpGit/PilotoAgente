# Products Module Guide

## Purpose
Manages product catalog operations, search, and product-level validations used by caja and stock flows.

## File Map
- `product.controller.js`: HTTP handlers for product routes.
- `product.service.js`: product business rules.
- `product.repository.js`: product DB access.

## Where To Change What
- API-level behavior: `product.controller.js`
- Domain logic/validations: `product.service.js`
- Query and persistence logic: `product.repository.js`
