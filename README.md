# PilotoAgente

Proyecto compuesto por 3 aplicaciones:

- `FrontAgente`: app interna (scanner/caja/operativa)
- `BackAgente`: API central (scanner + web publica)
- `WebAgente`: web publica para clientes

## Documentacion

- Raiz del proyecto: [README.md](C:\Users\ju4nr\OneDrive\Desktop\PilotoAgente\README.md)
- Frontend publico (cliente): [WebAgente/README.md](C:\Users\ju4nr\OneDrive\Desktop\PilotoAgente\WebAgente\README.md)
- Backend (incluye modulo web): [BackAgente/README.md](C:\Users\ju4nr\OneDrive\Desktop\PilotoAgente\BackAgente\README.md)

## Primeros pasos

### FrontAgente

```bash
cd FrontAgente
npm install
npm run dev
```

### WebAgente

```bash
cd WebAgente
npm install
npm run dev
```

### BackAgente

```bash
cd BackAgente
npm install
npm run dev
```

## Variables de entorno

Revisar:

- `FrontAgente/.env.example`
- `BackAgente/.env.example`
- `WebAgente/.env.example`

## Deploy

- Frontend(s) preparados para GitHub Pages con `gh-pages`
- Backend preparado para Render con `render.yaml`

### Publicar FrontAgente en GitHub Pages

```bash
cd FrontAgente
npm run deploy
```

URL esperada:

`https://monraspgit.github.io/PilotoAgente/`

### Publicar WebAgente en GitHub Pages

```bash
cd WebAgente
npm run deploy
```

URL esperada:

`https://monraspgit.github.io/WebAgente/`
