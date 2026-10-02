// api/blog-latest.js — los últimos artículos del blog, en JSON, para la sección Writing de
// la portada.
//
// POR QUÉ EXISTE. La sección Writing de `index.html` llevaba cinco tarjetas escritas a mano:
// una apuntaba a un artículo real y las otras tres a `/blog/` sin artículo detrás. Nada de lo
// que el carril publicaba aparecía en la portada. Esta ruta le da a la portada la MISMA fuente
// que `/blog`: las piezas publicadas de la base más los artículos anteriores al sistema
// (`_legacy.js`), ordenados por fecha.
//
// La portada es HTML estático y pide esta ruta al cargar. Si la ruta falla, la portada
// conserva lo que trae escrito —el artículo anterior al sistema y el botón al blog—, así que
// el fallo deja la sección más corta, nunca vacía. El rastreador no depende de esto: `/blog`
// y `/sitemap.xml` se sirven completos en la primera respuesta.
//
// Verificable:  curl -s https://<host>/api/blog-latest | jq '.posts[].title'

import { resolveChannel, fetchPieces, ChannelError } from './_channel.js';
import { LEGACY_POSTS } from './_legacy.js';

const PROVIDER = 'vercel_html';
const BLOG_PATH = '/blog';
// Cuántas tarjetas caben en la sección sin que deje de ser un adelanto del blog.
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 8;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const asked = Number.parseInt(String(req.query?.limit ?? ''), 10);
  const limit = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const channel = await resolveChannel({ provider: PROVIDER, req });
    const { pieces, schema_fallbacks } = await fetchPieces(channel, { limit, offset: 0 });
    for (const f of schema_fallbacks) console.warn(`[blog-latest] ${f.code}: ${f.detail}`);

    // La misma forma de entrada que la tarjeta de `/blog`: la pieza de la base y el artículo
    // declarado se normalizan igual ANTES de ordenarse.
    const posts = [
      ...pieces.map((p) => ({
        href: `${BLOG_PATH}/${p.slug}`,
        title: p.title,
        excerpt: p.excerpt,
        topic: p.public_label,
        language: p.language,
        published_iso: p.published_iso,
      })),
      ...LEGACY_POSTS.map((p) => ({ language: null, ...p })),
    ]
      // Sin fecha va al final: sin sello no se puede afirmar que sea lo último.
      .sort((a, b) => String(b.published_iso ?? '').localeCompare(String(a.published_iso ?? '')))
      .slice(0, limit);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // La misma caché que `/blog`: una pieza nueva aparece en la portada en ≤ 5 minutos.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
    res.setHeader('X-Robots-Tag', 'noindex');
    if (schema_fallbacks.length) res.setHeader('X-Schema-Fallbacks', String(schema_fallbacks.length));
    return res.status(200).json({ blog_path: BLOG_PATH, posts });
  } catch (e) {
    const err = e instanceof ChannelError ? e : { code: 'UNEXPECTED', detail: e?.message ?? String(e) };
    console.error(`[blog-latest] ${err.code}: ${err.detail}`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    // 503 y no 500: la portada lo lee como «no disponible ahora» y se queda con su respaldo.
    return res.status(503).json({ error: err.code, detail: err.detail });
  }
}
