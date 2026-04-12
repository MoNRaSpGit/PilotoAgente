# Clients Module Guide

## Purpose
Manages client endpoints and related business logic used by sales and CRM flows.

## File Map
- `client.controller.js`: HTTP handlers for client routes.
- `client.service.js`: client business rules.
- `client.repository.js`: DB access for clients.

## Where To Change What
- API contract: `client.controller.js`
- Use-case behavior: `client.service.js`
- Queries/mutations: `client.repository.js`
