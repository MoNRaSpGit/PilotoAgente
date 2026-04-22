# Migraciones de Base de Datos

Este proyecto usa migraciones versionadas para cambios de esquema.

## Comando

```bash
npm run db:migrate
```

## Flujo

- El runner esta en `src/bootstrap/migrations/runMigrations.js`.
- Las migraciones se registran en `ops_schema_migrations`.
- El listado de migraciones se mantiene en `src/bootstrap/migrations/registry.js`.
- Cada migracion exporta:
  - `key`: identificador unico y ordenable.
  - `up({ pool })`: cambios de esquema idempotentes.

## Convencion de keys

Usar formato:

`YYYYMMDD_NNN_descripcion_corta`

Ejemplo:

`20260422_002_web_orders_schema`
