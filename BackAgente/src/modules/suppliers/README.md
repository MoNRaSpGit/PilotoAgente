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
- `supplier.repository.js`: supplier DB queries/mutations (core + transactional flows).
- `supplierOrdersRead.repository.js`: consultas read-only de ordenes/incidencias (slice extraido para reducir acople).
- `supplierDrafts.repository.js`: consultas/mutaciones del flujo de drafts de pedidos a proveedor.
- `supplierReceipts.repository.js`: flujo transaccional de recepcion de pedidos y actualizacion de stock.
- `supplierPickup.repository.js`: flujo transaccional de confirmacion de retiro (`pickup`) de pedidos.

## Where To Change What
- Response contract and endpoint behavior: `supplier.controller.js`
- Domain rules: `supplier.service.js`
- Data access behavior:
  - `supplier.repository.js` (mutaciones y flujos complejos)
  - `supplierOrdersRead.repository.js` (queries de lectura)
  - `supplierDrafts.repository.js` (flujo drafts)
  - `supplierReceipts.repository.js` (recepcion + stock)
  - `supplierPickup.repository.js` (confirmacion de retiro)
