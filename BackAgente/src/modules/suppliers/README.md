# Suppliers Module Guide

## Purpose
Handles supplier CRUD and supplier-related movement flows.

## Current Data Model
- `ops_supplier_orders`: pedido cabecera (proveedor, fechas, monto esperado, estado).
- `ops_supplier_order_items`: lineas del pedido (producto, cantidad, costo unitario, total de linea).

## Main Endpoints
- `POST /api/suppliers/orders`: crea pedido. Soporta `items[]`; si llegan items, el monto esperado se calcula desde lineas.
- `GET /api/suppliers/orders/:orderId`: detalle de pedido con lineas.
- `GET /api/suppliers/agenda`: agenda semanal con `delivery_items` y `pickup_items` por dia.
- `POST /api/suppliers/order-drafts/items`: agrega producto al borrador abierto del proveedor (flujo desde alertas de stock).
- `GET /api/suppliers/order-drafts`: lista borradores abiertos con sus items.
- `POST /api/suppliers/order-drafts/:draftId/confirm`: confirma borrador y lo convierte a pedido formal con lineas.

## File Map
- `supplier.controller.js`: HTTP handlers for supplier routes.
- `supplier.service.js`: supplier business logic and validations.
- `supplier.repository.js`: supplier DB queries/mutations.

## Where To Change What
- Response contract and endpoint behavior: `supplier.controller.js`
- Domain rules: `supplier.service.js`
- Data access behavior: `supplier.repository.js`
