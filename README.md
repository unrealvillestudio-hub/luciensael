# luciensael.com

Sitio de autor de **Lucien Sael** — creador de mundos. Plataforma de pensamiento y autoridad.

## Stack
- HTML/CSS/JS estático puro. Sin framework, sin build.
- Deploy directo a Vercel desde `main`.
- Bilingüe EN/ES (toggle client-side por diccionario JS).

## Estructura
```
/index.html                                      Home
/blog/index.html                                 Índice del blog ("Writing")
/blog/the-intelligence-was-never-artificial.html Artículo 01 (molde canónico)
/vercel.json                                     cleanUrls + headers de seguridad
```

## Design System (v1.0)
- Paleta: obsidian `#0D0D0B` · carbon `#1C1C1A` · ember `#D4622A` · gold `#B8922A` · bone `#EDE8DF`
- Tipografía: Cormorant Garamond (display) · Crimson Pro (body) · JetBrains Mono (mono)
- Detalles: cursor custom, grano SVG, ticker marquee, reveals on scroll.

## Molde de artículo
`/blog/the-intelligence-was-never-artificial.html` es el patrón canónico:
- Dos bloques `.lang-section` (data-lang="en" / "es"), toggle reusa el del sitio.
- JSON-LD `BlogPosting` en `<head>`.
- Barra de progreso de lectura, drop-cap, blockquote ember.
- Cada nuevo artículo se genera clonando este molde y se commitea en `/blog/<slug>.html`,
  más una card nueva en `/blog/index.html`.

## Deploy
1. Crear repo `unrealvillestudio-hub/luciensael` (público).
2. Push de estos archivos a `main`.
3. Crear proyecto Vercel conectado al repo (framework: Other / static).
4. Añadir dominio `luciensael.com` + DNS (A/CNAME a Vercel). Pendiente: el dominio aún no resuelve.

## Pendientes conocidos
- Formulario de contacto (home) sin backend — los envíos no se procesan todavía.
- DNS de `luciensael.com` sin configurar.
