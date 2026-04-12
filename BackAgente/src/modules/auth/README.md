# Auth Module Guide

## Purpose
Handles login, token validation, password hashing, and auth middleware used by protected routes.

## File Map
- `auth.controller.js`: HTTP handlers for auth endpoints.
- `auth.service.js`: auth business rules and token/session flow.
- `auth.repository.js`: user data access for auth.
- `auth.middleware.js`: request guards based on token and role.
- `password.utils.js`: password hash/compare helpers.

## Where To Change What
- Endpoint response shape: `auth.controller.js`
- Login/session behavior: `auth.service.js`
- Auth DB queries: `auth.repository.js`
- Token/role checks: `auth.middleware.js`
