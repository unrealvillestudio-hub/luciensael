#!/usr/bin/env node
// scripts/vendor-site-fonts.mjs — interioriza las tipografías del sitio (portada y blog) en
// `assets/site/`: `fonts.css` y `fonts/*.woff2`.
//
// POR QUÉ EXISTE (ui-ux-layer §18.1). Con las fuentes pedidas a Google en cada visita, el
// texto se dibuja primero con la tipografía del sistema y cambia al llegar la de la marca; con
// mala señal o con un bloqueador que corta `fonts.googleapis.com`, el logotipo deja de ser el
// logotipo. Servidas desde el propio dominio llegan con la página y se precargan.
//
// La lógica es la de `forumphs-com/scripts/vendor-collateral.mjs` (`vendorFonts`), reducida a
// lo que este sitio necesita: aquí no hay material comercial que interiorizar.
//
// CÓMO SE CORRE:  node scripts/vendor-site-fonts.mjs

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'site');
const FONT_DIR = join(OUT_DIR, 'fonts');

// Sin este User-Agent, Google Fonts devuelve `truetype` en vez de `woff2`.
const MODERN_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// El sitio se lee en inglés y en español. Otros alfabetos añadirían peso que nadie lee.
const KEEP_SUBSETS = new Set(['latin', 'latin-ext']);

// Las tres voces del BP de Lucien Sael (typography), con los pesos que el sitio usa de
// verdad, más Bebas Neue para el logotipo de >UNREALVILLE studio en «Worlds». Pedir un peso
// que no se carga hace que el navegador SINTETICE una negrita o una cursiva falsa.
const FAMILIES = [
  'Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400', // display: logotipo, titulares, citas
  'Crimson+Pro:ital,wght@0,300;0,400;0,500;1,300;1,400',          // body: prosa y titulares del blog
  'JetBrains+Mono:wght@300;400',                                  // mono: etiquetas, navegación, datos
  'Bebas+Neue',                                                   // logotipo de >UNREALVILLE studio
];

async function get(url, { asText = false, headers = {} } = {}) {
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return asText ? res.text() : Buffer.from(await res.arrayBuffer());
}

async function main() {
  await rm(FONT_DIR, { recursive: true, force: true });
  await mkdir(FONT_DIR, { recursive: true });
  const href = `https://fonts.googleapis.com/css2?family=${FAMILIES.join('&family=')}&display=swap`;
  const css = await get(href, { asText: true, headers: { 'User-Agent': MODERN_UA } });

  const kept = [];
  const downloads = new Map();
  const byUrl = new Map();
  for (const block of css.split('/*').slice(1)) {
    const subset = block.slice(0, block.indexOf('*/')).trim();
    if (!KEEP_SUBSETS.has(subset)) continue;
    const face = block.slice(block.indexOf('*/') + 2).trim();
    if (!face.startsWith('@font-face')) continue;
    const rewritten = face.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_m, url) => {
      // Una familia variable devuelve el MISMO archivo para todos sus pesos. Se descarga una
      // vez y las @font-face de cada peso apuntan a él: el navegador lo baja una sola vez.
      if (byUrl.has(url)) return `url(./fonts/${byUrl.get(url)})`;
      const family = /font-family:\s*'([^']+)'/.exec(face)?.[1] ?? 'font';
      const weight = /font-weight:\s*(\d+)/.exec(face)?.[1] ?? '400';
      const italic = /font-style:\s*italic/.test(face);
      const name = `${family.toLowerCase().replace(/\s+/g, '-')}-${weight}${italic ? '-italic' : ''}-${subset}.woff2`;
      downloads.set(name, url);
      byUrl.set(url, name);
      return `url(./fonts/${name})`;
    });
    kept.push(`/* ${subset} */\n${rewritten}`);
  }
  if (!kept.length) throw new Error('Google Fonts no devolvió ninguna @font-face de los subconjuntos pedidos');

  let bytes = 0;
  for (const [name, url] of downloads) {
    const buf = await get(url);
    await writeFile(join(FONT_DIR, name), buf);
    bytes += buf.length;
  }
  const header = [
    '/* Tipografías interiorizadas por scripts/vendor-site-fonts.mjs — NO editar a mano.',
    ' * Origen: fonts.googleapis.com · Licencia: SIL Open Font License 1.1 (permite alojamiento propio).',
    ` * Subconjuntos conservados: ${[...KEEP_SUBSETS].join(', ')}.`,
    ' */',
    '',
  ].join('\n');
  await writeFile(join(OUT_DIR, 'fonts.css'), header + kept.join('\n\n') + '\n');
  console.log(`  fonts.css       ${kept.length} @font-face`);
  console.log(`  fonts/*.woff2   ${downloads.size} archivos (${bytes} bytes)`);
}

main().catch((e) => {
  console.error(`\nFALLO: ${e.message}`);
  process.exit(1);
});
