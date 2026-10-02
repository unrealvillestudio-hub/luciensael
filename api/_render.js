// api/_render.js — plantilla HTML del renderizador `vercel_html`.
//
// PORTADO DE `unrealvillestudio-hub/forumphs-com` EL 2026-09-18, VÍA `coreproject`. Es la TERCERA
// instancia del mismo renderizador, no una copia suelta.
//
// Por qué se porta en vez de compartirse: son dos sitios de dos marcas, cada uno con su
// despliegue y su dominio. `_channel.js` —la mitad que habla con la base— viaja VERBATIM,
// porque ya es eje puro: no conoce marca, dominio ni `platform_key`, y resuelve todo por
// `BRAND_ID` del entorno más la fila de `intel.brand_publish_channels`. Lo que se adapta es
// SOLO esta plantilla, que es la identidad visual y la copia de ESTE sitio: tokens, fuentes,
// navegación y pie. MULTIBRAND_RULE §3 lo admite explícitamente — un artefacto declarado
// exclusivo de una marca.
//
// DIFERENCIA DELIBERADA CON EL ORIGEN, y es una corrección: allá el rótulo del blog estaba
// escrito en la navegación (`Sin tecnicismos`) pese a existir `blogLabelOf(config)`. Acá sale
// del canal, así que renombrar la sección es sembrar, no desplegar.
//
// Devuelve HTML COMPLETO en la primera respuesta HTTP. No hay shell estático ni `fetch`
// en cliente: el requisito es SEO-first y un contenido cargado por JS no se indexa de
// forma fiable.
//
// Ningún dominio, ningún nombre de marca y ningún `platform_key` viven aquí. El título
// del sitio y la URL canónica se construyen desde `config` del canal; los tokens de
// color se declaran una sola vez y coinciden con los de `index.html`.

import { emphasisToHtml, stripEmphasis, blocksOf } from './_inline.js';

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// JSON-LD embebido: se neutraliza `</script` para que el bloque no pueda cerrar la
// etiqueta que lo contiene.
export function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

export function absoluteUrl(baseUrl, path) {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

// Geometria del wordmark. Es EJE: no depende de ninguna marca. Se exporta porque la sirven
// dos superficies —la cabecera del blog y las paginas de aviso de /bim— y una sola
// definicion es lo que impide que se separen.
//
// 2026-10-02 — el tamaño pasa del <span> al contenedor (`--wm-fs`) para que una parte pueda
// declarar su ESCALA relativa (`scale` en el dato) sin romper la regla de origen: sin escala
// declarada, todas las partes miden lo mismo, exactamente como antes. Se añaden dos ejes de
// composicion que el dato puede pedir: `layout: 'stack'` (partes apiladas, una por linea) y
// `blink` en una parte (parpadeo de cursor, que se apaga con movimiento reducido).
export const WORDMARK_GEOMETRY = `.wm{display:inline-flex;align-items:baseline;gap:0;line-height:1}
.wm>span{font-size:calc(var(--wm-fs,26px) * var(--wm-k,1))}
.wm-xl{--wm-fs:54px}.wm-lg{--wm-fs:36px}.wm-md{--wm-fs:26px}
.wm-sm{--wm-fs:18px}.wm-xs{--wm-fs:13px}.wm-xxs{--wm-fs:10px}
.wm-stack{flex-direction:column;align-items:flex-start;line-height:.88}
.wm-stack>span{display:block}
@keyframes wm-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
.wm>span.wm-blink{display:inline-block;animation:wm-blink 1.1s step-end infinite}
@media (prefers-reduced-motion:reduce){.wm>span.wm-blink{animation:none}}`;

const STYLE = `
/* Brand Identity System v1.0 de Lucien Sael — los MISMOS tokens que index.html, que
   blog/index.html y que la fila del canal (intel.brand_publish_channels.config.theme,
   sembrada el 2026-08-26). Se declaran aca, y no se leen de la fila, por la misma razon
   que en el origen: esta plantilla es de ESTE sitio, y una pagina que pide sus colores
   por red se queda sin identidad cuando la red falla. La fila los lleva para que otras
   superficies pinten igual; el contrato entre las dos copias es que digan lo mismo, y
   aqui queda escrito contra que se comprueba.
   SIN ACENTOS GRAVES EN ESTE BLOQUE: va dentro de un template literal y uno solo lo cierra. */
:root{
  /* UN SOLO ACENTO, ESCRITO UNA SOLA VEZ. Esta marca tiene un acento -- ember -- y un
     secundario de utilidad -- gold. El renderizador de origen traia DOS nombres de acento
     porque su marca tiene dos; aqui los dos apuntan al mismo token en vez de repetir su
     valor, asi que cambiar el acento es cambiar una linea y no buscar un hex por el archivo. */
  --void:#0D0D0B;--carbon:#1C1C1A;--graphite:#2E2E2B;--surface:#2E2E2B;
  --ember:#D4622A;--amethyst:var(--ember);--terra:var(--ember);--ame-dim:rgba(212,98,42,0.20);
  --chalk:#EDE8DF;--chalk-72:#C4BDB0;--chalk-42:rgba(237,232,223,0.42);
  --chalk-12:rgba(237,232,223,0.12);--chalk-06:rgba(237,232,223,0.06);--gold:#B8922A;
  --font-display:'Cormorant Garamond',Georgia,serif;--font-serif:'Crimson Pro',Georgia,serif;
  --font-sans:'JetBrains Mono',monospace;--font-editorial:'Cormorant Garamond',Georgia,serif;
  /* Acentos del BP (2026-10-02), los mismos que la portada: ember es el calor (--a1), gold el
     detalle (--a2: resaltado de negritas, índice de sección) y Mercurio el frío (--a3: punto
     vivo, filete). Mercurio sobre void: 6,58:1. */
  --a1:var(--ember);--a2:var(--gold);--a2s:rgba(184,146,42,0.26);--a3:#8D989C;
}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:var(--void);color:var(--chalk);font-family:var(--font-sans);-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}
.topbar{border-bottom:1px solid var(--chalk-12);background:rgba(10,9,12,.88);position:sticky;top:0;z-index:10;backdrop-filter:blur(10px)}
/* El encabezado se reacomoda solo: flex-wrap deja caer la nav a una segunda fila
   exactamente cuando los tres enlaces dejan de caber junto a la marca, sin punto de
   corte inventado. min-height en vez de height es lo que deja crecer la barra: con la
   altura fija la segunda fila se salía de la caja. Sin esto, por debajo de 399px el
   contenido se comía los 24px de padding del .wrap y por debajo de 375px desbordaba la
   página en horizontal. */
.topbar .wrap{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px 16px;min-height:64px;padding-top:10px;padding-bottom:10px;max-width:1080px}
.mark{text-decoration:none;display:inline-flex}
/* ── SISTEMA DE WORDMARK ─────────────────────────────────────────────────────
   Portado de BluePrints/brands/ForumPHs/assets/ForumPHs_Amatista_Carbon_vFINAL.html.
   La GEOMETRIA es eje y vive aqui; los VALORES —texto, familia, peso, color y
   tracking de cada parte— son instancia y salen de config.wordmark del canal.
   Las tres partes comparten el MISMO font-size: es lo que alinea las alturas de
   caja de "Forum" y "PH" y deja la "s" a la altura de x de "orum". No hay
   jerarquia interna, y reducir una parte rompe el sistema. */
${WORDMARK_GEOMETRY}
.mark b{color:var(--terra);font-weight:600}
.topbar nav{display:flex;flex-wrap:wrap;gap:10px 22px;font-family:var(--font-editorial);font-weight:300;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.topbar nav a{color:var(--chalk-42);text-decoration:none;white-space:nowrap}
.topbar nav a:hover,.topbar nav a[aria-current]{color:var(--chalk)}
/* El enlace activo se distingue por COLOR, no por peso. El sistema asigna a las versales
   con tracking Cormorant Light 300, y el import trae 300/400/500: pedir 600 no carga un
   corte mas grueso, hace que el navegador SINTETICE una negrita falsa — se ve casi bien
   y no es la tipografia de la marca. */
.topbar nav a.feature,.topbar nav a.feature:hover,.topbar nav a.feature[aria-current]{color:var(--terra)}
.topbar nav a.feature:hover{filter:brightness(1.18)}
.hero{padding:72px 0 40px;border-bottom:1px solid var(--chalk-06)}
.eyebrow{font-family:var(--font-editorial);font-weight:300;font-size:12px;letter-spacing:.34em;text-transform:uppercase;color:var(--terra);margin-bottom:18px}
h1{font-family:var(--font-serif);font-size:clamp(30px,5.2vw,46px);font-weight:500;line-height:1.16;letter-spacing:-.01em}
.lede{margin-top:16px;font-size:17px;line-height:1.6;color:var(--chalk-72);max-width:62ch}
.meta{margin-top:22px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--chalk-42);display:flex;gap:14px;flex-wrap:wrap}
.meta span{display:inline-flex;align-items:center;gap:8px}
.cover{margin:40px 0 0;border:1px solid var(--chalk-12);border-radius:4px;overflow:hidden;background:var(--carbon)}
.cover img{display:block;width:100%;height:auto}
article{padding:44px 0 8px}
article p{font-family:var(--font-serif);font-size:19px;line-height:1.72;color:rgba(249,248,255,.86);margin-bottom:22px}
article p:last-child{margin-bottom:0}
.list{list-style:none;padding:46px 0 0;display:grid;gap:18px;align-items:start;grid-template-columns:repeat(auto-fill,minmax(292px,1fr))}
.card{display:flex;flex-direction:column;text-decoration:none;background:var(--carbon);border:1px solid var(--chalk-12);border-radius:3px;padding:24px 24px 22px;transition:border-color .18s,background .18s}
.card:hover{border-color:var(--terra);background:var(--surface)}
.card .topic{font-family:var(--font-editorial);font-size:12px;font-weight:300;letter-spacing:.22em;text-transform:uppercase;color:var(--terra);margin-bottom:13px}
.card h2{font-family:var(--font-serif);font-size:22px;font-weight:500;line-height:1.26;padding-left:14px;border-left:2px solid var(--terra);margin-bottom:11px}
.card p{font-size:14px;line-height:1.62;color:var(--chalk-72);margin-bottom:18px}
.card .stamp{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--chalk-42)}
/* La imagen es OPCIONAL y refuerza, no gobierna: cuando no existe no se emite nada — ni
   marcador de posición, ni caja vacía, ni alto reservado.
   El align-items:start de la grilla es lo que hace que eso baste: cada tarjeta mide lo
   que mide su contenido. Estirarlas a la altura de la fila abriría, dentro de la tarjeta
   SIN imagen, exactamente el hueco que este bloque prohíbe — el alto lo impondría la
   imagen de la vecina. Las columnas siguen alineadas; solo el borde inferior varía. */
.card .shot{margin-top:16px;border-radius:2px;overflow:hidden;aspect-ratio:16/9}
.card .shot img{display:block;width:100%;height:100%;object-fit:cover}
.related{margin-top:56px;padding-top:30px;border-top:1px solid var(--amethyst)}
.related h2{font-family:var(--font-display);font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--terra);margin-bottom:6px}
.related .why{font-size:13px;color:var(--chalk-42);margin-bottom:14px}
.related ul{list-style:none}
.related li{border-top:1px solid var(--chalk-06)}
.related a{display:block;padding:16px 0;text-decoration:none;font-family:var(--font-serif);font-size:17px;line-height:1.4;color:var(--chalk-72)}
.related a:hover{color:var(--chalk)}
.pager{display:flex;justify-content:space-between;gap:12px;padding:42px 0 0;border-top:1px solid var(--chalk-12);margin-top:42px}
.pager a{font-size:12px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--chalk-72);border:1px solid var(--chalk-12);padding:11px 18px;border-radius:2px}
.pager a:hover{border-color:var(--amethyst);color:var(--chalk)}
.pager .void{visibility:hidden}
.empty{padding:56px 0;color:var(--chalk-42);font-family:var(--font-serif);font-size:19px}
.notice{margin:40px 0 0;padding:16px 18px;border-left:3px solid var(--gold);background:var(--chalk-06);font-size:13px;line-height:1.6;color:var(--chalk-72)}
.notice strong{color:var(--gold);display:block;margin-bottom:5px;font-size:11px;letter-spacing:.18em;text-transform:uppercase}
footer{margin-top:76px;border-top:1px solid var(--chalk-12);padding:30px 0 46px;font-size:12px;color:var(--chalk-42)}
footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
footer a{color:var(--chalk-72);text-decoration:none}
/* 2026-10-02 — cabecera del blog en el telefono (ui-ux-layer §18.3): dos filas, la marca
   arriba y debajo pestañas de 48 px a todo el ancho. Medido antes: los enlaces median 13 px
   de alto, un tercio del minimo tactil. Desde 720 px vuelve a ser una sola fila. */
.mark{min-height:44px;align-items:center}
.topbar nav a{display:inline-flex;align-items:center;justify-content:center;min-height:44px}
.lede{font-family:var(--font-serif);font-style:italic}
/* ── Formato editorial (F1, 2026-10-02) — el de la maqueta v4 aprobada ── */
.eyebrow{display:flex;align-items:center;gap:10px}
.eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--a3);box-shadow:0 0 0 4px rgba(141,152,156,.18);flex:none}
article p.lede{font-size:21px;line-height:1.6;color:var(--chalk);font-style:normal}
article strong{color:var(--chalk);font-weight:600;background:linear-gradient(transparent 62%,var(--a2s) 62%) no-repeat;padding:0 .08em}
article .sec{margin:2.4em 0 .9em;display:grid;gap:10px}
article .sec .idx{display:flex;align-items:center;gap:12px;font-family:var(--font-sans);font-size:11px;font-weight:400;letter-spacing:.2em;text-transform:uppercase;color:var(--a2)}
article .sec .idx::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--a2),var(--a1) 40%,transparent);opacity:.55}
article h2{font-family:var(--font-display);font-weight:300;font-size:clamp(28px,4.2vw,38px);line-height:1.1;color:var(--chalk);text-wrap:balance}
article blockquote.pull{position:relative;margin:2.2em 0;padding:6px 0 6px 26px}
article blockquote.pull::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:2px;background:linear-gradient(180deg,var(--a1),var(--a2))}
article blockquote.pull p{font-family:var(--font-display);font-style:italic;font-weight:300;font-size:clamp(26px,3.6vw,36px);line-height:1.18;color:var(--chalk);margin:0}
article blockquote.pull strong{background:none;color:var(--a1);font-weight:300;padding:0}
article p.closer{font-style:italic;color:var(--chalk-72);margin-top:1.6em}
/* «Keep reading» con la imagen de cada artículo (Sam, 2026-10-02). Sin imagen, la tarjeta
   se apoya en el título y no reserva hueco. */
.related ul{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))}
.related ul>li{min-width:0;border-top:0}
.related a.rel{display:flex;flex-direction:column;height:100%;padding:0;border:1px solid var(--chalk-12);border-radius:3px;overflow:hidden;background:var(--carbon);transition:border-color .18s}
.related a.rel:hover{border-color:var(--a1)}
.related a.rel .thumb{display:block;aspect-ratio:16/9;overflow:hidden;background:var(--graphite)}
.related a.rel .thumb img{display:block;width:100%;height:100%;object-fit:cover}
.related a.rel .t{display:block;padding:14px 16px 16px;font-family:var(--font-serif);font-size:17px;line-height:1.4;color:var(--chalk-72)}
.related a.rel:hover .t{color:var(--chalk)}
@media(max-width:719px){.topbar nav{width:100%;gap:0;font-size:12px;border-top:1px solid var(--chalk-06)}
.topbar nav a{flex:1 1 0;min-height:48px}.hero{padding:48px 0 30px}}
`;

// Import UNICO con las cuatro familias, tal como lo trae el <head> del vFINAL.
// Las cuatro tienen rol exclusivo en el sistema: Cormorant → eyebrows y portadas ·
// EB Garamond → titulares y KPIs · DM Sans → cuerpo, UI y datos · Cinzel → SOLO
// etiquetas y badges. Un wordmark que cae a la serif del sistema se ve casi bien y no lo es.
// 2026-10-02 — servidas desde el propio dominio (ui-ux-layer §18.1), las MISMAS que la
// portada: `scripts/vendor-site-fonts.mjs` las interioriza en `assets/site/`. Con la hoja de
// Google, un bloqueador dejaba el logotipo en Georgia.
const FONTS = '/assets/site/fonts.css';

// `siteName` sale de `config.site_name` si la fila del canal lo trae; si no, del host
// de la URL canónica. En ningún caso de un literal en el repo.
// ── Wordmark — la forma es eje, las letras son instancia ────────────────────────────
//
// El sistema de marca lo declara como HTML/CSS, nunca como imagen. Este modulo NO lo
// lleva escrito: sabe que un wordmark es una secuencia de partes, cada una con un texto,
// un ROL tipografico, un peso, un ROL de color y un tracking. Los valores salen de
// `config.wordmark` de la fila del canal.
//
// Escribir «Forum» y «PHs» aqui seria poner la marca de UNA marca en el renderizador que
// sirve el blog de TRES. Por eso las clases de parte son POSICIONALES y no `.f` / `.ph` /
// `.s` como en el archivo de origen: `.ph` nombra «PH», y eso es instancia.
//
// El color va SIEMPRE por variable, nunca por literal en la regla: un rol conocido se
// resuelve al token del tema (`accent` → `--terra`) y un valor exacto declarado por el
// sistema de marca viaja en su propia custom property. Cablear `#C4622D` en el CSS seria
// instancia en el codigo.

const WM_FONT_ROLES = { display: 'font_display', serif: 'font_serif', sans: 'font_sans' };
const WM_COLOR_VARS = { text: '--chalk', text_2: '--chalk-72', text_3: '--chalk-42', accent: '--terra', warn: '--gold' };
const WM_FALLBACK = { font_display: "'EB Garamond',serif", font_serif: "'Cormorant Garamond',serif", font_sans: "'DM Sans',sans-serif" };
const WM_SIZES = new Set(['xxs', 'xs', 'sm', 'md', 'lg', 'xl']);
const WM_LAYOUTS = new Set(['inline', 'stack']);

// Un numero dentro de [min, max], o `null`. Lo que llega del dato no se interpola en el CSS
// sin pasar por aqui: un valor fuera de rango se descarta, no se recorta en silencio.
function boundedNumber(v, min, max) {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

// Una parte invalida se descarta y se anota; no se dibuja a medias ni tumba la pagina.
export function wordmarkParts(config) {
  const raw = config?.wordmark?.parts;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const theme = (config?.theme && typeof config.theme === 'object') ? config.theme : {};
  const parts = [];
  for (const p of raw) {
    const text = typeof p?.text === 'string' ? p.text : '';
    if (!text) continue;
    const fontKey = WM_FONT_ROLES[p?.font] ?? WM_FONT_ROLES.sans;
    const family = theme[fontKey] ? `'${String(theme[fontKey]).replace(/'/g, '')}',serif` : WM_FALLBACK[fontKey];
    const hex = /^#[0-9A-Fa-f]{3,8}$/.test(String(p?.color ?? '')) ? String(p.color) : null;
    parts.push({
      text,
      family,
      weight: Number.isFinite(Number(p?.weight)) ? Math.round(Number(p.weight)) : 400,
      color: hex ?? (WM_COLOR_VARS[p?.color] ? `var(${WM_COLOR_VARS[p.color]})` : `var(${WM_COLOR_VARS.text})`),
      tracking: /^-?[0-9.]{1,6}em$/.test(String(p?.tracking ?? '')) ? String(p.tracking) : '0',
      // Ejes opcionales (2026-10-02). Sin ellos, la parte se dibuja exactamente como antes.
      italic: p?.style === 'italic',
      scale: boundedNumber(p?.scale, 0.3, 2),
      spaceBefore: boundedNumber(p?.space_before, 0, 1),
      blink: p?.blink === true,
      stretchX: boundedNumber(p?.stretch?.x, 0.3, 3),
      stretchY: boundedNumber(p?.stretch?.y, 0.3, 3),
    });
  }
  return parts.length ? parts : null;
}

// Reglas por parte, generadas del dato. La GEOMETRIA no se genera: vive en `.wm` del
// bloque STYLE, que es eje y no depende de ninguna marca.
export function wordmarkStyle(config) {
  const parts = wordmarkParts(config);
  if (!parts) return '';
  const vars = parts.map((p, i) => `--wm-c${i}:${p.color}`).join(';');
  const rules = parts.map((p, i) => {
    const extra = [
      p.italic ? 'font-style:italic' : '',
      p.scale !== null ? `--wm-k:${p.scale}` : '',
      p.spaceBefore !== null ? `margin-left:${p.spaceBefore}em` : '',
      (p.stretchX !== null || p.stretchY !== null)
        ? `display:inline-block;transform:scale(${p.stretchX ?? 1},${p.stretchY ?? 1});transform-origin:center`
        : '',
    ].filter(Boolean).map((d) => `;${d}`).join('');
    return `.wm>span:nth-child(${i + 1}){font-family:${p.family};font-weight:${p.weight};`
      + `letter-spacing:${p.tracking};color:var(--wm-c${i})${extra}}`;
  }).join('');
  return `.wm{${vars}}${rules}`;
}

// Devuelve el wordmark, o el nombre del sitio en versalitas si el canal no trae ninguno.
// El respaldo no es un wordmark pobre: es texto declaradamente sin marca, que es lo
// honesto cuando falta el dato.
export function wordmarkHtml(config, { size = 'md' } = {}) {
  const parts = wordmarkParts(config);
  const name = siteNameOf(config);
  if (!parts) {
    return `<span style="font-family:var(--font-display);font-size:15px;letter-spacing:.12em;text-transform:uppercase">${escapeHtml(name)}</span>`;
  }
  // El tamaño y la disposicion pueden venir del dato (`wordmark.size`, `wordmark.layout`):
  // un logotipo apilado necesita un cuerpo menor que uno en linea para ocupar lo mismo.
  const wanted = config?.wordmark?.size;
  const cls = WM_SIZES.has(wanted) ? wanted : (WM_SIZES.has(size) ? size : 'md');
  const layout = WM_LAYOUTS.has(config?.wordmark?.layout) ? config.wordmark.layout : 'inline';
  // `aria-label` con el nombre: un lector de pantalla no debe deletrear las partes.
  return `<span class="wm wm-${cls}${layout === 'stack' ? ' wm-stack' : ''}" role="img" aria-label="${escapeHtml(name)}">`
    + parts.map((p) => `<span${p.blink ? ' class="wm-blink"' : ''}>${escapeHtml(p.text)}</span>`).join('') + '</span>';
}

export function siteNameOf(config) {
  if (config?.site_name) return String(config.site_name);
  try {
    return new URL(config.base_url).hostname.replace(/^www\./, '');
  } catch (_e) {
    return 'Blog';
  }
}

// Locale e idioma salen del canal (`config.locale`), con default declarado. Una marca
// de otro país cambia el dato, no el código.
export function localeOf(config) {
  // El default es el del SITIO, no el de ninguna otra marca: el origen traía `es-PA`
  // cableado, que en este repositorio habría declarado español una página inglesa. El valor
  // real sale igual de `config.locale` (`en-US` en la fila del canal); esto es sólo la red.
  const raw = String(config?.locale || 'en-US').trim();
  return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(raw) ? raw : 'en-US';
}

// El `lang` del `<html>` es el de LA PIEZA, no el del canal. Una pieza en inglés dentro
// de un canal `es-PA` se declaraba española: eso le dice al rastreador que traduzca lo
// que no hay que traducir y arruina el emparejamiento por idioma.
//
// Cuando la pieza no declara idioma, manda el locale del canal — que es lo que había.
// Cuando coincide en idioma con el canal, gana el locale COMPLETO, porque trae la región
// (`es-PA` es más preciso que `es`). Solo cuando difieren se impone el de la pieza.
export function pageLangOf(config, language = null) {
  const locale = localeOf(config);
  const raw = String(language ?? '').trim();
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(raw)) return locale;
  const primary = (s) => s.split('-')[0].toLowerCase();
  return primary(raw) === primary(locale) ? locale : raw;
}

// Rótulo del listado en la navegación estructurada (migas). Sale del canal si la fila lo
// trae; el default es la copia de plantilla de este repo, que es artefacto de una sola
// marca (MULTIBRAND_RULE §3).
export function blogLabelOf(config) {
  const v = config?.blog_label;
  return (typeof v === 'string' && v.trim()) ? v.trim() : 'Articles';
}

export function page({ config, title, description, canonical, ogType = 'website', ogImage = null, publishedIso = null, modifiedIso = null, structuredData = null, noindex = false, body, schemaFallbacks = [], blogPath = '/blog', language = null, alternates = [], prevUrl = null, nextUrl = null }) {
  const site = siteNameOf(config);
  const locale = pageLangOf(config, language);
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    noindex ? `<meta name="robots" content="noindex,follow">` : `<meta name="robots" content="index,follow,max-image-preview:large">`,
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : '',
    // Paginación declarada: sin `prev`/`next` cada página del listado se lee como una
    // página suelta y compite consigo misma.
    prevUrl ? `<link rel="prev" href="${escapeHtml(prevUrl)}">` : '',
    nextUrl ? `<link rel="next" href="${escapeHtml(nextUrl)}">` : '',
    // Alternates recíprocos. La lista llega vacía mientras no exista el par de idiomas,
    // y entonces acá no se emite absolutamente nada.
    ...alternates.map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.href)}">`),
    `<meta property="og:type" content="${escapeHtml(ogType)}">`,
    `<meta property="og:site_name" content="${escapeHtml(site)}">`,
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : '',
    `<meta property="og:locale" content="${escapeHtml(locale.replace('-', '_'))}">`,
    ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : '',
    publishedIso ? `<meta property="article:published_time" content="${escapeHtml(publishedIso)}">` : '',
    modifiedIso ? `<meta property="article:modified_time" content="${escapeHtml(modifiedIso)}">` : '',
    `<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : '',
    // Iconos del sitio. Las RUTAS son eje —convencion que cumple cualquier sitio— y cada
    // despliegue sirve en ellas el icono de SU marca. La imagen es lo que seria literal,
    // y la imagen esta en la raiz del sitio, no aqui.
    `<link rel="icon" href="/favicon.ico" sizes="any">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">`,
    `<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`,
    `<link rel="preload" href="/assets/site/fonts/cormorant-garamond-300-latin.woff2" as="font" type="font/woff2" crossorigin>`,
    `<link href="${FONTS}" rel="stylesheet">`,
    `<style>${STYLE}${wordmarkStyle(config)}</style>`,
    // `structuredData` admite un objeto o varios. Cada tipo va en su propio bloque en
    // vez de anidarse: es lo que los validadores de schema.org leen sin ambigüedad.
    ...[].concat(structuredData ?? []).filter(Boolean)
      .map((sd) => `<script type="application/ld+json">${jsonLd(sd)}</script>`),
  ].filter(Boolean).join('\n');

  // El rastro de degradación viaja en el HTML (comentario, invisible al lector) y en la
  // cabecera `X-Schema-Fallbacks`. Correr degradado se declara, no se silencia.
  const trace = schemaFallbacks.length
    ? `\n<!-- schema_fallbacks: ${escapeHtml(JSON.stringify(schemaFallbacks)).replace(/--/g, '- -')} -->\n`
    : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
${head}
</head>
<body>${trace}
<header class="topbar">
  <div class="wrap">
    <a class="mark" href="/" aria-label="${escapeHtml(site)}">${wordmarkHtml(config, { size: 'md' })}</a>
    <nav>
      <a href="/#about">About</a>
      <a class="feature" href="${escapeHtml(blogPath)}"${ogType === 'website' ? ' aria-current="page"' : ''}>${escapeHtml(blogLabelOf(config))}</a>
      <a href="/#contact">Contact</a>
    </nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer>
  <div class="wrap">
    <span>${escapeHtml(site)}</span>
    <span><a href="${escapeHtml(blogPath)}">All ${escapeHtml(blogLabelOf(config))}</a> · <a href="/#contact">Contact</a></span>
  </div>
</footer>
</body>
</html>`;
}

// Cuerpo de texto plano → párrafos. El texto va escapado: nunca se inyecta HTML de la DB.
// La negrita (`**texto**`) se traduce DESPUÉS de escapar, sobre el texto ya inerte: ver
// `_inline.js`.
export function paragraphs(body) {
  const blocks = blocksOf(body);
  if (!blocks.length) return '';
  // Formato editorial (F1, 2026-10-02): el primer párrafo es la entradilla; cada `##` abre
  // una sección numerada; `>` es la cita destacada. El último párrafo que empieza con raya
  // (—) es el cierre de firma de la marca y se compone aparte.
  const inline = (t) => emphasisToHtml(escapeHtml(t)).replace(/\n/g, '<br>');
  const lastP = blocks.map((b) => b.t).lastIndexOf('p');
  let firstP = true;
  let sec = 0;
  return blocks.map((b, i) => {
    if (b.t === 'h') {
      sec += 1;
      // El subtítulo no lleva negrita: ya es un titular. Se quitan los `**` sin pintarlos.
      return `<div class="sec"><span class="idx" aria-hidden="true">§ ${String(sec).padStart(2, '0')}</span><h2>${escapeHtml(stripEmphasis(b.text))}</h2></div>`;
    }
    if (b.t === 'quote') return `<blockquote class="pull"><p>${inline(b.text)}</p></blockquote>`;
    let cls = '';
    if (firstP) { cls = ' class="lede"'; firstP = false; }
    else if (i === lastP && /^[—–]\s/.test(b.text)) cls = ' class="closer"';
    return `<p${cls}>${inline(b.text)}</p>`;
  }).join('\n');
}

export function formatStamp(iso, config) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(localeOf(config), { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  } catch (_e) {
    return d.toISOString().slice(0, 10);
  }
}

// Respuesta de fallo RUIDOSO: motivo legible en el cuerpo, `noindex`, sin caché y con
// el mismo motivo ya escrito en el log del servidor.
export function failLoud(res, err, { requestId = null } = {}) {
  const code = err?.code ?? 'UNEXPECTED';
  const detail = err?.detail ?? err?.message ?? String(err);
  const status = err?.status ?? 500;
  console.error(`[blog] ${code}: ${detail}`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('X-Blog-Error', code);
  res.status(status).send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Canal de publicación no resuelto</title>
<style>${STYLE}</style></head>
<body><main class="wrap"><div class="hero">
<div class="eyebrow">${escapeHtml(code)}</div>
<h1>El canal de publicación no está resuelto.</h1>
<p class="lede">${escapeHtml(detail)}</p>
${requestId ? `<p class="meta"><span>request ${escapeHtml(requestId)}</span></p>` : ''}
</div>
<div class="notice"><strong>Por qué no hay contenido</strong>Esta ruta no inventa valores por defecto. Sin la configuración del canal en la base de datos, no hay <em>platform_key</em>, ni URL canónica, ni plantilla — y servir HTML indexable con datos inventados es peor que no servir nada.</div>
</main></body></html>`);
}
