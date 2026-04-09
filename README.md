# PilotoAgente

Estructura inicial del proyecto:

- `FrontAgente`: frontend con React + Vite
- `BackAgente`: backend con Node + Express

## Primeros pasos

### Frontend

```bash
cd FrontAgente
npm install
npm run dev
```

### Backend

```bash
cd BackAgente
npm install
npm run dev
```

## Variables de entorno

Revisar:

- `FrontAgente/.env.example`
- `BackAgente/.env.example`

## Deploy

- Frontend preparado para GitHub Pages con `gh-pages`
- Backend preparado para Render con `render.yaml`

### Publicar frontend en GitHub Pages

```bash
cd FrontAgente
npm run deploy
```

URL esperada:

`https://monraspgit.github.io/PilotoAgente/`
