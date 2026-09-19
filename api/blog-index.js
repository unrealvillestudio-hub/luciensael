// api/blog-index.js — listado del blog. HTML COMPLETO en la primera respuesta.
//
// Verificable sin JS:  curl -s https://<host>/blog | grep '<h2'

import { resolveChannel, fetchPieces, ChannelError } from './_channel.js';
import { page, escapeHtml, formatStamp, absoluteUrl, siteNameOf, blogLabelOf, localeOf, failLoud } from './_render.js';
// Los artículos escritos a mano ANTES de que el carril alimentara este blog. Ver `_legacy.js`
// para por qué se declaran en vez de sembrarse, y por qué los leen dos superficies.
import { LEGACY_POSTS } from './_legacy.js';

const PROVIDER = 'vercel_html';
const BLOG_PATH = '/blog';

// Textos de plantilla de ESTE repo, que es artefacto exclusivo de marca (MULTIBRAND_RULE
// §3): el sitio de una sola marca. No gobiernan comportamiento, no viajan a ninguna capa
// compartida y no van a la base — son la copia de la portada del listado, igual que
// «Home» o «Let's talk» ya lo son en la plantilla.
//
// LOS DOS SON VERBATIM del `blog/index.html` que esta ruta sustituye. Es deliberado: el
// cambio de este PR es DE DÓNDE SALEN LOS ARTÍCULOS, no cómo se presenta la sección. Un
// rediseño mezclado con el cambio de origen habría hecho imposible saber cuál de los dos
// rompió algo.
//
// El rótulo de interfaz y la URL están DESACOPLADOS a propósito: `/blog` es activo de
// SEO y no se mueve; cómo se llama el enlace es decisión editorial y sale del canal
// (`blog_label` = «Writing»).
const LIST_HEADING = 'Writing.';
const LIST_LEDE = 'No calendar. No strategy. Just what\u2019s moving through my head at the moment I decide to write it down.';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const channel = await resolveChannel({ provider: PROVIDER, req });
    const { config } = channel;

    const perPage = config.items_per_page;
    const pageNum = Math.max(1, Number.parseInt(String(req.query?.page ?? '1'), 10) || 1);
    const offset = (pageNum - 1) * perPage;

    // Se pide una pieza de más que las de la página: así se sabe si hay página siguiente
    // sin una segunda consulta de conteo.
    const { pieces, schema_fallbacks } = await fetchPieces(channel, { limit: perPage + 1, offset });
    const hasNext = pieces.length > perPage;
    const shown = pieces.slice(0, perPage);

    const canonicalPath = pageNum > 1 ? `${BLOG_PATH}?page=${pageNum}` : BLOG_PATH;
    const canonical = absoluteUrl(config.base_url, canonicalPath);
    const site = siteNameOf(config);

    // La página 1 vive en `/blog` sin parámetro: la ruta hacia atrás desde la 2 tiene que
    // apuntar ahí y no a `?page=1`, o se declara como canónica una URL que la propia
    // página 1 no reconoce como suya.
    const pagePath = (n) => (n <= 1 ? BLOG_PATH : `${BLOG_PATH}?page=${n}`);
    const prevUrl = pageNum > 1 ? absoluteUrl(config.base_url, pagePath(pageNum - 1)) : null;
    const nextUrl = hasNext ? absoluteUrl(config.base_url, pagePath(pageNum + 1)) : null;

    if (String(req.query?.debug ?? '') === 'schema') {
      res.setHeader('Cache-Control', 'no-store');
      // `no-store` evita la caché, no al rastreador: sin esta cabecera la vista de
      // diagnóstico es una URL indexable que expone el estado interno del canal.
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(200).json({
        provider: channel.provider,
        degraded: channel.degraded,
        platform_key_resolved: Boolean(channel.platformKey),
        config_defaults: channel.config_defaults,
        schema_fallbacks,
        pieces: shown.length,
      });
    }

    // Un solo rótulo para el listado: el mismo que lleva la miga del artículo. Dos
    // fuentes para el mismo nombre es la puerta por la que se cuelan dos nombres.
    const blogLabel = blogLabelOf(config);
    const title = pageNum > 1
      ? `${blogLabel} — página ${pageNum} · ${site}`
      : `${blogLabel} · ${site}`;
    // La bajada visible es la de plantilla. `config.description`, si el canal la trae,
    // sigue gobernando la meta description: es dato de SEO del canal y manda sobre la
    // copia del repo.
    const description = config.description ? String(config.description) : LIST_LEDE;

    // Orden de la tarjeta: etiqueta de tema · título · extracto · fecha · imagen.
    //
    // Cada bloque se emite SOLO si tiene contenido. La etiqueta viene de `public_label`
    // resuelto por `brand_id` desde la tabla — si el catálogo no la trajo, la tarjeta se
    // apoya en la jerarquía tipográfica y no imprime nada. La imagen es opcional por
    // requisito, no por descuido: sin `assets.image.url` no se emite ni contenedor ni
    // marcador de posición.
    // UNA SOLA FORMA DE TARJETA PARA LOS DOS ORÍGENES. La pieza de la base y el artículo
    // declarado se normalizan a la misma forma ANTES de pintarse: si cada origen tuviera su
    // propio bloque de HTML, los dos se separarían en el primer cambio de diseño, y el lector
    // vería dos tipos de tarjeta en la misma rejilla sin que nada lo justifique.
    //
    // Los anteriores al sistema sólo entran en la PÁGINA 1: son el fondo del archivo y no
    // participan de la paginación de la base, que cuenta filas. Mezclarlos en cada página
    // haría que el mismo artículo reapareciera en todas.
    const deLaBase = shown.map((p) => ({
      href: `${BLOG_PATH}/${p.slug}`,
      title: p.title,
      excerpt: p.excerpt,
      topic: p.public_label,
      published_iso: p.published_iso,
      image_url: p.image_url,
    }));
    // EN LA ÚLTIMA PÁGINA, NO EN LA PRIMERA. Son el fondo del archivo: los más antiguos del
    // blog. Ponerlos en la página 1 los colocaría por fecha al final de esa página mientras
    // piezas MÁS NUEVAS que ellos siguen en la página 2 — un orden que se lee roto. Y ponerlos
    // en todas las páginas los repetiría. `hasNext === false` es exactamente «no hay nada más
    // viejo después de esto», que es su sitio.
    //
    // No entran en el presupuesto de `items_per_page`, que cuenta filas de la base: la última
    // página lleva sus piezas más éstos. Restarlos del presupuesto empujaría una pieza de la
    // base a una página siguiente que a veces ni existiría.
    const entradas = (hasNext ? deLaBase : [...deLaBase, ...LEGACY_POSTS])
      // Más reciente primero. Una entrada sin fecha va al final y no al principio: sin sello
      // no se puede afirmar que sea lo último.
      .sort((a, b) => String(b.published_iso ?? '').localeCompare(String(a.published_iso ?? '')));

    const cards = entradas.map((p) => {
      const stamp = formatStamp(p.published_iso, config);
      return [
        `  <a class="card" href="${escapeHtml(p.href)}">`,
        p.topic ? `    <span class="topic">${escapeHtml(p.topic)}</span>` : '',
        `    <h2>${escapeHtml(p.title)}</h2>`,
        p.excerpt ? `    <p>${escapeHtml(p.excerpt)}</p>` : '',
        stamp ? `    <span class="stamp">${escapeHtml(stamp)}</span>` : '',
        p.image_url
          ? `    <span class="shot"><img src="${escapeHtml(p.image_url)}" alt="" loading="lazy" decoding="async"></span>`
          : '',
        `  </a>`,
      ].filter(Boolean).join('\n');
    }).join('\n');

    const pager = (pageNum > 1 || hasNext)
      ? `<div class="pager">
  ${pageNum > 1 ? `<a href="${escapeHtml(pagePath(pageNum - 1))}" rel="prev">&larr; Newer</a>` : `<a class="void" href="${BLOG_PATH}">·</a>`}
  ${hasNext ? `<a href="${escapeHtml(pagePath(pageNum + 1))}" rel="next">Older &rarr;</a>` : `<a class="void" href="${BLOG_PATH}">·</a>`}
</div>`
      : '';

    const body = `<div class="hero">
  <div class="eyebrow">${escapeHtml(blogLabel)}</div>
  <h1>${escapeHtml(pageNum > 1 ? `${LIST_HEADING} — página ${pageNum}` : LIST_HEADING)}</h1>
  <p class="lede">${escapeHtml(LIST_LEDE)}</p>
</div>
${entradas.length ? `<div class="list">\n${cards}\n</div>` : '<p class="empty">Nothing published on this channel yet.</p>'}
${pager}`;

    // El logo es del CANAL, no del repo: si la fila no lo trae, `Organization` sale sin
    // logo en vez de con una ruta inventada que devolvería 404 al rastreador.
    const rawLogo = typeof config.logo_url === 'string' ? config.logo_url.trim() : '';
    const logoUrl = rawLogo
      ? (/^https?:\/\//i.test(rawLogo) ? rawLogo : absoluteUrl(config.base_url, rawLogo))
      : null;
    const organization = {
      '@type': 'Organization',
      name: site,
      url: config.base_url,
      ...(logoUrl ? { logo: { '@type': 'ImageObject', url: logoUrl } } : {}),
    };

    const articleUrl = (p) => absoluteUrl(config.base_url, `${BLOG_PATH}/${p.slug}`);

    const structuredData = [{
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: title,
      description,
      url: canonical,
      inLanguage: localeOf(config),
      publisher: organization,
      blogPost: shown.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        url: articleUrl(p),
        ...(p.published_iso ? { datePublished: p.published_iso } : {}),
        ...(p.modified_iso ? { dateModified: p.modified_iso } : {}),
        ...(p.image_url ? { image: [p.image_url] } : {}),
      })),
    }, {
      // `ItemList` con las piezas de ESTA página: es lo que hace que el índice se lea como
      // un listado ordenado y no como una página suelta. Las posiciones son absolutas
      // dentro del catálogo, no relativas a la página, para que la 2 no repita 1..N.
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      url: canonical,
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: shown.length,
      itemListElement: shown.map((p, i) => ({
        '@type': 'ListItem',
        position: offset + i + 1,
        name: p.title,
        url: articleUrl(p),
      })),
    }, {
      '@context': 'https://schema.org',
      ...organization,
    }, {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: site,
      url: config.base_url,
      inLanguage: localeOf(config),
      publisher: organization,
    }];

    for (const f of schema_fallbacks) console.warn(`[blog-index] ${f.code}: ${f.detail}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    if (schema_fallbacks.length) res.setHeader('X-Schema-Fallbacks', String(schema_fallbacks.length));
    return res.status(200).send(page({
      config, title, description, canonical,
      ogType: 'website',
      structuredData,
      schemaFallbacks: schema_fallbacks,
      blogPath: BLOG_PATH,
      prevUrl,
      nextUrl,
      body,
    }));
  } catch (e) {
    return failLoud(res, e instanceof ChannelError ? e : { code: 'UNEXPECTED', detail: e?.message ?? String(e), status: 500 });
  }
}
