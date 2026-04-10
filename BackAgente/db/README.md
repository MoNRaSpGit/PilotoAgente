# Base de Datos Agente

Este directorio funciona como mapa de referencia de la base de datos del proyecto.

La idea es simple:
- si agregamos una tabla, índice o campo importante, primero lo documentamos acá
- después actualizamos el código que la crea o la usa
- así evitamos perder de vista la estructura real

## Tablas Principales

- `ops_usuarios`
- `ops_clientes`
- `ops_clientes_historial`
- `ops_cajas`
- `ops_caja_movimientos`
- `ops_caja_movimiento_items`
- `ops_gastos`

## Seeds

- `sql/seed_ops_usuarios.sql`
- `sql/seed_ops_clientes.sql`

## Convención de trabajo

- `Caja` y `Gastos` son módulos vivos y pueden ajustar su esquema.
- `Clientes` mantiene historial y campos de seguimiento.
- Los índices nuevos siempre deben quedar reflejados en el código y en este directorio.
- Las funciones `ensure...Table()` del backend son las que realmente crean o actualizan el esquema.

## Qué mirar cuando algo cambie

- `BackAgente/src/modules/auth/auth.repository.js`
- `BackAgente/src/modules/clients/client.repository.js`
- `BackAgente/src/modules/caja/caja.repository.js`
- `BackAgente/src/modules/gastos/gastos.repository.js`
- `BackAgente/src/bootstrap/initDatabase.js`

## Nota

Este directorio no reemplaza la base real.
Es una guía para mantener sincronizados:
- la estructura de tablas
- los índices
- los seeds
- y los cambios de negocio
