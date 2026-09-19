// api/_legacy.js — LOS ARTÍCULOS ANTERIORES AL SISTEMA.
//
// POR QUÉ EXISTE. Este blog existía antes de que el carril lo alimentara, y tiene artículos
// escritos a mano que viven como archivos estáticos en este mismo repositorio. El listado y el
// sitemap tienen que mostrarlos, o el día que `/blog` pase a renderizarse desde la base el sitio
// PIERDE contenido publicado — una regresión visible para cualquiera que entre.
//
// POR QUÉ NO SE SIEMBRAN EN LA BASE, que sería lo obvio. Medido el 2026-09-18 sobre
// `blog/the-intelligence-was-never-artificial.html`: lleva `<h2>`, `<blockquote>`, `<strong>` y
// `<em>`, capitular en el primer párrafo, Y DOS VERSIONES COMPLETAS —inglés y español— que el
// lector conmuta con un botón. El renderizador ESCAPA el HTML que viene de la base a propósito
// —`paragraphs()` en `_render.js`, y esa decisión es de seguridad, no de estilo— y sirve UNA
// lengua por pieza. Sembrarlo lo dejaría en una sucesión plana de párrafos y en un solo idioma.
// Migrarlo lo degradaría dos veces; dejarlo fuera lo escondería. Se declara, y queda escrito
// por qué.
//
// NO ES CONTENIDO CABLEADO EN CAPA COMPARTIDA. Este repositorio es artefacto exclusivo de marca
// (MULTIBRAND_RULE §3): el sitio de una sola marca. El artículo es un archivo de este mismo
// repositorio y esta lista es su índice — no viaja a ninguna capa compartida, no va a la base y
// ningún otro sitio la lee.
//
// VIVE EN SU PROPIO MÓDULO, y no dentro del listado, porque lo leen DOS superficies: el listado y
// el sitemap. Dos copias de la misma lista se separarían en el primer cambio, y entonces el
// sitemap enviaría a Google una página que el listado no enseña, o al revés.
//
// SE VACÍA SOLA: cuando un artículo de éstos se reescriba dentro del carril, se borra de aquí y su
// fila de la base ocupa su sitio. Una lista vacía es el estado esperado a largo plazo, y el código
// que la lee no cambia por eso.

export const LEGACY_POSTS = [
  {
    // La ruta es la REAL del artículo. Este sitio lleva `cleanUrls: true` en `vercel.json`, así que
    // su URL canónica es la SIN extensión y `…​.html` redirige a ella. Vercel sirve el archivo
    // estático antes de aplicar la reescritura `/blog/:slug`, así que esta URL sigue funcionando
    // tal cual pese a tener exactamente la forma de un slug.
    href: '/blog/the-intelligence-was-never-artificial',
    title: 'The intelligence was never artificial. We just didn\u2019t know what to call it.',
    excerpt: 'On why the word \u201Cartificial\u201D was always the wrong word \u2014 and what it says about the people who kept using it.',
    topic: 'EN \u00b7 ES',
    // ISO, para que ordene contra el `published_at` de la base sin convertir nada por el camino.
    published_iso: '2026-04-18T00:00:00Z',
  },
];
