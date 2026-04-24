# BackAgente

API central de `PilotoAgente`. Atiende:

- Flujo interno (`FrontAgente`): login, scanner, caja, clientes, gastos, proveedores.
- Flujo web publico (`WebAgente`): auth web, catalogo, pedidos, perfil, administracion web.

## Inicio rapido

```bash
npm install
npm run dev
```

Por defecto escucha en:

- `http://localhost:3000`

## Scripts

- `npm run dev`: inicia servidor.
- `npm run db:migrate`: ejecuta migraciones versionadas.
- `npm run test:smoke:web`: smoke rapido del flujo web.
- `npm run test:bench:web`: benchmark sintetico por endpoint web.
- `npm run test:e2e:web`: flujo e2e web (login -> catalogo -> pedido -> historial).

## Modulo Web (Backend de WebAgente)

### Rutas principales

- Auth web:
  - `POST /api/web/auth/register`
  - `POST /api/web/auth/login`
  - `GET /api/web/auth/me`
- Catalogo web:
  - `GET /api/web/products`
  - `GET /api/web/products/inactive`
  - `POST /api/web/products/images/batch`
  - `GET /api/web/products/:productId/image`
  - `GET /api/web/categories`
- Pedidos web (cliente):
  - `POST /api/web/orders`
  - `GET /api/web/orders/mine`
  - `GET /api/web/orders/repeat-products`
  - `PATCH /api/web/orders/:orderId/hide`
  - `GET /api/web/orders/stream`
- Web admin/operario (operativa interna de pedidos web):
  - `GET /api/web/admin/orders`
  - `PATCH /api/web/admin/orders/:orderId/status`
  - `PATCH /api/web/admin/orders/:orderId/hide`
  - `GET /api/web/admin/orders/stream`
- Perfil usuario web:
  - `GET /api/web/users/me/profile`

### Auth: dos dominios separados

- Scanner/Front interno usa `ops_usuarios` con `/api/auth/login`.
- Web cliente usa `ops_web_usuarios` con `/api/web/auth/*`.

No mezclar credenciales entre ambos dominios.

## Estado funcional (actual)

- Registro/login web activo y estable.
- Pedido web activo, con SSE para actualizacion de estado.
- Historial de productos repetidos (`repeat-products`) activo.
- Edicion admin web de producto activa (nombre, precio, categoria, estado, imagen).
- Carga de imagenes optimizada con tabla media/cache y endpoint batch.
- Observabilidad activa (`[OBS][REQ]`, `[OBS][DB-SLOW]`, `[OBS][ORDER]`).

## Performance y observabilidad

- Umbrales configurables por env:
  - `OBS_REQUEST_SLOW_MS` (default 1200)
  - `OBS_REQUEST_LOG_MIN_MS` (default 300)
  - `OBS_DB_QUERY_SLOW_MS` (default 700)
  - `OBS_ORDER_STAGE_LOG_ENABLED` (default `false`)
  - `OBS_ORDER_STAGE_SLOW_MS` (default 250)
- Recomendado para diagnostico fino de `POST /web/orders`:
  - setear `OBS_ORDER_STAGE_LOG_ENABLED=1` y `OBS_ORDER_STAGE_SLOW_MS=1` temporalmente.

## Migraciones

Se usa runner versionado en:

- `src/bootstrap/migrations`

Antes de subir cambios de esquema:

1. Agregar archivo de migracion nuevo.
2. Registrar en `registry.js`.
3. Ejecutar `npm run db:migrate`.

## Deploy

- Produccion backend en Render (`render.yaml`).
- Deploy se activa al hacer push a `main`.

## Nota operativa importante

Si hay login temprano en scanner inmediatamente tras boot, el servicio ahora asegura seed demo antes del primer login interno para evitar carreras de inicializacion.
