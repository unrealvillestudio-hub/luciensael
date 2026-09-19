# luciensael.com

Sitio de autor de **Lucien Sael** — creador de mundos. Plataforma de pensamiento y autoridad.

## Stack
- HTML/CSS/JS estático puro. Sin framework, sin build.
- Deploy directo a Vercel desde `main`.
- Bilingüe EN/ES (toggle client-side por diccionario JS).

## Estructura

> **ACTUALIZADO 2026-09-18 — el blog se renderiza desde la base.** Lo anterior se conserva abajo
> bajo su guard: la historia no se borra, se le añade encima.

```
/index.html                                      Home
/api/_channel.js                                 Resuelve el canal en intel.brand_publish_channels
                                                 y lee las piezas publicadas. VERBATIM del
                                                 renderizador de forumphs-com: no conoce marca,
                                                 dominio ni platform_key.
/api/_render.js                                  Plantilla HTML. Lo ÚNICO adaptado a esta marca:
                                                 tokens del Brand Identity System, fuentes, nav y pie.
/api/_legacy.js                                  El artículo escrito a mano ANTES del carril. Lo leen
                                                 el listado y el sitemap; se vacía cuando se reescriba.
/api/blog-index.js                               /blog          (rewrite en vercel.json)
/api/blog-article.js                             /blog/:slug    (rewrite en vercel.json)
/api/sitemap.js                                  /sitemap.xml   (rewrite en vercel.json)
/api/robots.js                                   /robots.txt    (rewrite en vercel.json)
/blog/the-intelligence-was-never-artificial.html Artículo 01 (molde canónico). SE QUEDA: Vercel
                                                 sirve el estático antes que la reescritura, así que
                                                 su URL no cambia.
/scripts/verify-blog.mjs                         157 comprobaciones. Simula PostgREST, no toca la
                                                 base real.  node scripts/verify-blog.mjs
/vercel.json                                     cleanUrls + rewrites del blog + headers
```

**Variables de entorno que exige `/api` (las carga Sam en Vercel, nunca CC):**
`BRAND_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Sin ellas `/blog` responde fail-loud
legible, nunca una página vacía.

> ### ⛔ NO OPERATIVO — estructura anterior al 2026-09-18
> Se conserva sólo por trazabilidad. `blog/index.html` ya no existe: su ruta la sirve
> `api/blog-index.js` y su copia —el H1 y la bajada— viaja verbatim dentro de esa función.
> ```
> /index.html                                      Home
> /blog/index.html                                 Índice del blog ("Writing")
> /blog/the-intelligence-was-never-artificial.html Artículo 01 (molde canónico)
> /vercel.json                                     cleanUrls + headers de seguridad
> ```

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
